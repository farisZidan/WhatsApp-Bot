// src/core/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../auth_data.sqlite');
const db = new sqlite3.Database(dbPath);

// Konversi fungsi callback SQLite menjadi Promise agar bisa di-await
const run = (query, params = []) => new Promise((resolve, reject) => db.run(query, params, function(err) { err ? reject(err) : resolve(this) }));
const get = (query, params = []) => new Promise((resolve, reject) => db.get(query, params, (err, row) => err ? reject(err) : resolve(row)));

// Inisialisasi Tabel
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            jid TEXT PRIMARY KEY,
            sima_user TEXT,
            sima_pass TEXT,
            sima_token TEXT,
            el_user TEXT,
            el_pass TEXT,
            el_moodle_token TEXT,
            el_web_token TEXT,
            el_web_expires INTEGER
        )
    `);
});

async function saveSimaAuth(jid, user, pass, token) {
    await run(`
        INSERT INTO users (jid, sima_user, sima_pass, sima_token) 
        VALUES (?, ?, ?, ?) 
        ON CONFLICT(jid) DO UPDATE SET 
        sima_user=excluded.sima_user, sima_pass=excluded.sima_pass, sima_token=excluded.sima_token
    `, [jid, user, pass, token]);
}

async function saveElearningAuth(jid, user, pass, moodleToken, webToken, webExpires) {
    await run(`
        INSERT INTO users (jid, el_user, el_pass, el_moodle_token, el_web_token, el_web_expires) 
        VALUES (?, ?, ?, ?, ?, ?) 
        ON CONFLICT(jid) DO UPDATE SET 
        el_user=excluded.el_user, el_pass=excluded.el_pass, 
        el_moodle_token=excluded.el_moodle_token, el_web_token=excluded.el_web_token, el_web_expires=excluded.el_web_expires
    `, [jid, user, pass, moodleToken, webToken, webExpires]);
}

async function getUserAuth(jid) {
    return await get(`SELECT * FROM users WHERE jid = ?`, [jid]);
}

async function deleteAuth(jid, type) {
    if (type === 'sima') {
        // Mengubah nilai kolom spesifik SIMA menjadi NULL
        await run(`
            UPDATE users 
            SET sima_user = NULL, sima_pass = NULL, sima_token = NULL 
            WHERE jid = ?
        `, [jid]);
    } else if (type === 'elearning') {
        // Mengubah nilai kolom spesifik E-Learning menjadi NULL
        await run(`
            UPDATE users 
            SET el_user = NULL, el_pass = NULL, el_moodle_token = NULL, el_web_token = NULL, el_web_expires = NULL 
            WHERE jid = ?
        `, [jid]);
    }
}

module.exports = { saveSimaAuth, saveElearningAuth, getUserAuth, deleteAuth };