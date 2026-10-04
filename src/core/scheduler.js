// src/core/scheduler.js
const cron = require('node-cron');

class SystemScheduler {
    constructor() {
        this.tasks = [];
    }

    _getRandomJitterMs(minMinutes, maxMinutes) {
        const min = minMinutes * 60 * 1000;
        const max = maxMinutes * 60 * 1000;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Mendaftarkan task dari plugin mana saja
     * @param {string} cronExpression - Format waktu Cron
     * @param {string} taskName - Nama task untuk logging
     * @param {function} callback - Fungsi yang akan dieksekusi
     * @param {object} options - Konfigurasi tambahan (jitterMin, jitterMax)
     */
    register(cronExpression, taskName, callback, options = {}) {
        const { jitterMin = 0, jitterMax = 0 } = options;

        const task = cron.schedule(cronExpression, () => {
            if (jitterMax > 0) {
                const delayMs = this._getRandomJitterMs(jitterMin, jitterMax);
                console.log(`[SCHEDULER] ⏰ Trigger [${taskName}]. Menunggu jitter ${(delayMs / 1000 / 60).toFixed(2)} menit...`);
                
                setTimeout(async () => {
                    console.log(`[SCHEDULER] 🚀 Mengeksekusi [${taskName}]`);
                    await callback();
                }, delayMs);
            } else {
                console.log(`[SCHEDULER] 🚀 Mengeksekusi [${taskName}]`);
                callback();
            }
        }, { scheduled: false }); // Jangan langsung jalan saat didaftarkan

        this.tasks.push({ name: taskName, task });
        console.log(`[SCHEDULER] 📝 Task diregistrasi: ${taskName} (${cronExpression})`);
    }

    /**
     * Memulai seluruh task yang sudah didaftarkan oleh plugin
     */
    startAll() {
        console.log(`[SCHEDULER] ▶️ Memulai ${this.tasks.length} task terjadwal...`);
        this.tasks.forEach(t => t.task.start());
    }
}

module.exports = new SystemScheduler(); // Export sebagai Singleton