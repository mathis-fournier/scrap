require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const db = require('./db');

const redisConnection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});

const scanQueue = new Queue('vinted-scan-queue', { connection: redisConnection });

async function injectJobs() {
    try {
        const [rows] = await db.execute(`
            SELECT 
                k.id AS keywordId, 
                k.name AS keywordName, 
                k.api_url AS apiUrl, 
                u.id AS userId,
                u.vinted_cookie AS cookie, 
                u.user_agent AS userAgent
            FROM keywords k
            JOIN users u ON k.user_id = u.id
            WHERE u.vinted_cookie IS NOT NULL AND u.vinted_cookie != ''
        `);

        if (rows.length === 0) {
            console.log("⏱️ [Cron] No active keywords with valid cookies found.");
            return;
        }

        for (const row of rows) {
            await scanQueue.add('scan-job', {
                keywordId: row.keywordId,
                keywordName: row.keywordName,
                apiUrl: row.apiUrl,
                userId: row.userId,
                cookie: row.cookie,
                userAgent: row.userAgent
            }, {
                removeOnComplete: true,
                removeOnFail: true
            });
        }

        console.log(`[Cron] Dispatched ${rows.length} keyword scans.`);
    } catch (error) {
        console.error("Cron Error:", error);
    }
}

setInterval(injectJobs, 10000);
console.log('⏱️  Cron Injector started. Adding jobs every 10 seconds...');