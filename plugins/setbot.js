const fs = require('fs');
const path = require('path');
const { db } = require('../src/database/db');

const ARCHIVO = path.join(process.cwd(), 'setbot-groups.json');

function normalizar(id) {
    return String(id || '')
        .trim()
        .toLowerCase()
        .replace(/:\d+(?=@)/, '');
}

function numeroTelefono(id) {
    let valor = normalizar(id);
    if (valor.startsWith('+')) valor = valor.slice(1);

    if (/^\d{7,15}$/.test(valor)) return valor;

    const match = valor.match(/^(\d{7,15})@s\.whatsapp\.net$/);
    return match ? match[1] : '';
}

function mismoId(a, b) {
    const uno = normalizar(a);
    const dos = normalizar(b);
    if (!uno || !dos) return false;
    if (uno === dos) return true;

    const numUno = numeroTelefono(uno);
    const numDos = numeroTelefono(dos);
    return Boolean(numUno && numDos && numUno === numDos);
}

function contextoDe(m) {
    return (
        m.message?.extendedTextMessage?.contextInfo ||
        m.message?.imageMessage?.contextInfo ||
        m.message?.videoMessage?.contextInfo ||
        {}
    );
}

module.exports = {
    command: ['setbot', 'setprimary'],
    group: true,
    admin: true,

    execute: async (m, { sock, from, args, groupMetadata }) => {
        // Solo el principal procesa la selección para evitar respuestas duplicadas.
        if (sock.__isSub) return;

        const principal = global.mainBotSocket;
        if (!principal) {
            return sock.sendMessage(from, {
                text: '⚠️ No pude identificar el socket del bot principal. Reinicia el bot principal e inténtalo de nuevo.'
            }, { quoted: m });
        }

        const contexto = contextoDe(m);
        const menciones = [
            ...(Array.isArray(contexto.mentionedJid) ? contexto.mentionedJid : []),
            ...(Array.isArray(m.mentionedJid) ? m.mentionedJid : [])
        ].filter(Boolean);

        const autorCitado = [
            contexto.participantAlt,
            contexto.participant,
            m.quoted?.sender,
            m.quoted?.participant,
            m.quoted?.key?.participantAlt,
            m.quoted?.key?.participant
        ].find(Boolean);

        const numeroEscrito = String(args?.join(' ') || '')
            .match(/\d{7,15}/)?.[0];

        const objetivo = menciones[0] || autorCitado || numeroEscrito;

        if (!objetivo) {
            return sock.sendMessage(from, {
                text: '⚠️ Menciona un bot, responde a uno de sus mensajes o escribe su número.'
            }, { quoted: m });
        }

        const participantes = groupMetadata?.participants || [];
        const participante = participantes.find(p => {
            const ids = [
                p.id, p.jid, p.lid, p.phoneNumber, p.participantAlt
            ].filter(Boolean);

            return ids.some(id => mismoId(id, objetivo));
        });

        const idsObjetivo = [
            objetivo,
            participante?.id,
            participante?.jid,
            participante?.lid,
            participante?.phoneNumber,
            participante?.participantAlt
        ].filter(Boolean);

        const idsPrincipal = [
            principal.__sessionJid,
            principal.user?.id,
            principal.user?.jid,
            principal.user?.phoneNumber,
            principal.user?.lid
        ].filter(Boolean);

        const esPrincipal = idsObjetivo.some(id =>
            idsPrincipal.some(idPrincipal => mismoId(id, idPrincipal))
        );

        let subbots = [];
        try {
            subbots = db.prepare('SELECT jid FROM subbots').all();
        } catch {}

        const subbot = subbots.find(bot =>
            idsObjetivo.some(id => mismoId(id, bot.jid))
        );

        const jidSeleccionado = esPrincipal
            ? (principal.__sessionJid || principal.user?.id || principal.user?.jid || principal.user?.phoneNumber)
            : subbot?.jid;

        if (!jidSeleccionado) {
            return sock.sendMessage(from, {
                text: '⚠️ El mensaje citado, la mención o el número no coincide con el bot principal ni con un subbot registrado.'
            }, { quoted: m });
        }

        let selecciones = {};
        try {
            selecciones = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
        } catch {}

        selecciones[from] = String(jidSeleccionado);

        await fs.promises.writeFile(
            ARCHIVO,
            JSON.stringify(selecciones, null, 2)
        );

        return sock.sendMessage(from, {
            text: esPrincipal
                ? '✅ El bot principal quedó seleccionado para este grupo. Los subbots ignorarán los comandos aquí. Usa .resetbot para que todos vuelvan a responder.'
                : '✅ El subbot quedó seleccionado para este grupo. Los demás bots ignorarán los comandos aquí. Usa .resetbot para que todos vuelvan a responder.'
        }, { quoted: m });
    }
};
