const fs = require('fs');
const path = require('path');
const {
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');

const RUTA_BANNER = '/sdcard/Download/menu.jpg';

const OWNERS = [
    '528146379657'
];

function limpiarNumero(valor) {
    return String(valor || '')
        .split(':')[0]
        .split('@')[0]
        .replace(/[^0-9]/g, '');
}

function esOwner(m, groupMetadata) {
    const permitidos = [
        '528146379657',
        '126951364800652'
    ];

    const limpiar = valor =>
        String(valor || '')
            .split(':')[0]
            .split('@')[0]
            .replace(/[^0-9]/g, '');

    const coincide = valor => {
        const numero = limpiar(valor);

        return permitidos.some(permitido =>
            numero === permitido ||
            numero.slice(-10) === permitido.slice(-10)
        );
    };

    const identificadores = [
        m.sender,
        m.key?.participant,
        m.key?.remoteJid
    ];

    if (identificadores.some(coincide)) {
        return true;
    }

    const participantes =
        groupMetadata?.participants || [];

    const participante = participantes.find(item => {
        const ids = [
            item.id,
            item.jid,
            item.lid,
            item.phoneNumber,
            item.participantAlt
        ];

        return ids.some(id =>
            identificadores.some(actual =>
                String(id || '') === String(actual || '')
            )
        );
    });

    if (!participante) {
        return false;
    }

    return [
        participante.id,
        participante.jid,
        participante.lid,
        participante.phoneNumber,
        participante.participantAlt
    ].some(coincide);
}

function obtenerImagen(m) {
    if (m.message?.imageMessage) {
        return m.message.imageMessage;
    }

    if (m.quoted?.message?.imageMessage) {
        return m.quoted.message.imageMessage;
    }

    if (
        m.message?.extendedTextMessage
            ?.contextInfo
            ?.quotedMessage
            ?.imageMessage
    ) {
        return m.message.extendedTextMessage
            .contextInfo.quotedMessage.imageMessage;
    }

    return null;
}

module.exports = {
    command: ['setbanner'],

    execute: async (m, { sock, from, groupMetadata }) => {
        if (!esOwner(m, groupMetadata)) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '🚫 Solo el creador del bot puede cambiar el banner.'
                },
                { quoted: m }
            );
        }

        const imagen = obtenerImagen(m);

        if (!imagen) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '🖼️ Envía una imagen con .setbanner ' +
                        'o responde a una imagen usando .setbanner.'
                },
                { quoted: m }
            );
        }

        try {
            await sock.sendMessage(from, {
                react: {
                    text: '⌛',
                    key: m.key
                }
            });

            const carpeta = path.dirname(RUTA_BANNER);

            await fs.promises.mkdir(carpeta, {
                recursive: true
            });

            const stream = await downloadContentFromMessage(
                imagen,
                'image'
            );

            const partes = [];

            for await (const parte of stream) {
                partes.push(parte);
            }

            const buffer = Buffer.concat(partes);

            await fs.promises.writeFile(
                RUTA_BANNER,
                buffer
            );

            await sock.sendMessage(
                from,
                {
                    text:
                        '✅ Banner actualizado correctamente.\n\n' +
                        'La nueva imagen se usará en el menú.'
                },
                { quoted: m }
            );

            await sock.sendMessage(from, {
                react: {
                    text: '✅',
                    key: m.key
                }
            });
        } catch (error) {
            console.error(
                'Error en setbanner:',
                error.message
            );

            await sock.sendMessage(from, {
                react: {
                    text: '❌',
                    key: m.key
                }
            }).catch(() => {});

            await sock.sendMessage(
                from,
                {
                    text:
                        '⚠️ No pude guardar la imagen del banner.'
                },
                { quoted: m }
            );
        }
    }
};
