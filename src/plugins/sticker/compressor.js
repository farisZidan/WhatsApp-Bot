// sticker/compressor.js

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');

const execPromise = util.promisify(exec);
const MAX_STICKER_SIZE = 800 * 1024;

// Profil bertahap untuk menjaga kualitas setinggi mungkin
const COMPRESSION_PROFILES = [
    { fps: 15, q: 60, name: "Optimal Sultan" },
    { fps: 12, q: 40, name: "Optimal Menengah" },
    { fps: 10, q: 25, name: "Optimal Standar" },
    { fps: 8,  q: 12, name: "Mode Bertahan Hidup" }
];

async function compressVideoToSticker(videoBuffer) {
    const tmpDir = path.join(__dirname, '../tmp'); 
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const filename = crypto.randomBytes(6).toString('hex');
    const rawInputPath = path.join(tmpDir, `${filename}_raw.mp4`);
    const outputPath = path.join(tmpDir, `${filename}.webp`);

    fs.writeFileSync(rawInputPath, videoBuffer);
    let finalWebpBuffer = null;

    try {
        for (let i = 0; i < COMPRESSION_PROFILES.length; i++) {
            const profile = COMPRESSION_PROFILES[i];
            console.log(`[FFMPEG PRO] Coba Profil: ${profile.name} (FPS: ${profile.fps}, Q: ${profile.q})...`);

            const webpCommand = `ffmpeg -i "${rawInputPath}" -an -vcodec libwebp -vf "fps=${profile.fps},scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000@0.0" -lossless 0 -compression_level 6 -q:v ${profile.q} -loop 0 -preset picture -pix_fmt yuva420p -t 00:00:10 "${outputPath}" -y`;

            await execPromise(webpCommand);
            const stats = fs.statSync(outputPath);
            const fileSizeKB = (stats.size / 1024).toFixed(2);

            if (stats.size <= MAX_STICKER_SIZE) {
                console.log(`[FFMPEG SUCCESS] Lolos dengan ${profile.name}! Final Size: ${fileSizeKB} KB`);
                finalWebpBuffer = fs.readFileSync(outputPath);
                break;
            } else {
                console.log(`[FFMPEG REJECT] Ukuran ${fileSizeKB} KB masih di atas limit, menyesuaikan...`);
            }
        }
    } catch (error) {
        console.error('[FFMPEG FATAL ERROR]', error.message);
        throw new Error('Gagal memproses video. Pastikan format video didukung.');
    } finally {
        if (fs.existsSync(rawInputPath)) fs.unlinkSync(rawInputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }

    if (!finalWebpBuffer) {
        throw new Error('Video terlalu kompleks. Coba gunakan durasi yang lebih pendek.');
    }

    return finalWebpBuffer;
}

module.exports = { compressVideoToSticker };