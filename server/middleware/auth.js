const jwt = require('jsonwebtoken');
const db = require('../db'); // Note the ../ to go up one folder level

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-cda-key-12345';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });
        req.user = decodedUser;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized. Admins only." });
    }
    next();
};

module.exports = { authenticateToken, requireAdmin };