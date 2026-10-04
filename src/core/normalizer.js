// src/core/normalizer.js
const { handleAlbumMessage } = require('./media/albumAggregator'); 
const downloader = require('./media/downloader');
const mediaStore = require('./media/mediaStore'); 

// 🛡️ FUNGSI UNIVERSAL: Pembersih JID (Menghapus Device ID & Menyamakan Domain)
const cleanJid = (jid) => {
    if (!jid) return '';
    return jid.replace(/:\d+/, '').replace(/@c\.us/, '@s.whatsapp.net');
};

const getMsgType = (msgObj) => {
    return Object.keys(msgObj).find(key => key !== 'messageContextInfo' && key !== 'senderKeyDistributionMessage');
};

async function buildContext(sock, m) {
    const rawChat = m.key.remoteJid;
    const isGroup = rawChat.endsWith('@g.us');
    
    // ==========================================
    // 🎯 EKSTRAKSI JID UNIVERSAL & BERSIH
    // ==========================================
    const chat = cleanJid(rawChat); // ID Ruangan (Group JID / Personal JID)
    
    // Cari participant di m.key.participant ATAU m.participant
    const rawParticipant = m.key.participant || m.participant;
    const sender = isGroup ? cleanJid(rawParticipant) : chat; // Selalu JID Individu Pengirim

    const msgType = getMsgType(m.message);
    if (!msgType) return null;

    let realMessage = m.message;
    let realMsgType = msgType;

    if (msgType === 'viewOnceMessageV2') {
        realMessage = m.message.viewOnceMessageV2.message;
        realMsgType = getMsgType(realMessage);
    }

    const contextInfo = realMessage.extendedTextMessage?.contextInfo || realMessage.imageMessage?.contextInfo || realMessage.videoMessage?.contextInfo || {};
    const quotedMessage = contextInfo.quotedMessage;
    const stanzaId = contextInfo.stanzaId; 

    // ==========================================
    // SIMPAN MEDIA KE DALAM CACHE & DISK
    // ==========================================
    const hasMedia = ['imageMessage', 'videoMessage', 'documentMessage', 'stickerMessage', 'audioMessage'].includes(realMsgType);
    const hasQuotedMedia = quotedMessage ? ['imageMessage', 'videoMessage', 'documentMessage', 'stickerMessage', 'audioMessage'].includes(getMsgType(quotedMessage)) : false;
    
    if (hasMedia) {
        await mediaStore.saveMedia(m.key.id, realMessage);
    }
    
    if (hasQuotedMedia && stanzaId) {
        await mediaStore.saveMedia(stanzaId, quotedMessage);
    }

    let text = realMessage.conversation || 
               realMessage.extendedTextMessage?.text || 
               realMessage.imageMessage?.caption || 
               realMessage.videoMessage?.caption ||
               realMessage.documentMessage?.caption || "";

    const isReaction = realMsgType === 'reactionMessage';
    let reactionTargetId = null;
    let reactionEmoji = null;
    let reactedMessagePayload = null;

    if (isReaction) {
        reactionEmoji = realMessage.reactionMessage.text;
        reactionTargetId = realMessage.reactionMessage.key.id;
        reactedMessagePayload = await mediaStore.getMediaPayload(reactionTargetId);
    }

    const hasReactedMedia = reactedMessagePayload ? ['imageMessage', 'videoMessage', 'documentMessage', 'stickerMessage', 'audioMessage'].includes(getMsgType(reactedMessagePayload)) : false;

    const albumMessage = realMessage.albumMessage;
    const isAlbumParent = !!albumMessage;
    const albumMediaCount = isAlbumParent ? ((albumMessage.expectedImageCount || 0) + (albumMessage.expectedVideoCount || 0)) : 0;
    
    const messageAssociation = realMessage.messageContextInfo?.messageAssociation;
    const isAlbumChild = messageAssociation && (messageAssociation.associationType === 1 || messageAssociation.associationType === 'MEDIA_ALBUM');
    const albumParentId = isAlbumChild ? messageAssociation.parentMessageKey?.id : null;

    // ==========================================
    // SUSUN CONTEXT DASAR (TERALOKASI LENGKAP)
    // ==========================================
    const baseCtx = {
        sock, raw: m, 
        chat,     // 📍 JID Ruangan (Grup/DM)
        sender,   // 👤 JID Individu Pengirim (Selalu 628xxx@s.whatsapp.net)
        isGroup,
        messageId: m.key.id,
        text: String(text).trim(),
        hasMedia: hasMedia || isAlbumChild || hasQuotedMedia || hasReactedMedia,
        quoted: quotedMessage, 
        stanzaId: stanzaId || reactionTargetId, 
        isReaction,
        reactionEmoji: reactionEmoji,
        
        isAlbumParent, albumMediaCount, albumParentId, isCompleteAlbum: false, albumChildren: [],
        
        downloadMedia: async () => {
            if (baseCtx.isReaction && reactedMessagePayload) {
                return await downloader.downloadMedia(reactedMessagePayload);
            }
            if (hasQuotedMedia) {
                return await downloader.downloadMedia(quotedMessage);
            }
            return await downloader.downloadMedia(realMessage);
        },

        // Balasan selalu dikirimkan ke ID Ruangan (chat)
        reply: async (teks) => {
            return await sock.sendMessage(chat, { text: teks }, { quoted: m });
        }
    };

    const finalCtx = await handleAlbumMessage(baseCtx);
    if (!finalCtx) return null; 

    if (finalCtx.isCompleteAlbum) {
        console.log(`[NORMALIZER] ✂️ Memecah 1 Album menjadi ${finalCtx.albumChildren.length} Context Terpisah.`);
        const { albumChildren, ...cleanCtx } = finalCtx;
        
        return finalCtx.albumChildren.map(payload => ({
            ...cleanCtx, 
            isCompleteAlbum: false, 
            hasMedia: true,
            downloadMedia: async () => await downloader.downloadMedia(payload) 
        }));
    }

    if (stanzaId) {
        const pastAlbumPayloads = await mediaStore.getAlbumChildrenPayloads(stanzaId);
        
        if (pastAlbumPayloads) {
            console.log(`[NORMALIZER] 🔗 Menemukan Relasi Parent! Menarik ${pastAlbumPayloads.length} media lama dari reply.`);
            const { albumChildren, ...cleanCtx } = finalCtx;
            
            return pastAlbumPayloads.map(payload => ({
                ...cleanCtx,
                hasMedia: true,
                downloadMedia: async () => await downloader.downloadMedia(payload)
            }));
        }
    }

    return finalCtx;
}

module.exports = { buildContext, cleanJid };
