'use strict';

const fs = require('fs');
const path = require('path');

const OWNER_ID = '126951364800652';
const BANNER_PREFIX = 'menu-banner';

function normalizeJid(value) {
    return String(value || '').replace(/:\d+(?=@)/, '');
}
function ownerIds() {
    return new Set([global.rowner, global.owner].flat().filter(Boolean)
        .map(value => String(value).replace(/\D/g, '')).filter(Boolean).concat(OWNER_ID));
}
function getSender(m, from) {
    return m?.sender || m?.key?.participant || m?.participant || from || '';
}
function unwrap(message) {
    let current = message;
    for (let i = 0; i < 4; i++) {
        const next = current?.ephemeralMessage?.message ||
            current?.viewOnceMessage?.message || current?.viewOnceMessageV2?.message ||
            current?.documentWithCaptionMessage?.message;
        if (!next) break;
        current = next;
    }
    return current;
}
function getQuotedContent(m) {
    const quoted = m?.quoted;
    const quotedWrapper = unwrap(quoted?.message || quoted?.msg || quoted);
    const current = unwrap(m?.message || m?.msg || m);
    const context = current?.extendedTextMessage?.contextInfo ||
        current?.imageMessage?.contextInfo || current?.videoMessage?.contextInfo;
    const quotedRaw = unwrap(context?.quotedMessage);
    const candidates = [quotedWrapper, quotedRaw];
    for (const obj of candidates) {
        if (!obj) continue;
        if (obj.imageMessage) return { node: obj.imageMessage, type: 'image', wrapper: quoted };
        if (obj.videoMessage) return { node: obj.videoMessage, type: 'video', wrapper: quoted };
        if (obj.documentMessage) return { node: obj.documentMessage, type: 'document', wrapper: quoted };
        if (obj.mimetype) return { node: obj, type: 'unknown', wrapper: quoted };
    }
    const mime = String(quoted?.mimetype || quoted?.msg?.mimetype || '').toLowerCase();
    return mime ? { node: null, type: 'unknown', wrapper: quoted, mime } : null;
}
function getMime(source) {
    return String(source?.node?.mimetype || source?.wrapper?.mimetype ||
        source?.wrapper?.msg?.mimetype || source?.mime || '').toLowerCase();
}
async function downloadMedia(source) {
    if (typeof source.wrapper?.download === 'function') {
        try {
            const data = await source.wrapper.download();
            if (data?.length) return data;
        } catch (_) {}
    }
    if (source.node) {
        try {
            const baileys = require('@whiskeysockets/baileys');
            if (typeof baileys.downloadContentFromMessage === 'function') {
                const mediaType = source.type === 'document' ? 'document' : source.type;
                const stream = await baileys.downloadContentFromMessage(source.node, mediaType);
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                return Buffer.concat(chunks);
            }
        } catch (_) {}
    }
    return null;
}
function extensionFor(mime, type) {
    if (/video\/mp4/i.test(mime)) return 'mp4';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
    return null;
}
async function reply(sock, from, m, text) {
    return sock.sendMessage(from, { text }, { quoted: m });
}

module.exports = {
    command: ['setbanner'],
    execute: async (m, { sock, from, isOwner }) => {
        const sender = getSender(m, from);
        const number = normalizeJid(sender).split('@')[0].replace(/\D/g, '');
        if (isOwner !== true && !ownerIds().has(number)) {
            return reply(sock, from, m, 'Solo el propietario del bot puede cambiar el banner.');
        }

        const source = getQuotedContent(m);
        if (!source) {
            return reply(sock, from, m, 'Responde a una imagen o a un GIF/video MP4 con .setbanner.');
        }
        const mime = getMime(source);
        const ext = extensionFor(mime, source.type);
        if (!ext) {
            return reply(sock, from, m, 'Formato no compatible. Usa una imagen o un GIF enviado como video MP4.');
        }

        try {
            const media = await downloadMedia(source);
            if (!media?.length) return reply(sock, from, m, 'No pude descargar el archivo; intenta responder al original.');

            const dir = __dirname;
            const target = path.join(dir, `${BANNER_PREFIX}.${ext}`);
            const temp = `${target}.tmp`;
            fs.writeFileSync(temp, media);
            fs.renameSync(temp, target);

            for (const oldExt of ['mp4', 'jpg', 'png', 'webp', 'gif']) {
                const old = path.join(dir, `${BANNER_PREFIX}.${oldExt}`);
                if (old !== target && fs.existsSync(old)) fs.unlinkSync(old);
            }

            const kind = ext === 'mp4' ? 'GIF/video animado' : 'imagen';
            return reply(sock, from, m, `Banner actualizado con ${kind}. Usa .menu para verlo.`);
        } catch (error) {
            console.error('Error en .setbanner:', error);
            return reply(sock, from, m, 'No pude guardar ese banner. Prueba con una imagen o video MP4 más pequeño.');
        }
    }
};
