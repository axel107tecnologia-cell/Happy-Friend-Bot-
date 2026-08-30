const fs = require('fs');
const path = require('path');
const { db } = require('../src/database/db');

const ARCHIVO = path.join(
    process.cwd(),
    'setbot-groups.json'
);

function limpiar(valor) {
    return String(valor || '')
        .split(':')[0]
        .split('@')[0]
        .replace(/[^0-9]/g, '');
}

function obtenerCitado(m) {
    const contexto =
        m.message?.extendedTextMessage?.contextInfo ||
        m.message?.imageMessage?.contextInfo ||
        m.message?.videoMessage?.contextInfo ||
        {};

    const citado = m.quoted || {};

    return (
        contexto.participantAlt ||
        contexto.participant ||
        contexto.remoteJid ||
        citado.sender ||
        citado.participant ||
        citado.key?.participantAlt ||
        citado.key?.participant ||
        citado.key?.remoteJid ||
        null
    );
}

function leerSeleccionados() {
    try {
        return JSON.parse(
            fs.readFileSync(ARCHIVO, 'utf8')
        );
    } catch {
        return {};
    }
}

module.exports = {
    command: ['setbot'],
    group: true,
    admin: true,

    execute: async (m, { sock, from, groupMetadata }) => {
        const subbots = db
            .prepare('SELECT jid, status FROM subbots')
            .all();

        const citado = obtenerCitado(m);

        if (!citado) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '⚠️ Responde al mensaje del sub-bot que quieres ' +
                        'seleccionar y escribe .setbot.'
                },
                { quoted: m }
            );
        }

        const citadoNumero = limpiar(citado);

        const participanteCitado =
            groupMetadata?.participants?.find(participante => {
                const ids = [
                    participante.id,
                    participante.jid,
                    participante.lid,
                    participante.phoneNumber,
                    participante.participantAlt
                ];

                return ids.some(id =>
                    String(id || '') === String(citado || '') ||
                    limpiar(id) === citadoNumero
                );
            });

        const identificadores = [
            citado,
            participanteCitado?.id,
            participanteCitado?.jid,
            participanteCitado?.lid,
            participanteCitado?.phoneNumber,
            participanteCitado?.participantAlt
        ].filter(Boolean);

        const subbot = subbots.find(bot => {
            const numeroBot = limpiar(bot.jid);

            return identificadores.some(id => {
                const numero = limpiar(id);

                return (
                    numero === numeroBot ||
                    numero.slice(-10) === numeroBot.slice(-10)
                );
            });
        });

        if (!subbot) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '⚠️ El mensaje citado no pertenece a un sub-bot ' +
                        'registrado.'
                },
                { quoted: m }
            );
        }

        const seleccionados = leerSeleccionados();

        seleccionados[from] = String(subbot.jid);

        await fs.promises.writeFile(
            ARCHIVO,
            JSON.stringify(seleccionados, null, 2)
        );

        await sock.sendMessage(
            from,
            {
                text:
                    '✅ Sub-bot seleccionado para este grupo.\n\n' +
                    'Los demás sub-bots ignorarán los comandos aquí.'
            },
            { quoted: m }
        );
    }
};
