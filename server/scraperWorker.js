require('dotenv').config();
const { Worker } = require('bullmq');
const Redis = require('ioredis');
const db = require('./db');
const { scanVinted } = require('./vinted');

const redisConnection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const redisPub = new Redis(process.env.REDIS_URL);

// Helper function to create a human-like delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const worker = new Worker('vinted-scan-queue', async job => {
    // The payload is a user batch containing all their keywords
    const { userId, cookie, userAgent, proxyUrl, keywords } = job.data;

    console.log(`[Worker] Starting batch for User ${userId} (${keywords.length} keywords) - Proxy: ${proxyUrl ? 'Active' : 'None'}`);

    // Loop through the user's keywords sequentially
    for (const kw of keywords) {
        try {
            const annonce = await scanVinted(kw.apiUrl, cookie, userAgent, proxyUrl);

            // 🛑 1. KILL DEAD COOKIES
            if (annonce && annonce.error === 'SESSION_EXPIRED') {
                console.log(`[Worker] Cookie died for User ${userId}. Stripping access.`);

                // Remove cookie from database
                await db.execute('UPDATE users SET vinted_cookie = NULL WHERE id = ?', [userId]);

                // Alert the frontend so it shows the red warning banner
                redisPub.publish('vinted-system', JSON.stringify({ userId, type: 'COOKIE_DEAD' }));

                break; // Exit the loop completely. Stop scanning this user's batch.
            }

            // 🔄 2. AUTO-ROTATE BURNED PROXIES
            if (annonce && annonce.error === 'PROXY_BANNED') {
                console.warn(`[Worker] ⚠️ Proxy burned for User ${userId}. Initiating auto-rotation...`);

                if (process.env.PROXY_POOL) {
                    const pool = process.env.PROXY_POOL.split(',');
                    // Grab a random fresh proxy from your available pool
                    const newProxy = pool[Math.floor(Math.random() * pool.length)];

                    // Update the user's permanent proxy in the database immediately
                    await db.execute('UPDATE users SET proxy_url = ? WHERE id = ?', [newProxy, userId]);
                    console.log(`[Worker] Reassigned User ${userId} to new proxy IP.`);
                } else {
                    console.error(`[Worker] No PROXY_POOL found in .env. Cannot auto-rotate!`);
                }

                break; // Stop scanning. The Cron job will pick them back up with the new IP in the next cycle.
            }

            // 🎯 3. HANDLE SUCCESSFUL HITS
            if (annonce && !annonce.error) {
                const [result] = await db.execute(
                    `INSERT IGNORE INTO items 
                    (id, user_id, keyword_id, title, price, url, image_url, brand, size) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [annonce.id, userId, kw.id, annonce.titre, annonce.prix, annonce.lien, annonce.image, annonce.brand, annonce.size]
                );

                // If affectedRows > 0, it means it's a brand new item, not a duplicate
                if (result.affectedRows > 0) {
                    console.log(`🎯 HIT! [${kw.name}] : ${annonce.titre}`);

                    // Broadcast to Express via Redis so it routes to the correct WebSockets room
                    redisPub.publish('vinted-drops', JSON.stringify({
                        userId: userId,
                        item: {
                            id: annonce.id,
                            title: annonce.titre,
                            price: annonce.prix,
                            url: annonce.lien,
                            imageUrl: annonce.image,
                            brand: annonce.brand,
                            size: annonce.size,
                            platform: "Vinted"
                        }
                    }));
                }
            }
        } catch (error) {
            console.error(`[Worker] Error on ${kw.name}:`, error.message);
        }

        // 🛡️ ANTI-BAN PROTECTION: Wait 2.5 seconds before scanning this user's next keyword
        await delay(2500);
    }

    console.log(`✅ [Worker] Finished batch for User ${userId}`);

}, {
    connection: redisConnection,
    concurrency: 5 // Process 5 DIFFERENT USERS at the exact same time
});

worker.on('failed', (job, err) => {
    console.error(`[Worker] Batch failed for User ${job?.data?.userId}:`, err.message);
});

console.log('🚀 Worker listening for user batches...');