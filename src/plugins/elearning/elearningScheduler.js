// src/plugins/elearning/elearningScheduler.js
const scheduler = require('../../core/scheduler');
const db = require('../../core/database');
const taskService = require('./taskService');

function initElearningTasks(sock) {
    // -------------------------------------------------------------
    // 1. PENGECEKAN TUGAS BARU (06:00 - 22:00 tiap 2 jam, Jitter 1-8 mnt)
    // -------------------------------------------------------------
    scheduler.register('0 6-22/2 * * *', 'Elearning: Cek Tugas Baru', async () => {
        const users = await db.getAllElearningUsers();

        for (const user of users) {
            const newTasks = await taskService.syncUserTasks(user.jid, user.el_moodle_token);
            
            if (newTasks.length > 0) {
                let alertMsg = `📢 *TUGAS BARU DITEMUKAN!*\n\n`;
                newTasks.forEach(t => {
                    alertMsg += `📌 *${t.name}*\n└ 📚 ${t.course?.fullname}\n└ 📅 Deadline: ${taskService.formatDate(t.timesort)}\n\n`;
                });
                alertMsg += `_Gunakan \`.tugas cek\` untuk melihat seluruh daftar._`;

                await sock.sendMessage(user.jid, { text: alertMsg });
            }
        }
    }, { jitterMin: 1, jitterMax: 8 });

    // -------------------------------------------------------------
    // 2. NOTIFIKASI RUTIN PAGI & SORE (06:00 & 18:00, Jitter 1-5 mnt)
    // -------------------------------------------------------------
    scheduler.register('0 6,18 * * *', 'Elearning: Notifikasi Rutin', async () => {
        const users = await db.getAllElearningUsers();

        for (const user of users) {
            await taskService.syncUserTasks(user.jid, user.el_moodle_token);
            const pendingTasks = await db.getPendingAssignments(user.jid);

            if (pendingTasks.length > 0) {
                const text = taskService.formatTaskList(pendingTasks, "🔔 *RINGKASAN TUGAS RUTIN*");
                await sock.sendMessage(user.jid, { text });
            }
        }
        await db.cleanupCompletedAssignments();
    }, { jitterMin: 1, jitterMax: 5 });

    // -------------------------------------------------------------
    // 3. MONITOR DEADLINE < 3 JAM (Tiap 15 Menit, Tanpa Jitter)
    // -------------------------------------------------------------
    scheduler.register('*/15 * * * *', 'Elearning: Monitor Urgent', async () => {
        const urgentTasks = await db.getAssignmentsNearDeadline();

        for (const task of urgentTasks) {
            const alertText = 
                `🚨 *PERINGATAN DEADLINE (< 3 JAM)!*\n\n` +
                `📌 *${task.title}*\n` +
                `├ 📚 Matkul: ${task.course_name}\n` +
                `└ ⏰ Deadline: ${taskService.formatDate(task.deadline)}\n\n` +
                `Segera selesaikan tugas ini sebelum ditutup!`;

            await sock.sendMessage(task.jid, { text: alertText });
            await db.mark3hNotified(task.id);
        }
    }); // Tanpa parameter jitter
}

module.exports = { initElearningTasks };