const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

// ==========================================
// 📦 IMPORT MODUL STICKER MAKER
// ==========================================
const { handleStickerCommand } = require('./src/sticker-maker/handlers/stickerHandler');
const { loadCache, saveCache } = require('./src/sticker-maker/utils/cacheManager');
const { unwrapMessage } = require('./src/sticker-maker/utils/mediaHelper');

// ==========================================
// 🎓 IMPORT MODUL USM BOT (Placeholder)
// ==========================================

const { handleUsmCommand } = require('./src/USM-bot/usmHandler');
// const USM_GROUP_ID = "1234567890-987654@g.us"; // ID Grup khusus notifikasi absen

// 🧠 Ingatan Memori Bot (Stiker)
const messageCache = loadCache();

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['USM-Sticker-Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('\n--- SCAN QR CODE DI BAWAH INI ---');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('\n========================================');
            console.log('🚀 Bot Akademik & Stiker Berhasil Terhubung!');
            console.log('========================================\n');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg || !msg.message || msg.key.fromMe) return;

        const targetJid = msg.key.remoteJid;
        const msgId = msg.key.id;

        // 🛑 FILTER JARINGAN BROADCAST
        if (targetJid && targetJid.includes('broadcast')) return;

        // ==========================================
        // 🎨 ROUTING 1: FITUR REAKSI EMOJI (STIKER)
        // ==========================================
        const reaction = msg.message.reactionMessage;
        if (reaction) {
            if (reaction.text === '🎨' || reaction.text === '🤖') {
                const targetMsgId = reaction.key.id;
                if (messageCache.has(targetMsgId)) {
                    console.log(`[TOMBOL REAKSI] Memproses gambar ID: ${targetMsgId}`);
                    const targetOriginalMsg = messageCache.get(targetMsgId);
                    await handleStickerCommand(sock, targetOriginalMsg, targetJid, messageCache);
                }
            }
            return;
        }

        // Buka lapisan pesan utama
        let messageContent = unwrapMessage(msg.message);
        const externalAd = messageContent?.extendedTextMessage?.contextInfo?.externalAdReply;

        // ==========================================
        // 💾 ROUTING 2: CACHE MEDIA (STIKER)
        // ==========================================
        if (messageContent?.imageMessage || messageContent?.videoMessage || externalAd) {
            messageCache.set(msgId, msg);
            if (messageCache.size > 100) messageCache.delete(messageCache.keys().next().value);
            saveCache(messageCache);
        }

        // ==========================================
        // 🚦 ROUTING 3: PEMILAH PERINTAH TEKS
        // ==========================================
        const caption = messageContent?.imageMessage?.caption ||
                        messageContent?.videoMessage?.caption ||
                        messageContent?.conversation ||
                        messageContent?.extendedTextMessage?.text || '';
        
        const textLower = caption.toLowerCase();
        
        const isStickerCmd = textLower.startsWith('.s') || textLower.startsWith('.sticker');

        if (textLower === 'ping') {
            await sock.sendMessage(targetJid, { text: `Pong! 🏓 Sistem aktif.` }, { quoted: msg });
            return;
        }

        if (isStickerCmd) {
            console.log(`[STIKER REQ] Permintaan stiker dari ${targetJid}`);
            await handleStickerCommand(sock, msg, targetJid, messageCache);
            return;
        }

        // SEMUA PESAN LAINNYA (Termasuk !login dan balasan NIM/Password) LEMPAR KE USM HANDLER
        console.log(`[USM REQ] Meneruskan pesan ke modul akademik dari ${targetJid}`);
        await handleUsmCommand(sock, msg, targetJid, textLower);
        return;
    });
}
connectToWhatsApp();