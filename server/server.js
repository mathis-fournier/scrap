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

// --- AUTHENTICATION ROUTES ---

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

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, userId: user.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- REST API ROUTES ---

app.post('/api/settings', async (req, res) => {
    const { userId, cookie } = req.body;
    try {
        await db.execute('UPDATE users SET vinted_cookie = ? WHERE id = ?', [cookie, userId]);
        res.json({ success: true, message: "Cookie updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/keywords', async (req, res) => {
    const { userId, keyword } = req.body;
    const id = crypto.randomUUID();
    const apiUrl = `https://www.vinted.fr/api/v2/catalog/items?search_text=${encodeURIComponent(keyword)}&order=newest_first`;

    try {
        await db.execute('INSERT INTO keywords (id, user_id, name, api_url) VALUES (?, ?, ?, ?)', [id, userId, keyword, apiUrl]);
        res.json({ success: true, id, name: keyword, apiUrl });
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
    const { userId } = req.query; // Pass userId to ensure they own it
    try {
        await db.execute('DELETE FROM keywords WHERE id = ? AND user_id = ?', [keywordId, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

// --- WEBSOCKET ROUTING ---
io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
        socket.join(userId);
        console.log(`🟢 User ${userId} joined their private room.`);
    }
});

// --- REDIS LISTENER ---
const redisSub = new Redis(process.env.REDIS_URL);
redisSub.subscribe('vinted-drops');

redisSub.on('message', (channel, message) => {
    if (channel === 'vinted-drops') {
        const payload = JSON.parse(message);
        io.to(payload.userId).emit('new-item', payload.item);
    }
});

server.listen(3000, () => console.log('🚀 API & Websockets running on port 3000'));