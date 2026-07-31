const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const { getMediaBuffer } = require('../utils/mediaHelper');
const { compressVideoToSticker } = require('../utils/videoCompressor');

async function handleStickerCommand(sock, msg, targetJid, messageCache) {
    try {
        await sock.sendMessage(targetJid, { text: '⏳ Sedang memproses stiker...' }, { quoted: msg });

        const mediaData = await getMediaBuffer(msg, messageCache);
        
        if (!mediaData || !mediaData.buffer) {
            throw new Error('Buffer media kosong.');
        }

        let finalStickerBuffer;

        if (mediaData.type === 'video') {
            console.log('[COMPRESSOR] Melakukan encoding video mentah ke WebP...');
            // Gunakan mesin FFmpeg kustom kita untuk video
            finalStickerBuffer = await compressVideoToSticker(mediaData.buffer);
        } else {
            // Gunakan library standar untuk gambar karena sudah aman
            const sticker = new Sticker(mediaData.buffer, {
                pack: 'Homelab Bot Pack',
                author: 'LXC Alpine Bot',
                type: StickerTypes.FULL,
                quality: 70
            });
            finalStickerBuffer = await sticker.toBuffer();
        }

        await sock.sendMessage(targetJid, { sticker: finalStickerBuffer }, { quoted: msg });
        console.log(`[STIKER SUCCESS] Stiker terkirim ke ${targetJid}`);

    } catch (error) {
        console.error('[STICKER HANDLER ERROR]', error.message);
        await sock.sendMessage(targetJid, { 
            text: `❌ Gagal membuat stiker.\nPenyebab: ${error.message}` 
        }, { quoted: msg });
    }
}

module.exports = { handleStickerCommand };
