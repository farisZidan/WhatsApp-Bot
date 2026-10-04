// src/core/media/downloader.js
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function downloadMedia(realMessage) {
    // 1. Ekstrak pesan murni (Bypass View Once)
    const msg = realMessage.viewOnceMessageV2 ? realMessage.viewOnceMessageV2.message : realMessage;
    
    // 2. Deteksi tipe media
    const type = Object.keys(msg).find(key => 
        ['imageMessage', 'videoMessage', 'documentMessage', 'stickerMessage', 'audioMessage'].includes(key)
    );
    
    if (!type) throw new Error("Tidak ada media WhatsApp yang valid untuk diunduh.");

    const baileysType = type.replace('Message', ''); 
    const stream = await downloadContentFromMessage(msg[type], baileysType);
    
    // ==========================================
    // 🚀 OPTIMASI PERFORMA MEMORI (O(N) Efisien)
    // ==========================================
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk); // Kumpulkan kepingan ke array, jauh lebih cepat!
    }
    const buffer = Buffer.concat(chunks); // Gabungkan kepingan hanya 1x di memori

    const mime = msg[type].mimetype || '';
    let finalType = baileysType;

    // ==========================================
    // 🧹 CLEAN CODE & PEMBEDAHAN DOKUMEN
    // ==========================================
    if (baileysType === 'document' && mime) {
        // Ambil kategori utama mime (contoh: "audio/flac" -> "audio")
        const majorMime = mime.split('/')[0]; 

        switch (majorMime) {
            case 'image':
            case 'video':
            case 'audio':
                finalType = majorMime;
                break;
            default:
                // Tetap pertahankan identitas 'document' untuk tipe seperti application/pdf, text/plain, dll
                break;
        }
    }
    const isAnimated = msg[type]?.isAnimated || (finalType === 'sticker' && buffer.includes('ANIM'));

    return { buffer, type: finalType, mime: mime, isAnimated };
}

// Tempat untuk fitur unduh dari Link/GIF Meta (Bisa dikembangkan nanti)
async function downloadFromUrl(url) {
    // Logika unduh dari URL
}

module.exports = { downloadMedia, downloadFromUrl };