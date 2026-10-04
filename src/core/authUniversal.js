// src/core/authUniversal.js
const db = require('./database');
const sima = require('../plugins/sima/authConfig');
const elearning = require('../plugins/elearning/authConfig');

const loginSessions = new Map();
let providers = {
    '1': sima,
    '2': elearning
};

const authUniversal = {
    // Registrasi via Object Map
    initProviders: (providerMap) => {
        providers = providerMap;
    },

    // 1. TAMPILAN MENU UTAMA (STATUS DINAMIS)
    execute: async (ctx) => {
        if (ctx.isGroup) return await ctx.reply('⚠️ Perintah ini hanya untuk Chat Pribadi (DM).');

        const userDb = await db.getUserAuth(ctx.sender);
        loginSessions.set(ctx.sender, { step: 'MENU_SELECTION', data: {} });
        
        let menu = `🎓 *SISTEM LOGIN AKADEMIK* 🎓\n\n_Pilih sistem yang ingin dihubungkan:_\n\n`;
        
        // Loop Objek Provider secara Dinamis
        for (const [key, provider] of Object.entries(providers)) {
            const isActive = userDb && provider.checkAuth ? provider.checkAuth(userDb) : false;
            const statusIcon = isActive ? '✅ Aktif' : '❌ Kosong';
            
            menu += `*${key}.* ${provider.name} - [${statusIcon}]\n`;
        }
        
        menu += `\n_Balas angka untuk login (Ketik *batal* untuk keluar)_\n`;
        menu += `_Ketik *.logout [angka]* untuk menghapus akun._`;
                     
        await ctx.reply(menu);
    },

    // 2. PEMBAJAK RUTE (HIJACKER)
    handleHijack: async (ctx) => {
        const session = loginSessions.get(ctx.sender);
        const input = ctx.text.trim();

        if (input.toLowerCase() === 'batal') {
            loginSessions.delete(ctx.sender);
            return await ctx.reply("❌ Interaksi dibatalkan. Rute bot kembali normal.");
        }

        switch (session.step) {
            case 'MENU_SELECTION':
                if (providers[input]) {
                    const provider = providers[input];
                    session.step = 'COLLECTING_DATA';
                    session.providerKey = input;
                    session.promptIndex = 0; 
                    session.credentials = {}; 
                    
                    await ctx.reply(provider.prompts[0].text);
                } else {
                    await ctx.reply("⚠️ Pilihan tidak valid. Silakan ketik angka yang ada di menu.");
                }
                break;

            case 'COLLECTING_DATA':
                const provider = providers[session.providerKey];
                const pIndex = session.promptIndex;
                const currentPrompt = provider.prompts[pIndex];
                
                session.credentials[currentPrompt.key] = input;
                
                if (pIndex + 1 < provider.prompts.length) {
                    session.promptIndex++;
                    await ctx.reply(provider.prompts[session.promptIndex].text);
                } 
                else {
                    console.log(`\n[AUTH UNIVERSAL] 🔄 Kredensial lengkap untuk [${provider.id}]. Menembak API...`);
                    await ctx.reply(`⏳ Sedang mengautentikasi ke server... Mohon tunggu.`);
                    
                    const result = await provider.executeLogin(session.credentials);
                    
                    if (!result) {
                        console.warn(`[AUTH UNIVERSAL] ⚠️ Return value dari executeLogin adalah NULL (Koneksi Gagal/Rejected).`);
                    }

                    await provider.onSuccess(ctx.sender, session.credentials, result, ctx);
                    loginSessions.delete(ctx.sender); 
                }
                break;
        }
    },

    // 3. FUNGSI LOGOUT DINAMIS
    logout: async (ctx) => {
        const targetId = ctx.args[0]; 

        if (!targetId || !providers[targetId]) {
            return await ctx.reply("⚠️ Provider tidak ditemukan. Gunakan: *.logout [angka]*");
        }

        const provider = providers[targetId];
        
        // Panggil fungsi deleteAuth dari plugin jika ada
        if (provider.deleteAuth) {
            await provider.deleteAuth(ctx.sender);
        }

        await ctx.reply(`✅ Akun *${provider.name}* berhasil dihapus dari sistem (Logout).`);
    },

    isHijacked: (jid) => loginSessions.has(jid),

    // 4. AUTO RE-LOGIN DINAMIS
    autoRelogin: async (jid, providerId) => {
        const userDb = await db.getUserAuth(jid);
        if (!userDb) return false;

        // Cari provider berdasarkan ID string (misal: 'sima')
        const provider = Object.values(providers).find(p => p.id === providerId);
        if (!provider || !provider.checkAuth(userDb)) return false;

        // Re-login otomatis berdasarkan provider
        const credentials = provider.id === 'sima' 
            ? { username: userDb.sima_user, password: userDb.sima_pass }
            : { username: userDb.el_user, password: userDb.el_pass };

        const result = await provider.executeLogin(credentials);
        return await provider.onSuccess(jid, credentials, result, { reply: () => {} });
    }
};

module.exports = authUniversal;