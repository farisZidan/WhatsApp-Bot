const { saveSimaData, saveElearningApiData } = require('./database');
const { loginSima } = require('./sima/simaAuth');
const { loginMoodleApi } = require('./elearning/moodleAuth');

const loginSessions = new Map();

async function handleUsmCommand(sock, msg, targetJid, textLower) {
    const isGroup = targetJid.endsWith('@g.us');

    const rawInput = msg.message?.conversation || 
                     msg.message?.extendedTextMessage?.text || 
                     msg.message?.imageMessage?.caption || '';

    // 🛑 CEGAH LOGIN DI GRUP
    if (isGroup && (textLower === '!login' || loginSessions.has(targetJid))) {
        await sock.sendMessage(targetJid, { text: '⚠️ Demi keamanan privasi, perintah !login hanya bisa dilakukan via Chat Pribadi (DM).' }, { quoted: msg });
        return;
    }

    // ==========================================
    // 🚪 PINTU MASUK: PERINTAH !LOGIN
    // ==========================================
    if (!isGroup && textLower === '!login') {
        loginSessions.set(targetJid, { step: 'AWAITING_SYSTEM_CHOICE' });
        
        const menuText = `🎓 *SISTEM LOGIN AKADEMIK* 🎓\n\n` +
                         `Sistem apa yang ingin kamu hubungkan dengan bot?\n` +
                         `*1.* 🏛️ SIMA (Absensi & Jadwal)\n` +
                         `*2.* 📚 E-learning (Tugas & Materi)\n\n` +
                         `_Balas dengan angka *1* atau *2*_`;
                         
        await sock.sendMessage(targetJid, { text: menuText });
        return;
    }

    // ==========================================
    // 🔄 STATE MACHINE (ALUR LOGIN MULTI-SISTEM)
    // ==========================================
    if (!isGroup && loginSessions.has(targetJid)) {
        const session = loginSessions.get(targetJid);
        const input = rawInput.trim();
        
        if (!input) return;

        // LANGKAH 1: MENERIMA PILIHAN SISTEM (1 atau 2)
        if (session.step === 'AWAITING_SYSTEM_CHOICE') {
            if (input === '1') {
                session.systemType = 'SIMA';
                session.step = 'AWAITING_USERNAME';
                loginSessions.set(targetJid, session);
                await sock.sendMessage(targetJid, { text: '🏛️ *LOGIN SIMA*\n\nSilakan balas dengan *NIM* kamu:' });
            } else if (input === '2') {
                session.systemType = 'ELEARNING';
                session.step = 'AWAITING_USERNAME';
                loginSessions.set(targetJid, session);
                await sock.sendMessage(targetJid, { text: '📚 *LOGIN E-LEARNING*\n\nSilakan balas dengan *Username / NIM* kamu:' });
            } else {
                await sock.sendMessage(targetJid, { text: '⚠️ Pilihan tidak valid. Silakan balas dengan angka *1* atau *2*.' });
            }
            return;
        }

        // LANGKAH 2: MENERIMA USERNAME / NIM
        if (session.step === 'AWAITING_USERNAME') {
            session.username = input;
            session.step = 'AWAITING_PASS';
            loginSessions.set(targetJid, session);
            
            await sock.sendMessage(targetJid, { text: `🔑 Mantap. Sekarang balas dengan *Password ${session.systemType}* kamu:` });
            return;
        }

        // LANGKAH 3: MENERIMA PASSWORD & EKSEKUSI API
        if (session.step === 'AWAITING_PASS') {
            const password = input;
            const username = session.username;
            const systemType = session.systemType;
            
            loginSessions.delete(targetJid); // Bersihkan sesi agar tidak nyangkut
            await sock.sendMessage(targetJid, { text: `⏳ Mengautentikasi ke server ${systemType}...` });

            // 🔀 PERCABANGAN LOGIKA BERDASARKAN SISTEM
            if (systemType === 'SIMA') {
                const responseData = await loginSima(username, password);
                
                if (responseData && responseData.result?.token) {
                    await saveSimaData(targetJid, username, password, responseData.result.token, responseData.result.nama);
                    await sock.sendMessage(targetJid, { text: `✅ *Login SIMA Berhasil!*\n\nSelamat datang, *${responseData.result.nama}*.\n\n⚠️ _Segera hapus pesan passwordmu di atas!_` });
                } else {
                    const errorMsg = responseData?.message || "Kredensial salah atau server menolak.";
                    await sock.sendMessage(targetJid, { text: `❌ *Gagal Login SIMA:*\n${errorMsg}` });
                }

            } else if (systemType === 'ELEARNING') {
                const responseData = await loginMoodleApi(username, password);
                
                if (responseData && responseData.token) {
                    await saveElearningApiData(targetJid, username, password, responseData.token, responseData.privatetoken);
                    await sock.sendMessage(targetJid, { text: `✅ *Login E-learning Berhasil!*\n\nSistem berhasil mendapatkan akses token Moodle API.\n\n⚠️ _Segera hapus pesan passwordmu di atas!_` });
                } else {
                    const errorMsg = responseData?.error || "Kredensial salah atau token ditolak.";
                    await sock.sendMessage(targetJid, { text: `❌ *Gagal Login E-learning:*\n${errorMsg}` });
                }
            }
            return;
        }
    }
}

module.exports = { handleUsmCommand };