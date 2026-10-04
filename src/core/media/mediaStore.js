// src/core/media/mediaStore.js
const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

const redis = createClient();
// Trik agar error hanya dicetak 1 kali saja, tidak spam
let redisErrorLogged = false;
redis.on('error', () => {
    if (!redisErrorLogged) {
        console.error('[REDIS WARNING] Gagal terhubung ke Redis. Beralih ke RAM Lokal (Log selanjutnya dibisukan).');
        redisErrorLogged = true;
    }
});
redis.connect().catch(() => console.log('[REDIS] Memulai bot tanpa Redis.'));

const MAX_REDIS_CACHE = 50; 
const BACKUP_FILE = path.join(__dirname, '../../../media_backup.json');

let diskCache = new Map();
let albumLinks = new Map(); // <--- NEW: PENYIMPAN RELASI PARENT-CHILD
let needsSync = false;

// 1. Load Data
if (fs.existsSync(BACKUP_FILE)) {
    try {
        const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
        const data = JSON.parse(raw);
        diskCache = new Map(Object.entries(data.media || {}));
        albumLinks = new Map(Object.entries(data.albums || {}));
    } catch (err) {}
}

// 2. Sync to Disk
setInterval(() => {
    if (needsSync) {
        const dataToSave = {
            media: Object.fromEntries(diskCache),
            albums: Object.fromEntries(albumLinks) // Simpan juga relasinya
        };
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(dataToSave));
        needsSync = false;
    }
}, 5000); 

async function saveMedia(messageId, payload) {
    if (!messageId || !payload) return;
    diskCache.set(messageId, payload);
    needsSync = true;

    if (redis.isReady) {
        try {
            await redis.set(`media:${messageId}`, JSON.stringify(payload));
            await redis.lPush('media_tracker', messageId);
            if (await redis.lLen('media_tracker') > MAX_REDIS_CACHE) {
                const oldestId = await redis.rPop('media_tracker');
                if (oldestId) await redis.del(`media:${oldestId}`);
            }
        } catch (e) {}
    }
}

async function getMediaPayload(messageId) {
    if (redis.isReady) {
        try {
            const cached = await redis.get(`media:${messageId}`);
            if (cached) return JSON.parse(cached);
        } catch (e) {}
    }
    if (diskCache.has(messageId)) return diskCache.get(messageId);
    return null;
}

// ==========================================
// FUNGSI BARU: ALBUM LINKER
// ==========================================
function saveAlbumLink(parentId, childrenIds) {
    albumLinks.set(parentId, childrenIds);
    needsSync = true;
}

async function getAlbumChildrenPayloads(parentId) {
    if (!albumLinks.has(parentId)) return null;
    
    const childrenIds = albumLinks.get(parentId);
    const payloads = [];
    // Telusuri rantai file untuk mencari payload fisiknya
    for (const id of childrenIds) {
        const payload = await getMediaPayload(id);
        if (payload) payloads.push(payload);
    }
    return payloads.length > 0 ? payloads : null;
}

module.exports = { 
    saveMedia, getMediaPayload, redisClient: redis,
    saveAlbumLink, getAlbumChildrenPayloads // <--- Ekspor fungsi baru
};