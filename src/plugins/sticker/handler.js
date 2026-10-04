// plugins/sticker/handler.js

const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const { compressVideoToSticker } = require('./compressor');

module.exports = {
    execute: async (ctx) => {
        if (!ctx.hasMedia) {
            return await ctx.reply("❌ Kirim gambar/video dengan caption .s, atau reply media dengan .s");
        }

        try {
            const mediaData = await ctx.downloadMedia();
            
            if (!mediaData || !mediaData.buffer) {
                throw new Error('Buffer media kosong atau gagal diunduh.');
            }

            let finalStickerBuffer;

            if (mediaData.type === 'video') {
                console.log('[COMPRESSOR] Melakukan encoding video mentah ke WebP...');
                finalStickerBuffer = await compressVideoToSticker(mediaData.buffer);
            } else {
                // AMANKAN DENGAN STRING PAKSA DI SINI
                const sticker = new Sticker(mediaData.buffer, {
                    pack: String('Homelab Bot Pack'),
                    author: String('LXC Alpine Bot'),
                    type: StickerTypes.FULL,
                    quality: 70
                });
                finalStickerBuffer = await sticker.toBuffer();
            }

            await ctx.sock.sendMessage(ctx.chat, { sticker: finalStickerBuffer }); //, { quoted: ctx.raw });
            console.log(`[STIKER SUCCESS] Stiker terkirim ke ${ctx.chat}`);

        } catch (error) {
            console.error('[STICKER HANDLER ERROR]', error.message);
            await ctx.reply(`❌ Gagal membuat stiker.\nPenyebab: ${error.message}`);
        }
    }
};
