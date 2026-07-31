const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../database_mahasiswa.db');
const db = new sqlite3.Database(dbPath);

// ==========================================
// 🏗️ INISIALISASI TABEL
// ==========================================
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            phone_number TEXT PRIMARY KEY,
            nama TEXT,
            
            -- 🎓 BLOK SIMA
            sima_nim TEXT,
            sima_password TEXT,
            sima_token TEXT,
            
            -- 📚 BLOK E-LEARNING (KREDENSIAL)
            elearning_username TEXT,
            elearning_password TEXT,
            
            -- 🚀 BLOK E-LEARNING (JALUR API MOBILE)
            elearning_api_token TEXT,
            elearning_api_privatetoken TEXT,
            
            -- 🕸️ BLOK E-LEARNING (JALUR WEB / SCRAPING)
            elearning_web_cookie TEXT,
            elearning_web_sesskey TEXT,
            
            -- ⏱️ WAKTU PEMBARUAN TERAKHIR
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

// ==========================================
// 💾 FUNGSI PENYIMPANAN KHUSUS SIMA
// ==========================================
function saveSimaData(phone_number, nim, password, token, nama) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO users (phone_number, sima_nim, sima_password, sima_token, nama, last_updated)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(phone_number) DO UPDATE SET
            sima_nim = excluded.sima_nim,
            sima_password = excluded.sima_password,
            sima_token = excluded.sima_token,
            nama = excluded.nama,
            last_updated = CURRENT_TIMESTAMP
        `;
        db.run(query, [phone_number, nim, password, token, nama], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// ==========================================
// 💾 FUNGSI PENYIMPANAN KHUSUS E-LEARNING API
// ==========================================
function saveElearningApiData(phone_number, username, password, api_token, api_privatetoken) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO users (phone_number, elearning_username, elearning_password, elearning_api_token, elearning_api_privatetoken, last_updated)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(phone_number) DO UPDATE SET
            elearning_username = excluded.elearning_username,
            elearning_password = excluded.elearning_password,
            elearning_api_token = excluded.elearning_api_token,
            elearning_api_privatetoken = excluded.elearning_api_privatetoken,
            last_updated = CURRENT_TIMESTAMP
        `;
        db.run(query, [phone_number, username, password, api_token, api_privatetoken], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// ==========================================
// 💾 FUNGSI PENYIMPANAN KHUSUS E-LEARNING WEB (SCRAPING)
// ==========================================
function saveElearningWebData(phone_number, username, password, web_cookie, web_sesskey) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO users (phone_number, elearning_username, elearning_password, elearning_web_cookie, elearning_web_sesskey, last_updated)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(phone_number) DO UPDATE SET
            elearning_username = excluded.elearning_username,
            elearning_password = excluded.elearning_password,
            elearning_web_cookie = excluded.elearning_web_cookie,
            elearning_web_sesskey = excluded.elearning_web_sesskey,
            last_updated = CURRENT_TIMESTAMP
        `;
        db.run(query, [phone_number, username, password, web_cookie, web_sesskey], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Jangan lupa tambahkan di dalam module.exports di baris paling bawah:
module.exports = { db, saveSimaData, saveElearningApiData, saveElearningWebData };