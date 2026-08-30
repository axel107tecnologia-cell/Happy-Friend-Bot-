const fs = require('fs');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

function isUserRegistered(sender) {
    if (!fs.existsSync('./database.json')) return false;
    try {
        const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
        return Boolean(db[sender]);
    } catch {
        return false;
    }
}

async function downloadMedia(mediaMessage, type) {
    if (!mediaMessage) return null;

    const stream = await downloadContentFromMessage(
        mediaMessage,
        type
    );

    const partes = [];

    for await (const parte of stream) {
        partes.push(parte);
    }

    return Buffer.concat(partes);
}

module.exports = {
    command: ['s', 'sticker', 'st', 'stiker'],

    execute: async (m, { conn, from }) => {
        if (!isUserRegistered(m.sender)) {
            return conn.sendMessage(from, {
                text: 'Primero debes registrarte usando .reg nombre edad.'
            }, { quoted: m });
        }

        const media = m.quoted || m;
        const message = media.message || m.message || {};
        const image = message.imageMessage || message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        const video = message.videoMessage || message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
        const sticker = message.stickerMessage || message.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;

        const mediaMessage = image || video || sticker;
        const mediaType = video ? 'video' : sticker ? 'sticker' : 'image';

        if (!image && !video && !sticker) {
            return conn.sendMessage(from, {
                text: 'Responde a una imagen, video o sticker usando .s'
            }, { quoted: m });
        }

        try {
            const buffer = await downloadMedia(mediaMessage, mediaType);
            if (!buffer || !buffer.length) throw new Error('No se pudo descargar el archivo');

            const fecha = new Date().toLocaleDateString('es-MX');
            const pack = `ʜᴀᴘᴘʏ ғʀɪᴇɴᴅs ʙᴏᴛ (${fecha})`;
            const type = video ? StickerTypes.FULL : StickerTypes.DEFAULT;

            const st = new Sticker(buffer, {
                pack,
                author: '',
                type,
                quality: 55
            });

            const output = await st.toBuffer();
            if (!output || !output.length) throw new Error('El sticker generado está vacío');

            await conn.sendMessage(from, { sticker: output }, { quoted: m });
            console.log(`✅ Sticker creado: ${output.length} bytes`);
        } catch (error) {
            console.error('❌ Error creando sticker:', error.message);
            await conn.sendMessage(from, {
                text: 'No pude crear el sticker. Prueba con una imagen o video normal.'
            }, { quoted: m });
        }
    }
};
