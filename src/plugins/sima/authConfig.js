// src/plugins/sima/authConfig.js
const db = require('../../core/database');

module.exports = {
    id: 'sima',
    name: '🏛️ SIMA (Absensi & Jadwal)',
    
    checkAuth: (userDb) => !!userDb?.sima_user,
    deleteAuth: async (jid) => await db.deleteAuth(jid, 'sima'),

    prompts: [
        { key: 'username', text: '🏛️ *LOGIN SIMA*\n\nTuliskan NIM kamu dengan format: _G.211.xx.xxx_' },
        { key: 'password', text: '🔑 Mantap. Sekarang kirimkan *Password SIMA* kamu:' }
    ],
    
    executeLogin: async (credentials) => {
        const url = "https://sima.usm.ac.id/index.php/api/login/sia";
        console.log(`\n[DEBUG LOGIN SIMA] 🌐 Memulai koneksi ke: ${url}`);
        const startTime = Date.now();

        try {
            // ==========================================
            // 🎯 KUNCI BYPASS: GUNAKAN USER-AGENT APLIKASI ANDROID
            // Ini akan menembus Cloudflare karena meniru aplikasi resmi SIMA
            // ==========================================
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 11)' 
                },
                body: JSON.stringify(credentials)
            });

            const duration = Date.now() - startTime;

            // Jika status HTTP bukan 2xx (misal 403 Forbidden / 503 Service Unavailable)
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[DEBUG LOGIN SIMA] ❌ Server Error HTTP ${response.status} (${duration}ms)`);
                
                if (errorText.includes('Just a moment') || errorText.includes('cloudflare')) {
                    console.error(`[DEBUG LOGIN SIMA] 🚨 CLOUDFLARE WAF MEMBLOKIR KONEKSI.`);
                } else {
                    console.error(`[DEBUG LOGIN SIMA] Data Error:`, errorText);
                }
                return null;
            }

            const responseData = await response.json(); 

            console.log(`[DEBUG LOGIN SIMA] ✅ HTTP Status: ${response.status} OK (${duration}ms)`);
            console.log(`[DEBUG LOGIN SIMA] 📄 Response Data:`, JSON.stringify(responseData, null, 2));

            return responseData; 

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[DEBUG LOGIN SIMA] 🌐 KONEKSI GAGAL/TIMEOUT: ${error.message} (${duration}ms)`);
            return null; 
        }
    },

    onSuccess: async (jid, credentials, result, ctx) => {
        // Cek apakah response JSON memiliki objek result dan token
        if (result && result.result?.token) {
            await db.saveSimaAuth(jid, credentials.username, credentials.password, result.result.token);
            await ctx.reply(`✅ *Login SIMA Berhasil!*\nHalo *${result.result.nama}*\n\n⚠️ _Segera hapus pesan passwordmu di atas._`);
            return true;
        }
        await ctx.reply(`❌ *Gagal Login SIMA:*\nKredensial salah atau respons server tidak valid.`);
        return false;
    }
};
