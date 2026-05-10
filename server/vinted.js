const axios = require('axios');

async function scanVinted(apiUrl, cookie, userAgent) {
    if (!cookie) {
        console.error("Missing cookie for this scan.");
        return null;
    }

    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': cookie,
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Connection': 'keep-alive'
            }
        });

        const items = response.data.items;

        if (items && items.length > 0) {
            const realItems = items.filter(item => !item.is_promoted && !item.promoted);

            if (realItems.length > 0) {
                const firstItem = realItems[0];
                const imageUrl = firstItem.photo ? firstItem.photo.url : 'https://via.placeholder.com/300?text=No+Image';

                return {
                    id: firstItem.id.toString(),
                    titre: firstItem.title,
                    prix: firstItem.price?.amount || firstItem.price || "N/A",
                    lien: firstItem.url,
                    image: imageUrl,
                    brand: firstItem.brand_title || "N/A",
                    size: firstItem.size_title || "N/A"
                };
            }
        }
        return null;

    } catch (error) {
        console.error("Vinted API Error:", error.message);
        return null;
    }
}

module.exports = { scanVinted };