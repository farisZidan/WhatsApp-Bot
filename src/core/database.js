// src/core/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../auth_data.sqlite');
const db = new sqlite3.Database(dbPath);

const run = (query, params = []) => new Promise((resolve, reject) => db.run(query, params, function(err) { err ? reject(err) : resolve(this) }));
const get = (query, params = []) => new Promise((resolve, reject) => db.get(query, params, (err, row) => err ? reject(err) : resolve(row)));
const all = (query, params = []) => new Promise((resolve, reject) => db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows)));

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

    // Tabel pelacak tugas per user
    db.run(`
        CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jid TEXT,
            event_id INTEGER,
            course_name TEXT,
            title TEXT,
            description TEXT,
            deadline INTEGER,
            is_completed INTEGER DEFAULT 0,
            notified_3h INTEGER DEFAULT 0,
            created_at INTEGER,
            UNIQUE(jid, event_id)
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

async function getAllElearningUsers() {
    return await all(`SELECT jid, el_moodle_token, el_user FROM users WHERE el_moodle_token IS NOT NULL`);
}

async function deleteAuth(jid, type) {
    if (type === 'sima') {
        await run(`UPDATE users SET sima_user = NULL, sima_pass = NULL, sima_token = NULL WHERE jid = ?`, [jid]);
    } else if (type === 'elearning') {
        await run(`UPDATE users SET el_user = NULL, el_pass = NULL, el_moodle_token = NULL, el_web_token = NULL, el_web_expires = NULL WHERE jid = ?`, [jid]);
    }
}

// ==========================================
// 📦 HELPER QUERY TUGAS / ASSIGNMENTS
// ==========================================

async function upsertAssignment(jid, event) {
    // Return true jika ini tugas baru yang belum pernah tercatat di DB
    const existing = await get(`SELECT id FROM assignments WHERE jid = ? AND event_id = ?`, [jid, event.id]);
    
    await run(`
        INSERT INTO assignments (jid, event_id, course_name, title, description, deadline, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(jid, event_id) DO UPDATE SET
        course_name=excluded.course_name, title=excluded.title, deadline=excluded.deadline
    `, [jid, event.id, event.course?.fullname || 'Mata Kuliah', event.name, event.description || '', event.timesort, Math.floor(Date.now() / 1000)]);

    return !existing; // true jika item baru
}

async function getPendingAssignments(jid) {
    return await all(`SELECT * FROM assignments WHERE jid = ? AND is_completed = 0 ORDER BY deadline ASC`, [jid]);
}

async function markAssignmentCompleted(jid, eventId) {
    return await run(`UPDATE assignments SET is_completed = 1 WHERE jid = ? AND (event_id = ? OR id = ?)`, [jid, eventId, eventId]);
}

async function cleanupCompletedAssignments() {
    // Hapus tugas yang sudah tercentang / selesai agar database tetap bersih
    return await run(`DELETE FROM assignments WHERE is_completed = 1`);
}

async function mark3hNotified(id) {
    return await run(`UPDATE assignments SET notified_3h = 1 WHERE id = ?`, [id]);
}

async function getAssignmentsNearDeadline() {
    const now = Math.floor(Date.now() / 1000);
    const threeHoursLater = now + (3 * 3600);
    // Tugas yang belum selesai, deadline dalam 3 jam ke depan, dan belum diberi peringatan 3 jam
    return await all(`
        SELECT * FROM assignments 
        WHERE is_completed = 0 
          AND notified_3h = 0 
          AND deadline > ? 
          AND deadline <= ?
    `, [now, threeHoursLater]);
}

module.exports = { 
    saveSimaAuth, 
    saveElearningAuth, 
    getUserAuth, 
    getAllElearningUsers,
    deleteAuth,
    upsertAssignment,
    getPendingAssignments,
    markAssignmentCompleted,
    cleanupCompletedAssignments,
    mark3hNotified,
    getAssignmentsNearDeadline
};