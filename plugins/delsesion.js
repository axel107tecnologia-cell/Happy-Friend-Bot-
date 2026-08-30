const fs = require('fs');
const path = require('path');
const { db } = require('../src/database/db');

function limpiarNumero(valor) {
    return String(valor || '')
        .split(':')[0]
        .split('@')[0]
        .replace(/[^0-9]/g, '');
}

function ultimos10(valor) {
    return limpiarNumero(valor).slice(-10);
}

module.exports = {
    command: ['delsesion'],

    execute: async (
        m,
        {
            sock,
            from,
            senderJid,
            senderNum
        }
    ) => {
        const candidatos = [
            senderJid,
            senderNum,
            m.sender,
            m.key?.participantAlt,
            m.key?.participant,
            m.key?.remoteJidAlt,
            m.key?.remoteJid
        ]
            .filter(Boolean)
            .map(ultimos10)
            .filter(numero => numero.length === 10);

        const numerosUnicos = [...new Set(candidatos)];

        if (!numerosUnicos.length) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '⚠️ No pude identificar tu número real. ' +
                        'Intenta usar .delsesion desde un chat privado.'
                },
                { quoted: m }
            );
        }

        const subbots = db
            .prepare('SELECT jid, status FROM subbots')
            .all();

        const subbot = subbots.find(bot =>
            numerosUnicos.includes(ultimos10(bot.jid))
        );

        if (!subbot) {
            return sock.sendMessage(
                from,
                {
                    text:
                        'ℹ️ No encontré un sub-bot vinculado a tu número.'
                },
                { quoted: m }
            );
        }

        const jid = String(subbot.jid);
        const conexion =
            global.subbotSockets?.get(jid);

        try {
            await sock.sendMessage(
                from,
                {
                    text:
                        '⌛ Cerrando únicamente tu sesión de sub-bot...'
                },
                { quoted: m }
            );

            if (conexion) {
                await conexion.logout().catch(() => {});
                global.subbotSockets?.delete(jid);
            }

            const carpeta = path.join(
                global.alastorsubs,
                jid
            );

            await fs.promises.rm(carpeta, {
                recursive: true,
                force: true
            });

            db.prepare(
                'DELETE FROM subbots WHERE jid = ?'
            ).run(jid);

            await sock.sendMessage(
                from,
                {
                    text:
                        '✅ Tu sub-bot fue desvinculado.\n\n' +
                        'La sesión principal no fue afectada.'
                },
                { quoted: m }
            );
        } catch (error) {
            console.error(
                'Error en delsesion:',
                error.message
            );

            await sock.sendMessage(
                from,
                {
                    text:
                        '❌ No pude cerrar tu sesión de sub-bot.'
                },
                { quoted: m }
            );
        }
    }
};
