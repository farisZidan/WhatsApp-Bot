// src/plugins/media/destroyer.js
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const hasAudioStream = (filePath) => {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) return resolve(false);
            const hasAudio = data.streams.some(s => s.codec_type === 'audio');
            resolve(hasAudio);
        });
    });
};

async function destroyMedia(buffer, type, level, isAnimated = false) {
    let extIn = type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : type === 'sticker' ? (isAnimated ? 'gif' : 'png') : 'jpg';
    
    let extOut = 'jpg';
    switch (type) {
        case 'image': extOut = 'jpg'; break;
        case 'video': extOut = 'mp4'; break;
        case 'audio': extOut = 'mp3'; break;
        case 'sticker': extOut = isAnimated ? 'gif' : 'png'; break;
        default: extOut = 'jpg';
    }

    if (type === 'sticker') {
        try {
            if (isAnimated) {
                const tempWebp = path.join(os.tmpdir(), `temp_im_in_${Date.now()}.webp`);
                const tempGif = path.join(os.tmpdir(), `temp_im_out_${Date.now()}.gif`);
                
                fs.writeFileSync(tempWebp, buffer); 
                
                const imCommand = process.platform === 'win32' 
                    ? `magick "${tempWebp}" "${tempGif}"` 
                    : `convert "${tempWebp}" "${tempGif}"`;
                
                await new Promise((resolve, reject) => {
                    exec(imCommand, (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
                
                buffer = fs.readFileSync(tempGif);
                if (fs.existsSync(tempWebp)) fs.unlinkSync(tempWebp);
                if (fs.existsSync(tempGif)) fs.unlinkSync(tempGif);
            } else {
                buffer = await sharp(buffer).png().toBuffer();
            }
        } catch (err) {
            console.error("❌ Gagal mendekode WebP:", err.message);
            throw err;
        }
    }

    const tempIn = path.join(os.tmpdir(), `in_destroy_${Date.now()}.${extIn}`);
    const tempOut = path.join(os.tmpdir(), `out_destroy_${Date.now()}.${extOut}`);

    fs.writeFileSync(tempIn, buffer);
    const hasAudio = type === 'audio' || (type === 'video' && await hasAudioStream(tempIn));

    return new Promise((resolve, reject) => {
        let command = ffmpeg(tempIn);
        if (type === 'audio') command.noVideo(); 
        const isVideoProcess = type === 'video' || (type === 'sticker' && isAnimated);

        // ==========================================
        // 🎯 1. SISTEM TIER VISUAL (DISTRIBUSI BARU)
        // ==========================================
        if (type === 'image' || type === 'video' || type === 'sticker') {
            
            // Resolusi menyusut lebih perlahan untuk mengakomodasi rentang level 1-100 yang diperlebar
            let baseWidth = Math.floor(380 - (level * 2.5));
            baseWidth = Math.max(64, baseWidth % 2 === 0 ? baseWidth : baseWidth - 1);
            const scaleFactor = Math.max(1, Math.floor(level / 25)); 
            
            // Gaussian Blur perlahan menebal mengikuti level
            let blurSigma = Math.min(2.5, 0.2 + (level / 40)); 
            let vf = `scale=${baseWidth}:-2:flags=bilinear,gblur=sigma=${blurSigma},scale=iw*${scaleFactor}:ih*${scaleFactor}:flags=neighbor`;

            // Evolusi Warna (3 Segmen Baru)
            if (level < 40) {
                // TIER 1 (Lvl 1 - 39): Blur dan kusam 3GP 
                let sat = Math.max(0.2, 1.0 - (level / 40)); 
                vf += `,eq=saturation=${sat}:contrast=1.1:gamma=0.9`;
            
            } else if (level < 75) {
                // TIER 2 (Lvl 40 - 74): Penurunan menuju Kegelapan Peat (Abyss)
                let darken = (level - 40) / 34; // Rasio kedalaman dari 0.0 ke 1.0 (sepanjang 35 level)
                let brightness = -0.1 - (darken * 0.85); // Level 74 akan menyentuh -0.95 (Sangat hitam)
                vf += `,eq=brightness=${brightness.toFixed(2)}:saturation=0.4:contrast=1.3`;
            
            } else {
                // TIER 3 (Lvl 75 - 100+): Merah menyebar, hitam tetap jelas, kontras ideal
                // rs (red shadow) ditarik sedikit agar bagian gelap ada bias merah
                // rm (red midtones) lebih dominan untuk menyebar warna merah
                // rh (red highlights) agar area putih tidak terlalu murni
                vf += `,hue=s=0,eq=brightness=-0.1:contrast=1.6,colorbalance=rs=0.3:rm=0.6:rh=0.3,noise=alls=${Math.floor(level/4)}:allf=t+u`;
            }

            if (type === 'sticker') vf += `,format=rgba`;
            else vf += `,format=yuv420p`;
            
            command.videoFilters(vf);

            if (type === 'video') {
                let crfValue = Math.min(51, 32 + Math.floor(level / 2)); 
                command.outputOptions([
                    '-vcodec', 'libx264', 
                    '-profile:v', 'baseline',
                    '-preset', 'ultrafast',
                    `-crf`, `${crfValue}`
                ]);
                command.fps(Math.max(4, 20 - Math.floor(level / 5))); 
            } else if (isVideoProcess) {
                command.fps(Math.max(4, 20 - Math.floor(level / 5)));
                command.outputOptions(['-loop', '0']); 
            } else if (type === 'image') {
                command.outputOptions(['-q:v', String(Math.max(1, Math.floor(level / 2.5)))]);
            }
        }

        // ==========================================
        // 📢 2. SISTEM TIER AUDIO (MENYESUAIKAN VISUAL)
        // ==========================================
        if (hasAudio) {
            let af = "";
            if (level < 40) {
                // Tier 1 (1 - 39): Esia Hidayah / Cempreng ringan
                af = `acrusher=level_in=1.2:level_out=1.0:bits=6,highpass=f=300,lowpass=f=3000`;
            } else if (level < 75) {
                // Tier 2 (40 - 74): Suara kedalaman air gelap (muffled & echo)
                af = `lowpass=f=700,aecho=0.8:0.9:300|500:0.4|0.2,tremolo=f=4:d=0.6,acrusher=level_in=1.5:level_out=1:bits=5,volume=1.5`;
            } else {
                // Tier 3 (75 - 100+): Merah, lengkingan noise / ear-rape
                af = `highpass=f=1200,acrusher=level_in=4:level_out=4:bits=2:mode=log,vibrato=f=15:d=1,volume=8`;
            }

            command.audioFrequency(8000) 
                   .audioChannels(1)     
                   .audioFilters(af)
                   .audioBitrate('8k');  
        }

        command
            .on('start', () => console.log(`🚀 [FFMPEG] Processing Level ${level} (Tier System)...`))
            .on('end', () => {
                const resultBuffer = fs.readFileSync(tempOut);
                if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
                if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
                resolve(resultBuffer);
            })
            .on('error', (err) => {
                if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
                if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
                reject(err);
            })
            .save(tempOut);
    });
}

module.exports = { destroyMedia };
