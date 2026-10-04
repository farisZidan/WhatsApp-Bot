// src/core/media/albumAggregator.js
const { redisClient, getMediaPayload, saveAlbumLink } = require('./mediaStore');

const MAX_ALBUM_COUNT = 50; 

// ==========================================
// FALLBACK MEMORI LOKAL JIKA REDIS MATI
// ==========================================
const localAlbumCache = new Map(); 

// Fungsi pembantu untuk menentukan arah penyimpanan (Redis vs Lokal)
async function getAlbumState(parentId) {
    if (redisClient.isReady) {
        const data = await redisClient.get(`album:${parentId}`);
        return data ? JSON.parse(data) : null;
    }
    return localAlbumCache.get(parentId) || null;
}

async function setAlbumState(parentId, data) {
    if (redisClient.isReady) {
        await redisClient.set(`album:${parentId}`, JSON.stringify(data));
    } else {
        localAlbumCache.set(parentId, data);
    }
}

async function deleteAlbumState(parentId) {
    if (redisClient.isReady) {
        await redisClient.del(`album:${parentId}`);
        await redisClient.lRem('album_tracker', 0, parentId);
    } else {
        localAlbumCache.delete(parentId);
    }
}

// Fungsi pemangkas limit
async function enforceCacheLimit() {
    if (redisClient.isReady) {
        const count = await redisClient.lLen('album_tracker');
        if (count > MAX_ALBUM_COUNT) {
            const oldestParentId = await redisClient.rPop('album_tracker'); 
            if (oldestParentId) await redisClient.del(`album:${oldestParentId}`);
        }
    } else {
        // Pemangkasan untuk Map lokal (FIFO Sederhana)
        if (localAlbumCache.size > MAX_ALBUM_COUNT) {
            const oldestKey = localAlbumCache.keys().next().value;
            localAlbumCache.delete(oldestKey);
        }
    }
}

// ==========================================
// LOGIKA UTAMA AGREGATOR
// ==========================================
async function handleAlbumMessage(ctx) {
    try {
        // 1. JIKA INI ADALAH PARENT
        if (ctx.isAlbumParent) {
            console.log(`[AGREGATOR] 📥 PARENT Diterima. Menunggu ${ctx.albumMediaCount} kepingan media.`);
            const parentId = ctx.messageId; 
            const newAlbumData = { expected: ctx.albumMediaCount, command: null, childrenIds: [] };
            await setAlbumState(parentId, newAlbumData);
            
            if (redisClient.isReady) await redisClient.lPush('album_tracker', parentId);
            await enforceCacheLimit(); 
            return null; 
        }

        // 2. JIKA INI ADALAH CHILD
        if (ctx.albumParentId) {
            console.log(`[AGREGATOR] 🧩 CHILD Diterima (ID: ${ctx.messageId}).`);
            const parentId = ctx.albumParentId;
            const albumData = await getAlbumState(parentId);

            if (!albumData) {
                console.log(`[AGREGATOR] ❌ Album Data tidak ditemukan untuk Child ini.`);
                return null; 
            }

            albumData.childrenIds.push(ctx.messageId);
            console.log(`[AGREGATOR] 📊 Progress Album: ${albumData.childrenIds.length} / ${albumData.expected}`);

            if (ctx.text && ctx.text.startsWith('.')) {
                albumData.command = ctx.text;
                console.log(`[AGREGATOR] 💬 Command terdeteksi pada kepingan: ${ctx.text}`);
            }

            // JIKA SEMUA KEPINGAN SUDAH TERKUMPUL
            if (albumData.childrenIds.length === albumData.expected) {
                console.log(`[AGREGATOR] ✅ ALBUM LENGKAP! Menarik data fisik...`);
                ctx.isCompleteAlbum = true;
                ctx.text = albumData.command || ""; 
                
                const { saveAlbumLink } = require('./mediaStore');
                saveAlbumLink(parentId, albumData.childrenIds);
                
                const payloads = [];
                for (const childId of albumData.childrenIds) {
                    const { getMediaPayload } = require('./mediaStore');
                    const payload = await getMediaPayload(childId);
                    if (payload) payloads.push(payload);
                }
                
                console.log(`[AGREGATOR] 📦 Berhasil menarik ${payloads.length} dari ${albumData.expected} kepingan fisik.`);
                ctx.albumChildren = payloads; 
                
                await deleteAlbumState(parentId);
                return ctx; 
            }

            await setAlbumState(parentId, albumData);
            return null; 
        }
    } catch (err) {
        console.error('[ALBUM ERROR]:', err.message);
    }
    return ctx; 
}

module.exports = { handleAlbumMessage };