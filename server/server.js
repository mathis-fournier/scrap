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

// Import your custom security middleware
const { authenticateToken, requireAdmin } = require('./middleware/auth');

// 1. DECLARE THE APP FIRST
const app = express();

// 2. THEN YOU CAN USE IT
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-cda-key-12345';

// --- 1. PUBLIC AUTHENTICATION ROUTES ---

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = crypto.randomUUID();
        await db.execute('INSERT INTO users (id, email, password) VALUES (?, ?, ?)', [id, email, hashedPassword]);

        const token = jwt.sign({ userId: id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, userId: id, role: 'user' });
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

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, userId: user.id, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. PROTECTED USER ROUTES ---

app.post('/api/settings', authenticateToken, async (req, res) => {
    const userId = req.user.userId; 
    const { cookie } = req.body;
    
    try {
        const [users] = await db.execute('SELECT proxy_url FROM users WHERE id = ?', [userId]);
        let proxyToSave = users[0].proxy_url;

        if (!proxyToSave && process.env.PROXY_POOL) {
            const pool = process.env.PROXY_POOL.split(',');
            const [usedProxiesRows] = await db.execute('SELECT proxy_url FROM users WHERE proxy_url IS NOT NULL');
            const usedProxies = usedProxiesRows.map(row => row.proxy_url);
            const availableProxies = pool.filter(proxy => !usedProxies.includes(proxy));

            if (availableProxies.length > 0) {
                proxyToSave = availableProxies[Math.floor(Math.random() * availableProxies.length)];
            } else {
                return res.status(400).json({ error: "System at capacity! No dedicated proxies available right now." });
            }
        }

        await db.execute('UPDATE users SET vinted_cookie = ?, proxy_url = ? WHERE id = ?', [cookie, proxyToSave, userId]);
        res.json({ success: true, message: "Cookie saved and dedicated proxy secured!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/keywords', authenticateToken, async (req, res) => {
    const userId = req.user.userId; 
    const { keyword, minPrice, maxPrice } = req.body;
    const id = crypto.randomUUID();
    
    const parsedMin = minPrice !== '' && minPrice !== null ? parseFloat(minPrice) : null;
    const parsedMax = maxPrice !== '' && maxPrice !== null ? parseFloat(maxPrice) : null;

    let apiUrl = `https://www.vinted.fr/api/v2/catalog/items?search_text=${encodeURIComponent(keyword)}&order=newest_first`;
    if (parsedMin !== null) apiUrl += `&price_from=${parsedMin}`;
    if (parsedMax !== null) apiUrl += `&price_to=${parsedMax}`;

    try {
        await db.execute(
            'INSERT INTO keywords (id, user_id, name, min_price, max_price, api_url) VALUES (?, ?, ?, ?, ?, ?)', 
            [id, userId, keyword, parsedMin, parsedMax, apiUrl]
        );
        res.json({ success: true, id, name: keyword, min_price: parsedMin, max_price: parsedMax, apiUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/keywords/:targetUserId', authenticateToken, async (req, res) => {
    if (req.user.userId !== req.params.targetUserId) {
        return res.status(403).json({ error: "Forbidden access." });
    }

    try {
        const [rows] = await db.execute('SELECT * FROM keywords WHERE user_id = ?', [req.user.userId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/keywords/:keywordId', authenticateToken, async (req, res) => {
    const { keywordId } = req.params;
    const userId = req.user.userId; 
    
    try {
        await db.execute('DELETE FROM keywords WHERE id = ? AND user_id = ?', [keywordId, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/items/:targetUserId', authenticateToken, async (req, res) => {
    if (req.user.userId !== req.params.targetUserId) {
        return res.status(403).json({ error: "Forbidden access." });
    }

    try {
        const [rows] = await db.execute(
            'SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC LIMIT 60',
            [req.user.userId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 3. PROTECTED ADMIN ROUTES ---

app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
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

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
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

app.delete('/api/admin/users/:targetId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        if (req.params.targetId === req.user.userId) {
            return res.status(400).json({ error: "Cannot delete your own admin account." });
        }
        await db.execute('DELETE FROM users WHERE id = ?', [req.params.targetId]);
        res.json({ success: true, message: "User completely removed." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 4. WEBSOCKETS & REDIS ---

io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
        socket.join(userId);
        console.log(`🟢 User ${userId} connected to their private room.`);
    }
});

const redisSub = new Redis(process.env.REDIS_URL);
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