const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios'); // 👈 Tambahkan axios untuk mengambil GIF Meta

// Fungsi khusus untuk membongkar semua lapisan (layer) pesan WhatsApp
function unwrapMessage(msgContent) {
    if (!msgContent) return msgContent;
    let content = msgContent;
    if (content.ephemeralMessage) content = content.ephemeralMessage.message;
    if (content.viewOnceMessage) content = content.viewOnceMessage.message;
    if (content.viewOnceMessageV2) content = content.viewOnceMessageV2.message;
    if (content.viewOnceMessageV2Extension) content = content.viewOnceMessageV2Extension.message;
    if (content.documentWithCaptionMessage) content = content.documentWithCaptionMessage.message;
    return content;
}

async function getMediaBuffer(msg, messageCache) {
    try {
        let mainMsgContent = unwrapMessage(msg.message);

        // 🌐 CEK APAKAH INI GIF DARI META / EXTERNAL AD REPLY
        const externalMediaUrl = mainMsgContent?.extendedTextMessage?.contextInfo?.externalAdReply?.mediaUrl ||
                                 mainMsgContent?.extendedTextMessage?.contextInfo?.externalAdReply?.thumbnailUrl;

        if (externalMediaUrl) {
            console.log(`[DOWNLOAD] Mendownload GIF Meta dari URL Eksternal: ${externalMediaUrl}`);
            const response = await axios.get(externalMediaUrl, { responseType: 'arraybuffer' });
            return { buffer: Buffer.from(response.data), type: 'video' };
        }

        const contextInfo = mainMsgContent?.extendedTextMessage?.contextInfo ||
                            mainMsgContent?.imageMessage?.contextInfo ||
                            mainMsgContent?.videoMessage?.contextInfo;

        const quotedMsgId = contextInfo?.stanzaId;

        let downloadTarget = msg;

        // Jika user melakukan REPLY (.)
        if (quotedMsgId) {
            if (messageCache && messageCache.has(quotedMsgId)) {
                console.log(`[CACHE HIT] Mengambil data pesan dari memori (ID: ${quotedMsgId})`);
                downloadTarget = messageCache.get(quotedMsgId);
            } else {
                console.log(`[CACHE MISS] Pesan tidak ada di memori, menggunakan fallback quoted...`);
                const quotedContent = contextInfo.quotedMessage;
                if (quotedContent) {
                    downloadTarget = {
                        key: {
                            remoteJid: msg.key.remoteJid,
                            id: quotedMsgId,
                            participant: contextInfo.participant
                        },
                        message: quotedContent
                    };
                } else {
                    throw new Error('Pesan asli tidak ditemukan.');
                }
            }
        }

        // Buka lapisan pesan target
        let finalContent = unwrapMessage(downloadTarget.message);

        // Debugging & Validasi
        if (!finalContent?.imageMessage && !finalContent?.videoMessage) {
            console.error('[DEBUG PAYLOAD]', JSON.stringify(finalContent, null, 2));
            throw new Error('Media tidak valid atau tersembunyi di dalam format yang tidak didukung.');
        }

        const mediaType = finalContent.imageMessage ? 'gambar' : 'video';

        // 📥 LOG STATUS DOWNLOAD DIMULAI
        console.log(`[DOWNLOAD] Memulai proses unduh ${mediaType}...`);

        const buffer = await downloadMediaMessage(
            downloadTarget,
            'buffer',
            {},
            { logger: pino({ level: 'silent' }) }
        );

        // ✅ LOG STATUS DOWNLOAD SELESAI
        console.log(`[DOWNLOAD SUCCESS] Berhasil mengunduh ${mediaType} (${(buffer.length / 1024).toFixed(2)} KB)`);

        return { buffer, type: mediaType };
    } catch (error) {
        console.error('[MEDIA HELPER ERROR]', error.message);
        throw error;
    }
}

module.exports = { getMediaBuffer, unwrapMessage };
