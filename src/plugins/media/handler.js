// src/plugins/media/handler.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const exifr = require('exifr');
const { destroyMedia } = require('./destroyer');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

const mediaPlugin = {

    // ==========================================
    // 1. DOWNLOADER (Stealth Forwarder ke DM)
    // ==========================================
    saveMedia: async (ctx) => {
        // Ambil ID Admin dari .env (Otomatis kebal dari error Reaction!)
        const adminIds = (process.env.ADMIN_IDS || '').split(',');
        const privateJid = adminIds.find(id => id.includes('@s.whatsapp.net')) || adminIds[0].trim();

        if (!ctx.hasMedia) {
            return await ctx.sock.sendMessage(privateJid, { text: "⚠️ Reply atau React media yang ingin di-download." });
        }
        
        await ctx.sock.sendMessage(privateJid, { text: "📥 Menarik media kualitas tertinggi secara diam-diam..." });
        
        const mediaData = await ctx.downloadMedia();
        if (!mediaData || !mediaData.buffer) {
            return await ctx.sock.sendMessage(privateJid, { text: "❌ Gagal mengunduh media." });
        }

        const ext = mediaData.type === 'image' ? 'jpg' 
                  : mediaData.type === 'video' ? 'mp4' 
                  : mediaData.type === 'audio' ? 'mp3' 
                  : mediaData.type === 'sticker' ? 'webp' 
                  : 'bin';

        const fileName = `FILE_ORIGINAL_${Date.now()}.${ext}`;

        await ctx.sock.sendMessage(privateJid, {
            document: mediaData.buffer, 
            mimetype: mediaData.mime,
            fileName: fileName,
            caption: "✅ Kualitas 100% aman tanpa kompresi WA."
        });
    },




    // ==========================================
    // 2. DOWNGRADER (Tragedi Warnet 2012)
    // ==========================================
    downgradeMedia: async (ctx) => {
        if (!ctx.hasMedia) {
            return await ctx.reply(
                "⚠️ *CARA PENGGUNAAN:*\n1. Kirim/Reply foto, video, audio, atau stiker dengan teks: *.burik 100*"
            );
        }
        
        let level = parseInt(ctx.args[0]) || 50;
        level = Math.max(1, Math.min(100, level)); 
        
        const mediaData = await ctx.downloadMedia();
        if (!mediaData || !mediaData.buffer) return await ctx.reply("❌ Gagal mengunduh media.");

        try {
            // 🚨 LEMPAR STATUS ANIMASI KE MESIN DESTROYER
            const resultBuffer = await destroyMedia(mediaData.buffer, mediaData.type, level, mediaData.isAnimated);
            
            let messagePayload;
            
            // 🔥 DRY (Don't Repeat Yourself): Simpan caption di satu variabel agar tidak diulang-ulang
            const captionText = `🗑️ Kualitas hancur (Level ${level})`;

            // 🎯 SWITCH-CASE: Lebih cepat diproses mesin (O(1) Jump Table) & Sangat rapi
            switch (mediaData.type) {
                case 'video':
                    messagePayload = { video: resultBuffer, caption: captionText };
                    break;
                    
                case 'audio':
                    messagePayload = { audio: resultBuffer, mimetype: 'audio/mpeg' };
                    break;
                    
                case 'sticker':
                    const sticker = new Sticker(resultBuffer, {
                        pack: 'Tragedi Warnet', 
                        author: `Level ${level}`,
                        type: StickerTypes.FULL,
                        quality: Math.max(10, 100 - level)
                    });
                    messagePayload = { sticker: await sticker.toBuffer() };
                    break;
                    
                case 'image':
                default: // Default fallback selalu ke gambar
                    messagePayload = { image: resultBuffer, caption: captionText };
                    break;
            }

            await ctx.sock.sendMessage(ctx.chat, messagePayload, { quoted: ctx.raw });
        } catch (err) {
            console.error("[HANDLER ERROR]", err);
            await ctx.reply("❌ Gagal merusak media. Terjadi kesalahan pada mesin internal.");
        }
    },


    
    // ==========================================
    // 3. MEDIA INFO (Ekstraktor Metadata)
    // ==========================================
    extractInfo: async (ctx) => {
        if (!ctx.hasMedia) return await ctx.reply("⚠️ Balas/kirim media (Foto/Video/Audio/GIF) untuk dicek metadatanya.");
        
        const mediaData = await ctx.downloadMedia();
        if (!mediaData || !mediaData.buffer) return await ctx.reply("❌ Gagal mengunduh media.");

        try {
            let infoText = `📊 *INFORMASI METADATA MEDIA*\n\n`;

            if (mediaData.type === 'image' && !mediaData.mime.includes('gif')) {
                const metadata = await exifr.parse(mediaData.buffer, { tiff: true, xmp: true, icc: true, gps: true });
                if (!metadata || Object.keys(metadata).length === 0) {
                    return await ctx.reply("ℹ️ Tidak ada metadata sensitif (EXIF) yang ditemukan pada foto ini.");
                }

                if (metadata.latitude && metadata.longitude) {
                    infoText += `📍 *LOKASI GPS:*\n- Latitude: ${metadata.latitude}\n- Longitude: ${metadata.longitude}\n- Google Maps: https://www.google.com/maps?q=${metadata.latitude},${metadata.longitude}\n\n`;
                }

                const keys = ['Make', 'Model', 'Software', 'DateTimeOriginal', 'ImageWidth', 'ImageHeight', 'Orientation'];
                infoText += `📸 *DATA KAMERA & FILE:*\n`;
                keys.forEach(key => {
                    if (metadata[key]) infoText += `- ${key}: ${metadata[key] instanceof Date ? metadata[key].toLocaleString() : metadata[key]}\n`;
                });
                
                return await ctx.reply(infoText);
            } 
            else {
                const ext = mediaData.type === 'video' ? 'mp4' : mediaData.type === 'audio' ? 'mp3' : 'gif';
                const tempFile = path.join(os.tmpdir(), `probe_${Date.now()}.${ext}`);
                fs.writeFileSync(tempFile, mediaData.buffer);

                const probeData = await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(tempFile, (err, data) => err ? reject(err) : resolve(data));
                });
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

                const format = probeData.format || {};
                const stream = probeData.streams && probeData.streams[0] ? probeData.streams[0] : {};

                infoText += `🎥 *ANATOMI MEDIA (Video/Audio/GIF):*\n* Container: ${format.format_name || 'Unknow'}\n`;
                if (format.duration) infoText += `* Durasi: ${parseFloat(format.duration).toFixed(2)} detik\n`;
                if (format.size) infoText += `* Ukuran File: ${(format.size / 1024 / 1024).toFixed(2)} MB\n`;
                if (format.bit_rate) infoText += `* Total Bitrate: ${(format.bit_rate / 1000).toFixed(0)} kbps\n\n`;

                infoText += `⚙️ *DATA STREAM UTAMA:*\n`;
                if (stream.codec_name) infoText += `* Codec: ${stream.codec_name.toUpperCase()} (${stream.codec_long_name})\n`;
                if (stream.width) infoText += `* Resolusi: ${stream.width} x ${stream.height} px\n`;
                
                if (stream.r_frame_rate && stream.r_frame_rate !== '0/0') {
                    const fpsParts = stream.r_frame_rate.split('/');
                    const fps = (fpsParts.length === 2) ? (parseInt(fpsParts[0]) / parseInt(fpsParts[1])).toFixed(2) : stream.r_frame_rate;
                    infoText += `* Frame Rate: ${fps} FPS\n`;
                }

                return await ctx.reply(infoText);
            }
        } catch (err) {
            console.error("[INFO EXTRACT ERROR]", err);
            await ctx.reply("❌ Gagal membedah metadata.");
        }
    }
};

module.exports = mediaPlugin;
