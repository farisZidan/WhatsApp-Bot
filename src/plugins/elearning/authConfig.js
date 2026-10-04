// src/plugins/elearning/authConfig.js
const axios = require('axios');
const db = require('../../core/database');

module.exports = {
    id: 'elearning',
    name: '📚 E-Learning (Course)',
    
    checkAuth: (userDb) => !!userDb?.el_user,
    deleteAuth: async (jid) => await db.deleteAuth(jid, 'elearning'),

    prompts: [
        { key: 'username', text: '📚 *LOGIN E-LEARNING*\n\nTuliskan Username/NIM kamu dengan format: _g211xxxxxx_' },
        { key: 'password', text: '🔑 Bagus. Sekarang kirimkan *Password E-Learning* kamu:' }
    ],
    
    executeLogin: async (credentials) => {
        const url = "https://elearning.usm.ac.id/login/token.php";
        console.log(`\n[DEBUG LOGIN ELEARNING] 🌐 Memulai koneksi ke: ${url}`);
        const startTime = Date.now();

        try {
            // ==========================================
            // 🎯 PENYAMARAN APLIKASI MOODLE ASLI
            // Menggunakan header persis seperti aplikasi Android Moodle
            // ==========================================
            const moodleRes = await axios({
                method: 'PATCH',
                url: url,
                params: { 
                    username: credentials.username, 
                    password: credentials.password, 
                    service: 'moodle_mobile_app'
                },
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.196 Mobile Safari/537.36 MoodleMobile',
                    'X-Requested-With': 'com.moodle.moodlemobile',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Connection': 'keep-alive'
                },
                timeout: 10000 
            });

            const duration = Date.now() - startTime;
            console.log(`[DEBUG LOGIN ELEARNING] ✅ HTTP Status: ${moodleRes.status} OK (${duration}ms)`);
            console.log(`[DEBUG LOGIN ELEARNING] 📄 Response Data:`, JSON.stringify(moodleRes.data, null, 2));

            // Simulasi Web Scraper Fallback
            const webExpires = Date.now() + (15 * 60 * 1000); 
            const webRes = { webToken: "SESSID_SIMULASI", expires: webExpires };
            
            return { moodle: moodleRes.data, web: webRes };
            
        } catch (error) {
            const duration = Date.now() - startTime;

            if (error.response) {
                console.error(`[DEBUG LOGIN ELEARNING] ❌ Server Error HTTP ${error.response.status} (${duration}ms)`);
                if (typeof error.response.data === 'string' && error.response.data.includes('Just a moment')) {
                     console.error(`[DEBUG LOGIN ELEARNING] 🚨 CLOUDFLARE WAF MEMBLOKIR KONEKSI.`);
                } else {
                     console.error(`[DEBUG LOGIN ELEARNING] Data Error:`, error.response.data);
                }
            } else if (error.request) {
                console.error(`[DEBUG LOGIN ELEARNING] 🌐 KONEKSI GAGAL: E-Learning tidak merespons / Timeout (${duration}ms)`);
                console.error(`[DEBUG LOGIN ELEARNING] Kode Error: ${error.code || 'UNKNOWN_NET_ERROR'}`);
            } else {
                console.error(`[DEBUG LOGIN ELEARNING] ⚠️ Internal Code Error: ${error.message}`);
            }
            return null; 
        }
    },

    onSuccess: async (jid, credentials, result, ctx) => {
        if (result && result.moodle?.token) {
            await db.saveElearningAuth(jid, credentials.username, credentials.password, result.moodle.token, result.web.webToken, result.web.expires);
            await ctx.reply(`✅ *Login E-Learning Berhasil!*\nToken tersimpan dengan aman.\n\n⚠️ _Segera hapus pesan passwordmu di atas._`);
            return true;
        }
        await ctx.reply(`❌ *Gagal Login E-Learning:*\nUsername/Password salah atau server E-learning sedang bermasalah.`);
        return false;
    }
};
