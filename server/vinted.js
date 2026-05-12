require('dotenv').config();
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function scanVinted(apiUrl, cookie, userAgent, proxyUrl) {
    if (!cookie) {
        return null;
    }

    // 1. Initialize the Proxy Agent if the user has a sticky proxy assigned
    let httpsAgent = null;
    if (proxyUrl) {
        httpsAgent = new HttpsProxyAgent(proxyUrl);
    }

    try {
        const response = await axios.get(apiUrl, {
            httpsAgent: httpsAgent,
            proxy: false, // Must disable default axios proxy handler
            headers: {
                'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': cookie,
                'Accept': 'application/json, text/plain, */*'
            }
        });

        const items = response.data.items;

        if (items && items.length > 0) {
            const realItems = items.filter(item => !item.is_promoted && !item.promoted);

            if (realItems.length > 0) {
                const firstItem = realItems[0];
                return {
                    id: firstItem.id.toString(),
                    titre: firstItem.title,
                    prix: firstItem.price?.amount || firstItem.price || "N/A",
                    lien: firstItem.url,
                    image: firstItem.photo ? firstItem.photo.url : 'https://via.placeholder.com/300?text=No+Image',
                    brand: firstItem.brand_title || "N/A",
                    size: firstItem.size_title || "N/A"
                };
            }
        }
        return null;

    } catch (error) {
        // 2. Classify errors to tell the worker exactly how to self-heal
        if (error.response) {
            // Vinted invalidated the user's specific account session
            if (error.response.status === 401) {
                return { error: 'SESSION_EXPIRED' };
            }
            // The Web Application Firewall blocked the Proxy IP
            if (error.response.status === 403 || error.response.status === 429) {
                return { error: 'PROXY_BANNED' };
            }
        }
        // The WAF completely terminated the TCP connection tunnel
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            return { error: 'PROXY_BANNED' };
        }

        return null; // Ignore standard timeouts
    }
}

module.exports = { scanVinted };