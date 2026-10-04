const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const normalizer = require('./src/core/normalizer');
const router = require('./src/core/router');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    const sock = makeWASocket({
        auth: state,
        // printQRInTerminal: true, // 2. HAPUS atau komen baris ini agar peringatannya hilang
    });

    sock.ev.on('creds.update', saveCreds);

    // ==========================================
    // 3. TAMBAHKAN LISTENER KONEKSI DI SINI
    // ==========================================
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Jika Baileys mengirimkan string QR, cetak ke terminal
        if (qr) {
            console.log('\nScan QR Code di bawah ini menggunakan WhatsApp-mu:');
            qrcode.generate(qr, { small: true }); 
        }

        // Pantau status koneksi
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
            console.log('Koneksi terputus! Reconnecting:', shouldReconnect);
            // Jika error bukan karena logout (401), coba restart bot
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ Bot berhasil terhubung ke WhatsApp!');
        }
    });

    // EVENT LISTENER UTAMA (Pesan Masuk)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Abaikan pesan jika bukan pesan baru
        if (type !== 'notify') return;
        
        const m = messages[0];
        if (!m.message) return; // Abaikan pesan kosong

        try {
            // 1. Lewatkan ke Light Normalizer
            const ctx = await normalizer.buildContext(sock, m);
            if (!ctx) return; // Abaikan jika ditarik/dihapus

            // 2. Lempar ke Router O(1)
            await router.handleMessage(ctx);
            
        } catch (error) {
            console.error("Gagal memproses pesan:", error);
        }
    });
}

startBot();