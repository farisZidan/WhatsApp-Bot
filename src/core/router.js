// src/core/router.js
const authPlugin = require('./authUniversal');
const stickerPlugin = require('../plugins/sticker/handler');
const mediaPlugin = require('../plugins/media/handler');
const elearningPlugin = require('../plugins/elearning/handler');

const adminWhitelist = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim());

// RUTE UNTUK COMMAND TEKS
const commandRoutes = {
    's': { handler: stickerPlugin.execute, auth: false, scope: 'all' },
    'sticker': { handler: stickerPlugin.execute, auth: false, scope: 'all' },

    'save': { handler: mediaPlugin.saveMedia, auth: false, scope: adminWhitelist },
    'ambil': { handler: mediaPlugin.saveMedia, auth: false, scope: adminWhitelist },

    'burik': { handler: mediaPlugin.downgradeMedia, auth: false, scope: 'all' },
    'rusak': { handler: mediaPlugin.downgradeMedia, auth: false, scope: 'all' },
    
    'info': { handler: mediaPlugin.extractInfo, auth: false, scope: 'all' },
    'exif': { handler: mediaPlugin.extractInfo, auth: false, scope: 'all' },

    'login': { handler: authPlugin.execute, auth: false, scope: 'private' },
    'logout': { handler: authPlugin.logout, auth: false, scope: 'private' },

    // Rute E-Learning & Tugas
    'elearning': { handler: elearningPlugin.execute, auth: true, scope: 'all' },
    'tugas': { handler: elearningPlugin.execute, auth: true, scope: 'all' },
};

// RUTE KHUSUS UNTUK REACTION
const reactionRoutes = {
    '🖼️': { handler: stickerPlugin.execute, auth: false, scope: 'all' },
    '🎨': { handler: stickerPlugin.execute, auth: false, scope: 'all' },
    '🔥': { handler: mediaPlugin.saveMedia, auth: false, scope: adminWhitelist }
};

async function handleMessage(ctx) {
    if (ctx.text.toLowerCase() === "ping") {
        return await ctx.reply("Pong!");
    }

    // STATE CHECKER
    if (authPlugin.isHijacked(ctx.sender)) {
        return await authPlugin.handleHijack(ctx); 
    }

    let route = null;
    let commandName = ''; 

    if (ctx.isReaction) {
        const cleanEmoji = ctx.reactionEmoji?.replace(/\uFE0F/g, '');
        route = reactionRoutes[cleanEmoji];
        commandName = `Reaction [${cleanEmoji}]`;
    } 
    else if (ctx.text.startsWith('.')) {
        const [cmd, ...args] = ctx.text.slice(1).trim().split(/ +/);
        commandName = cmd.toLowerCase();
        route = commandRoutes[commandName];
        ctx.args = args; 
    }

    if (!route) return; 

    // ==========================================
    // 🛡️ FILTER CAKUPAN (SCOPE LAYER)
    // ==========================================
    const scope = route.scope || 'all'; 

    if (Array.isArray(scope)) {
        const isFromMe = ctx.raw.key.fromMe; 
        
        // Cek whitelisting terhadap ID Chat maupun ID Sender
        const isWhitelisted = isFromMe || scope.includes(ctx.chat) || scope.includes(ctx.sender);

        if (!isWhitelisted) {
            return; // SILENT DROP
        }
    } else {
        switch (scope) {
            case 'private':
                if (ctx.isGroup) return await ctx.reply("⚠️ Perintah ini hanya bisa digunakan melalui Chat Pribadi (DM).");
                break;
            case 'group':
                if (!ctx.isGroup) return await ctx.reply("⚠️ Perintah ini hanya bisa digunakan di dalam Grup.");
                break;
            case 'all':
            default:
                break;
        }
    }

    // ==========================================
    // MIDDLEWARE AUTH (DATABASE)
    // ==========================================
    if (route.auth) {
        // 🎯 BERSIH & RAPI: ctx.sender dijamin berisi JID individu asli pengirim
        const userDb = await require('./database').getUserAuth(ctx.sender);
        
        if (!userDb) {
            if (!ctx.isReaction) {
                return await ctx.reply("❌ Kamu belum terdaftar. Silakan ketik *.login* melalui Chat Pribadi (DM) terlebih dahulu.");
            }
            return;
        }
        ctx.userAuth = userDb; 
    }

    // ==========================================
    // EKSEKUSI FINAL
    // ==========================================
    try {
        await route.handler(ctx);
    } catch (err) {
        console.error(`[Command Error ${commandName}]:`, err);
        if (!ctx.isReaction) {
            await ctx.reply("Terjadi kesalahan internal saat memproses perintah.");
        }
    }
}

module.exports = { handleMessage };
