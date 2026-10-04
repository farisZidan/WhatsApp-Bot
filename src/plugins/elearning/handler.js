// src/plugins/elearning/handler.js
const api = require('./api');

// Sub-fungsi khusus untuk menangani ".elearning list"
async function handleListCourses(ctx) {
    await ctx.reply("⏳ Sedang menyinkronkan data dengan server E-Learning...");

    try {
        // Karena route.auth = true di router, ctx.userAuth sudah berisi data dari database
        const token = ctx.userAuth?.el_moodle_token; 
        
        if (!token) {
            return await ctx.reply("❌ Token tidak ditemukan. Silakan login ulang via *.login*.");
        }

        // 1. Ambil ID User
        const siteInfo = await api.getSiteInfo(token);
        
        // 2. Ambil Daftar Matkul
        const courses = await api.getCourses(token, siteInfo.userid);

        if (!Array.isArray(courses) || courses.length === 0) {
            return await ctx.reply(`📚 *${siteInfo.fullname}*, kamu belum terdaftar di mata kuliah apapun semester ini.`);
        }

        // 3. Format Pesan
        let replyMsg = `📚 *DAFTAR MATA KULIAH*\n👤 ${siteInfo.fullname}\n\n`;
        courses.forEach((course, index) => {
            replyMsg += `*${index + 1}. ${course.fullname}*\n└ ID Matkul: ${course.id}\n\n`; 
        });

        await ctx.reply(replyMsg.trim());

    } catch (error) {
        if (error.message === 'TOKEN_INVALID') {
            await ctx.reply("❌ Sesi login E-Learning kedaluwarsa. Silakan login ulang via *.login*.");
        } else {
            console.error("[ELEARNING API ERROR]:", error.message);
            await ctx.reply("❌ Terjadi kesalahan saat menghubungi server E-Learning.");
        }
    }
}

// ==========================================
// 🎯 ENTRY POINT UNTUK ROUTER
// ==========================================
async function execute(ctx) {
    // Mengambil sub-command pertama (misal: "list" dari ".elearning list")
    const subCommand = ctx.args[0]?.toLowerCase();

    switch (subCommand) {
        case 'list':
            await handleListCourses(ctx);
            break;
            
        case 'cek':
            await ctx.reply("Fitur cek tugas sedang dibangun 🚀");
            break;
            
        default:
            // Tampilan menu default jika perintah tidak lengkap
            await ctx.reply(
                `📚 *MENU E-LEARNING & TUGAS*\n\n` +
                `Gunakan perintah berikut:\n` +
                `> *.elearning list* - Melihat daftar matkul\n` +
                `> *.tugas cek* - Memeriksa tugas terbaru`
            );
    }
}

module.exports = { execute };
