// src/plugins/elearning/handler.js
const api = require('./api');
const db = require('../../core/database');
const taskService = require('./taskService');

async function handleListCourses(ctx) {
    await ctx.reply("⏳ Sedang menyinkronkan data dengan server E-Learning...");

    try {
        const token = ctx.userAuth?.el_moodle_token; 
        if (!token) return await ctx.reply("❌ Token tidak ditemukan. Silakan login ulang via *.login*.");

        const siteInfo = await api.getSiteInfo(token);
        const courses = await api.getCourses(token, siteInfo.userid);

        if (!Array.isArray(courses) || courses.length === 0) {
            return await ctx.reply(`📚 *${siteInfo.fullname}*, kamu belum terdaftar di mata kuliah apapun.`);
        }

        let replyMsg = `📚 *DAFTAR MATA KULIAH*\n👤 ${siteInfo.fullname}\n\n`;
        courses.forEach((course, index) => {
            replyMsg += `*${index + 1}. ${course.fullname}*\n└ ID Matkul: ${course.id}\n\n`; 
        });

        await ctx.reply(replyMsg.trim());

    } catch (error) {
        if (error.message === 'TOKEN_INVALID') {
            await ctx.reply("❌ Sesi login kedaluwarsa. Silakan login ulang via *.login*.");
        } else {
            await ctx.reply("❌ Terjadi kesalahan saat menghubungi server E-Learning.");
        }
    }
}

async function handleCheckTasks(ctx) {
    await ctx.reply("⏳ Memeriksa tugas terbaru dari E-Learning...");

    try {
        const token = ctx.userAuth?.el_moodle_token;
        if (!token) return await ctx.reply("❌ Silakan login via *.login* terlebih dahulu.");

        // Synchronize Moodle -> Local DB
        await taskService.syncUserTasks(ctx.sender, token);

        // Fetch pending tasks from DB
        const pendingTasks = await db.getPendingAssignments(ctx.sender);
        const responseText = taskService.formatTaskList(pendingTasks);

        await ctx.reply(responseText);

    } catch (error) {
        console.error("[CHECK TASK ERROR]:", error);
        await ctx.reply("❌ Gagal memperbarui data tugas.");
    }
}

async function handleCompleteTask(ctx) {
    const taskId = ctx.args[1];
    if (!taskId) {
        return await ctx.reply("⚠️ Format salah! Sertakan ID Tugas.\nContoh: `.tugas selesai 5`");
    }

    await db.markAssignmentCompleted(ctx.sender, taskId);
    await ctx.reply(`✅ Tugas dengan ID \`${taskId}\` berhasil ditandai selesai dan dihapus dari daftar peringatan.`);
}

// ==========================================
// ENTRY POINT UNTUK ROUTER
// ==========================================
async function execute(ctx) {
    const subCommand = ctx.args[0]?.toLowerCase();

    switch (subCommand) {
        case 'list':
            await handleListCourses(ctx);
            break;
            
        case 'cek':
            await handleCheckTasks(ctx);
            break;

        case 'selesai':
        case 'centang':
            await handleCompleteTask(ctx);
            break;
            
        default:
            await ctx.reply(
                `📚 *MENU E-LEARNING & TUGAS*\n\n` +
                `Gunakan perintah berikut:\n` +
                `> *.elearning list* - Daftar mata kuliah\n` +
                `> *.tugas cek* - Memeriksa semua tugas tertunda\n` +
                `> *.tugas selesai <ID>* - Menandai tugas sudah dikerjakan`
            );
    }
}

module.exports = { execute };