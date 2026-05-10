require('dotenv').config();
const { Worker } = require('bullmq');
const Redis = require('ioredis');
const db = require('./db');
const { scanVinted } = require('./vinted');

const redisConnection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});

const redisPub = new Redis(process.env.REDIS_URL);

const worker = new Worker('vinted-scan-queue', async job => {
    const { keywordId, keywordName, apiUrl, userId, cookie, userAgent } = job.data;

    try {
        const annonce = await scanVinted(apiUrl, cookie, userAgent);

        if (annonce) {
            console.log(`[Worker] 📡 Vinted API responded for [${keywordName}]. Latest item: ${annonce.id}`);
            const [result] = await db.execute(
        `INSERT IGNORE INTO items 
        (id, user_id, keyword_id, title, price, url, image_url, brand, size) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [annonce.id, userId, keywordId, annonce.titre, annonce.prix, annonce.lien, annonce.image, annonce.brand, annonce.size]
    );

            if (result.affectedRows > 0) {
                console.log(`🎯 HIT! [${keywordName}] : ${annonce.titre}`);

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
        console.error(`[Worker] Error on ${keywordName}:`, error.message);
    }
}, { connection: redisConnection, concurrency: 5 });

worker.on('failed', (job, err) => {
    console.error(`[Worker] Job failed for ${job?.data?.keywordName}:`, err.message);
});

console.log('🚀 Worker listening for jobs...');