const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../../tmp/message_cache.json');

// Load cache dari SSD saat bot pertama kali nyala
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            const parsed = JSON.parse(data);
            // Kembalikan ke dalam bentuk Map
            return new Map(parsed);
        }
    } catch (error) {
        console.error('[CACHE] Gagal memuat cache dari SSD, membuat baru...', error);
    }
    return new Map();
}

// Simpan cache ke SSD secara otomatis
function saveCache(cacheMap) {
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Ubah Map menjadi Array lalu ke JSON
        const arr = Array.from(cacheMap.entries());
        fs.writeFileSync(CACHE_FILE, JSON.stringify(arr), 'utf8');
    } catch (error) {
        console.error('[CACHE] Gagal menyimpan cache ke SSD:', error);
    }
}

module.exports = { loadCache, saveCache };
