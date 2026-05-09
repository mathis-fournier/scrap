const axios = require('axios');

async function scanVinted(apiUrl) {
    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': process.env.VINTED_USER_AGENT,
                'Cookie': process.env.VINTED_COOKIE,
                // Add these to perfectly mimic Chrome/Firefox:
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
            // 1. FIX: Filter out the promoted items (boosted items)
            const realItems = items.filter(item => !item.is_promoted && !item.promoted);

            if (realItems.length > 0) {
                const firstItem = realItems[0];

                // 2. FIX: Safely extract the image URL (with a fallback)
                const imageUrl = firstItem.photo ? firstItem.photo.url : 'https://via.placeholder.com/300?text=No+Image';

                return {
                    id: firstItem.id,
                    titre: firstItem.title,
                    prix: firstItem.price,
                    lien: firstItem.url,
                    image: imageUrl, // Send the image
                    brand: firstItem.brand_title || "N/A", // Bonus: Get real brand!
                    size: firstItem.size_title || "N/A"    // Bonus: Get real size!
                };
            }
        }

        return null;

    } catch (error) {
        console.error("Erreur Vinted:", error.message);
        return null;
    }
}

module.exports = { scanVinted };