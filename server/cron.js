require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const db = require('./db');

// Ensure we connect securely to Upstash
const redisConnection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const scanQueue = new Queue('vinted-scan-queue', { connection: redisConnection });

async function injectJobs() {
    try {
        // Fetch all active keywords along with their user's specific credentials
        const [rows] = await db.execute(`
            SELECT 
                u.id AS userId, u.vinted_cookie AS cookie, u.user_agent AS userAgent, u.proxy_url AS proxyUrl,
                k.id AS keywordId, k.name AS keywordName, k.api_url AS apiUrl
            FROM users u
            JOIN keywords k ON u.id = k.user_id
            WHERE u.vinted_cookie IS NOT NULL AND u.vinted_cookie != ''
        `);

        if (rows.length === 0) {
            // Keep the console clean, optionally comment this out later
            // console.log("⏱️ [Cron] No active users with cookies found.");
            return;
        }

        // Group keywords by user to create individual user batches
        const userBatches = {};
        for (const row of rows) {
            if (!userBatches[row.userId]) {
                userBatches[row.userId] = {
                    userId: row.userId,
                    cookie: row.cookie,
                    userAgent: row.userAgent,
                    proxyUrl: row.proxyUrl, // Their sticky proxy
                    keywords: []
                };
            }
            userBatches[row.userId].keywords.push({
                id: row.keywordId,
                name: row.keywordName,
                apiUrl: row.apiUrl
            });
        }

        const users = Object.values(userBatches);
        for (const userBatch of users) {
            // Inject ONE job per user
            await scanQueue.add('user-scan-batch', userBatch, {
                jobId: userBatch.userId, // Prevents duplicate batches for the same user in the queue
                removeOnComplete: true,
                removeOnFail: true
            });
        }

        console.log(`⏱️ [Cron] Dispatched batches for ${users.length} unique users.`);
    } catch (error) {
        console.error("Cron Error:", error);
    }
}

// Run every 30 seconds to allow the worker enough time to finish human-like delays
setInterval(injectJobs, 30000);
console.log('🚀 Cron Injector started. Adding user batches every 30 seconds...');