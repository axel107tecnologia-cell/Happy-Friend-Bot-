const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { Sticker, StickerTypes } =
    require('wa-sticker-formatter');
const {
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');

const ejecutar = promisify(execFile);

function isUserRegistered(sender) {
    if (!fs.existsSync('./database.json')) return false;

    try {
        const db = JSON.parse(
            fs.readFileSync('./database.json', 'utf8')
        );

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

async function prepararVideo(buffer, carpeta) {
    const entrada = path.join(carpeta, 'entrada.mp4');
    const salida = path.join(carpeta, 'sticker-preparado.mp4');

    await fs.promises.writeFile(entrada, buffer);

    await ejecutar(
        'ffmpeg',
        [
            '-y',
            '-i',
            entrada,
            '-t',
            '6',
            '-vf',
            'scale=384:384:force_original_aspect_ratio=decrease,' +
            'pad=384:384:(ow-iw)/2:(oh-ih)/2:color=black,' +
            'fps=8',
            '-an',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '32',
            '-pix_fmt',
            'yuv420p',
            salida
        ],
        {
            timeout: 180000,
            maxBuffer: 10 * 1024 * 1024
        }
    );

    return fs.promises.readFile(salida);
}

module.exports = {
    command: ['s', 'sticker', 'st', 'stiker'],

    execute: async (m, { conn, from }) => {
        if (!isUserRegistered(m.sender)) {
            return conn.sendMessage(
                from,
                {
                    text:
                        'Primero debes registrarte usando ' +
                        '.reg nombre edad.'
                },
                { quoted: m }
            );
        }

        const media = m.quoted || m;
        const message = media.message || m.message || {};

        const image =
            message.imageMessage ||
            message.extendedTextMessage?.contextInfo
                ?.quotedMessage?.imageMessage;

        const video =
            message.videoMessage ||
            message.extendedTextMessage?.contextInfo
                ?.quotedMessage?.videoMessage;

        const sticker =
            message.stickerMessage ||
            message.extendedTextMessage?.contextInfo
                ?.quotedMessage?.stickerMessage;

        const mediaMessage = image || video || sticker;
        const mediaType = video
            ? 'video'
            : sticker
                ? 'sticker'
                : 'image';

        if (!mediaMessage) {
            return conn.sendMessage(
                from,
                {
                    text:
                        'Responde a una imagen, video o sticker ' +
                        'usando .s'
                },
                { quoted: m }
            );
        }

        let carpeta = null;

        try {
            let buffer = await downloadMedia(
                mediaMessage,
                mediaType
            );

            if (!buffer || !buffer.length) {
                throw new Error(
                    'No se pudo descargar el archivo'
                );
            }

            if (video) {
                carpeta = await fs.promises.mkdtemp(
                    path.join(os.tmpdir(), 'sticker-')
                );

                buffer = await prepararVideo(
                    buffer,
                    carpeta
                );
            }

            const fecha =
                new Date().toLocaleDateString('es-MX');

            const pack =
                'ʜᴀᴘᴘʏ ғʀɪᴇɴᴅs ʙᴏᴛ (' +
                fecha +
                ')';

            const stickerMaker = new Sticker(buffer, {
                pack,
                author: '',
                type: video
                    ? StickerTypes.FULL
                    : StickerTypes.DEFAULT,
                quality: 20
            });

            const output =
                await stickerMaker.toBuffer();

            if (!output || !output.length) {
                throw new Error(
                    'El sticker generado está vacío'
                );
            }

            await conn.sendMessage(
                from,
                { sticker: output },
                { quoted: m }
            );

            console.log(
                '✅ Sticker creado: ' +
                output.length +
                ' bytes'
            );
        } catch (error) {
            console.error(
                '❌ Error creando sticker:',
                error.message
            );

            await conn.sendMessage(
                from,
                {
                    text:
                        '⚠️ No pude crear el sticker. ' +
                        'Los videos se limitan a 10 segundos.'
                },
                { quoted: m }
            );
        } finally {
            if (carpeta) {
                await fs.promises.rm(
                    carpeta,
                    {
                        recursive: true,
                        force: true
                    }
                ).catch(() => {});
            }
        }
    }
};
