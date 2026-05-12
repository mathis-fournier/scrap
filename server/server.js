require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-cda-key-12345';

const requireAdmin = async (req, res, next) => {
    const { adminId } = req.query; // Passed from the frontend
    if (!adminId) return res.status(403).json({ error: "No ID provided" });

    try {
        const [users] = await db.execute('SELECT role FROM users WHERE id = ?', [adminId]);
        if (users.length > 0 && users[0].role === 'admin') {
            next(); // They are an admin, let them through
        } else {
            res.status(403).json({ error: "Unauthorized. Admins only." });
        }
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

// --- 1. AUTHENTICATION ROUTES ---

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = crypto.randomUUID();
        await db.execute('INSERT INTO users (id, email, password) VALUES (?, ?, ?)', [id, email, hashedPassword]);

        const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, userId: id });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "Email already exists" });
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Invalid credentials" });

        // Include the role in the response
        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, userId: user.id, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. SETTINGS & PROXY ASSIGNMENT ---

app.post('/api/settings', async (req, res) => {
    const { userId, cookie } = req.body;
    try {
        const [users] = await db.execute('SELECT proxy_url FROM users WHERE id = ?', [userId]);
        let proxyToSave = users[0].proxy_url;

        // If they don't have a proxy, assign a STRICTLY UNIQUE one
        if (!proxyToSave && process.env.PROXY_POOL) {
            const pool = process.env.PROXY_POOL.split(',');

            // 1. Ask the database which proxies are already taken by anyone
            const [usedProxiesRows] = await db.execute('SELECT proxy_url FROM users WHERE proxy_url IS NOT NULL');
            const usedProxies = usedProxiesRows.map(row => row.proxy_url);

            // 2. Filter the pool to only keep unused proxies
            const availableProxies = pool.filter(proxy => !usedProxies.includes(proxy));

            if (availableProxies.length > 0) {
                // Pick a random proxy from the AVAILABLE list, not the whole pool
                proxyToSave = availableProxies[Math.floor(Math.random() * availableProxies.length)];
            } else {
                // 🛑 CRITICAL SAFETY: If all proxies are taken, block the assignment
                return res.status(400).json({
                    error: "System at capacity! No dedicated proxies available right now."
                });
            }
        }

        await db.execute('UPDATE users SET vinted_cookie = ?, proxy_url = ? WHERE id = ?', [cookie, proxyToSave, userId]);
        res.json({ success: true, message: "Cookie saved and dedicated proxy secured!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 3. KEYWORD ROUTES ---

app.post('/api/keywords', async (req, res) => {
    const { userId, keyword, minPrice, maxPrice } = req.body;
    const id = crypto.randomUUID();
    
    // Base Vinted URL
    let apiUrl = `https://www.vinted.fr/api/v2/catalog/items?search_text=${encodeURIComponent(keyword)}&order=newest_first`;
    
    // Append price parameters if the user provided them
    if (minPrice) apiUrl += `&price_from=${minPrice}`;
    if (maxPrice) apiUrl += `&price_to=${maxPrice}`;

    try {
        await db.execute(
            'INSERT INTO keywords (id, user_id, name, min_price, max_price, api_url) VALUES (?, ?, ?, ?, ?, ?)', 
            [id, userId, keyword, minPrice || null, maxPrice || null, apiUrl]
        );
        res.json({ 
            success: true, 
            id, 
            name: keyword, 
            min_price: minPrice || null, 
            max_price: maxPrice || null, 
            apiUrl 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/keywords/:userId', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM keywords WHERE user_id = ?', [req.params.userId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/keywords/:keywordId', async (req, res) => {
    const { keywordId } = req.params;
    const { userId } = req.query; // Ensure the user actually owns the keyword
    try {
        await db.execute('DELETE FROM keywords WHERE id = ? AND user_id = ?', [keywordId, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 4. HISTORY ROUTE ---

app.get('/api/items/:userId', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC LIMIT 60',
            [req.params.userId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN ROUTES ---

// 1. Get high-level system metrics
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const [userCount] = await db.execute('SELECT COUNT(*) as total FROM users');
        const [keywordCount] = await db.execute('SELECT COUNT(*) as total FROM keywords');
        const [itemCount] = await db.execute('SELECT COUNT(*) as total FROM items');

        res.json({
            users: userCount[0].total,
            keywords: keywordCount[0].total,
            items: itemCount[0].total
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Get a detailed table of all users and their health
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT 
                u.id, u.email, u.role, u.proxy_url, 
                IF(u.vinted_cookie IS NULL, 'Dead/Missing', 'Active') as cookie_status,
                u.created_at,
                COUNT(k.id) as keyword_count
            FROM users u
            LEFT JOIN keywords k ON u.id = k.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:targetId', requireAdmin, async (req, res) => {
    try {
        // Prevent the admin from accidentally deleting themselves
        if (req.params.targetId === req.query.adminId) {
            return res.status(400).json({ error: "Cannot delete your own admin account." });
        }
        await db.execute('DELETE FROM users WHERE id = ?', [req.params.targetId]);
        res.json({ success: true, message: "User completely removed." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- 5. WEBSOCKETS & REDIS ---

io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
        socket.join(userId);
        console.log(`🟢 User ${userId} connected to their private room.`);
    }
});

const redisSub = new Redis(process.env.REDIS_URL);
// Listen to both item drops and system events (like dead cookies)
redisSub.subscribe('vinted-drops', 'vinted-system');

redisSub.on('message', (channel, message) => {
    const payload = JSON.parse(message);

    if (channel === 'vinted-drops') {
        io.to(payload.userId).emit('new-item', payload.item);
    } else if (channel === 'vinted-system') {
        io.to(payload.userId).emit('system-event', payload);
    }
});

server.listen(3000, () => console.log('🚀 API & Websockets running on port 3000'));