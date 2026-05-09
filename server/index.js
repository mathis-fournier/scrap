require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { scanVinted } = require('./vinted');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

let memory = {};
let recentItems = [];

// 1. FIX: Watchlist is now empty by default. The frontend will populate it.
let WATCHLIST = [];

io.on('connection', (socket) => {
    console.log('🟢 Frontend React connecté');
    socket.emit('history', recentItems);

    // 2. FIX: Listen for keyword updates from the frontend
    socket.on('update-watchlist', (clientWatchlist) => {
        console.log(`🔄 Mots-clés mis à jour par le client: ${clientWatchlist.map(w => w.name).join(', ')}`);
        WATCHLIST = clientWatchlist;
    });
});

async function startScanner() {
    while (true) {
        // If the watchlist is empty, skip the scan
        if (WATCHLIST.length > 0) {
            for (const search of WATCHLIST) {
                try {
                    const annonce = await scanVinted(search.apiUrl);
                    if (annonce && annonce.id !== memory[search.name]) {
                        console.log(`🎯 Trouvé [${search.name}] : ${annonce.titre}`);

                        const newItem = {
                            id: annonce.id,
                            title: annonce.titre,
                            price: annonce.prix,
                            url: annonce.lien,
                            imageUrl: annonce.image,
                            brand: annonce.brand,
                            size: annonce.size,
                            platform: "Vinted",
                            searchName: search.name,
                            timeAgo: "Just now"
                        };

                        io.emit('new-item', newItem);

                        recentItems.unshift(newItem);
                        if (recentItems.length > 30) recentItems.pop();

                        memory[search.name] = annonce.id;
                    }
                } catch (err) {
                    console.error(`Erreur scan [${search.name}]:`, err.message);
                }
            }
        }
        await new Promise(r => setTimeout(r, 15000));
    }
}

server.listen(3000, () => {
    console.log('🚀 Serveur API et WebSockets lancé sur http://localhost:3000');
    startScanner();
});