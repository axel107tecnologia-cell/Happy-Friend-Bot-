'use strict';

const OWNER_IDS = ['126951364800652'];

function cleanId(value) {
    return String(value || '').split(':')[0].split('@')[0].replace(/\D/g, '');
}
function participantIds(participant) {
    return [participant?.id, participant?.jid, participant?.lid, participant?.phoneNumber, participant?.participantAlt]
        .map(cleanId).filter(Boolean);
}
function isAdmin(participant) {
    return participant?.admin === 'admin' || participant?.admin === 'superadmin' || participant?.admin === true;
}
function messageText(m) {
    return String(m?.text || m?.body || m?.message?.conversation || m?.message?.extendedTextMessage?.text || '');
}
function getCommandName(m, command) {
    const textCommand = messageText(m).trim().split(/\s+/)[0] || '';
    return String(command || m?.command || textCommand).replace(/^[.#/!]+/, '').toLowerCase();
}

module.exports = {
    command: ['antilink', 'antilink2', 'antilinkcontrol'],
    execute: async (m, { sock, from, args = [], command, isAdmin: ctxAdmin, isOwner: ctxOwner, isROwner } = {}) => {
        if (!String(from || '').endsWith('@g.us')) {
            return sock.sendMessage(from, { text: 'Estos controles solo funcionan en grupos.' }, { quoted: m });
        }

        const sender = m?.sender || m?.key?.participant || m?.participant || '';
        const senderId = cleanId(sender);
        const ownerIds = new Set([
            ...OWNER_IDS,
            ...[global.rowner, global.owner].flat().filter(Boolean).map(cleanId)
        ]);
        let admin = ctxAdmin === true || ctxOwner === true || isROwner === true || ownerIds.has(senderId);

        if (!admin) {
            try {
                const metadata = await sock.groupMetadata(from);
                const participant = (metadata?.participants || []).find(p => participantIds(p).includes(senderId));
                admin = isAdmin(participant);
            } catch (_) {}
        }
        if (!admin) {
            return sock.sendMessage(from, { text: 'Solo un administrador puede cambiar el anti-link.' }, { quoted: m });
        }

        const textTokens = messageText(m).trim().split(/\s+/);
        const commandName = getCommandName(m, command);
        const action = String((Array.isArray(args) ? args[0] : args) || textTokens[1] || '').toLowerCase();
        if (!['on', 'off', 'activar', 'desactivar'].includes(action)) {
            return sock.sendMessage(from, {
                text: 'Usa .antilink on/off, .antilink2 on/off o .antilinkcontrol on/off.'
            }, { quoted: m });
        }
        const enable = action === 'on' || action === 'activar';

        if (commandName === 'antilinkcontrol') {
            global.antilinkDisabled ||= new Set();
            if (enable) global.antilinkDisabled.delete(from);
            else global.antilinkDisabled.add(from);
            return sock.sendMessage(from, {
                text: `Anti-link general ${enable ? 'activado' : 'desactivado'} en este grupo.`
            }, { quoted: m });
        }

        if (!global.db?.data) {
            return sock.sendMessage(from, { text: 'No encuentro la base de datos del bot.' }, { quoted: m });
        }
        global.db.data.chats ||= {};
        const chat = global.db.data.chats[from] ||= {};
        const field = commandName === 'antilink2' ? 'antiLink2' : 'antiLink';
        chat[field] = enable;
        if (typeof global.db.write === 'function') await global.db.write();

        return sock.sendMessage(from, {
            text: `${commandName === 'antilink2' ? 'Antilink2 de enlaces externos' : 'Antilink de invitaciones de WhatsApp'}: ${enable ? 'activado' : 'desactivado'}.`
        }, { quoted: m });
    }
};
