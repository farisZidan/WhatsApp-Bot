// src/plugins/elearning/taskService.js
const api = require('./api');
const db = require('../../core/database');

// Unix timestamp acuan awal semester (Contoh: 1 Februari 2026 / Sesuaikan)
const SEMESTER_START_TIMESTAMP = Math.floor(new Date('2026-02-01T00:00:00').getTime() / 1000);

/**
 * Sinkronisasi tugas Moodle user ke Database lokal
 * Returns: Array dari tugas-tugas BARU yang ditemukan
 */
async function syncUserTasks(jid, token) {
    try {
        const result = await api.getActionEvents(token, SEMESTER_START_TIMESTAMP);
        const events = result?.events || [];
        const newTasks = [];

        for (const event of events) {
            // Abaikan course yang disembunyikan
            if (event.course?.hidden) continue;

            const isNew = await db.upsertAssignment(jid, event);
            if (isNew) {
                newTasks.push(event);
            }
        }

        return newTasks;
    } catch (error) {
        console.error(`[TASK SYNC ERROR] JID ${jid}:`, error.message);
        return [];
    }
}

/**
 * Format timestamp ke format string Indonesia
 */
function formatDate(unixTimestamp) {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta'
    });
}

/**
 * Menyusun daftar tugas menjadi pesan siap kirim
 */
function formatTaskList(tasks, titleHeader = "📌 *DAFTAR TUGAS BELUM SELESAI*") {
    if (!tasks || tasks.length === 0) {
        return `✅ *Semua Tugas Selesai!*\nTidak ada penugasan tertunda saat ini.`;
    }

    const now = Math.floor(Date.now() / 1000);
    let msg = `${titleHeader}\n\n`;

    tasks.forEach((task, idx) => {
        const isOverdue = task.deadline < now;
        const statusBadge = isOverdue ? "⚠️ *[TERLEWAT DEADLINE]*" : "⏳ *[MENDATANG]*";
        
        msg += `*${idx + 1}. ${task.title}*\n`;
        msg += `├ 📚 Matkul: ${task.course_name}\n`;
        msg += `├ 📅 Deadline: ${formatDate(task.deadline)}\n`;
        msg += `├ 🔴 Status: ${statusBadge}\n`;
        msg += `└ 🆔 ID Tugas: \`${task.id}\`\n\n`;
    });

    msg += `💡 _Ketik \`.tugas selesai <ID>\` jika tugas sudah kamu kerjakan._`;
    return msg.trim();
}

module.exports = {
    SEMESTER_START_TIMESTAMP,
    syncUserTasks,
    formatDate,
    formatTaskList
};