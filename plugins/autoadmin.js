'use strict';

const OWNER_NUMBERS = new Set(['126951364800652', '528146379657']);

function phoneDigits(value) {
    if (!value) return null;
    const text = String(value).trim();

    if (/@lid$/i.test(text)) return null;

    if (/@(?:s\.whatsapp\.net|c\.us)$/i.test(text)) {
        return text.split('@')[0].split(':')[0].replace(/\D/g, '') || null;
    }

    if (/^\+?[\d\s()-]+$/.test(text)) {
        return text.replace(/\D/g, '') || null;
    }

    return null;
}

function normalizeJid(value) {
    return String(value || '').replace(/:\d+(?=@)/, '').toLowerCase();
}

function participantIds(participant) {
    return [
        participant?.id,
        participant?.jid,
        participant?.phoneNumber,
        participant?.phone,
        participant?.lid,
        participant?.pn
    ].filter(Boolean);
}

function matchesParticipant(participant, candidates) {
    const ids = participantIds(participant);

    return ids.some(id => candidates.some(candidate => {
        if (normalizeJid(id) === normalizeJid(candidate)) return true;

        const idNumber = phoneDigits(id);
        const candidateNumber = phoneDigits(candidate);
        return Boolean(idNumber && candidateNumber && idNumber === candidateNumber);
    }));
}

function isAdmin(participant) {
    return ['admin', 'superadmin'].includes(participant?.admin);
}

module.exports = {
    command: ['autoadmin', 'dameadmin'],
    group: true,

    execute: async (m, {
        sock,
        from,
        sender,
        senderJid,
        senderNum,
        isROwner
    }) => {
        const remitentes = [
            senderJid,
            sender,
            m.sender,
            m.key?.participantAlt,
            m.key?.participant,
            m.participant,
            senderNum
        ].filter(Boolean);

        const lidMapping = sock.signalRepository?.lidMapping;

        if (typeof lidMapping?.getPNForLID === 'function') {
            for (const candidato of [...remitentes]) {
                if (!String(candidato).toLowerCase().endsWith('@lid')) continue;

                const variantes = [
                    candidato,
                    String(candidato).replace(/@lid$/i, '')
                ];

                for (const variante of variantes) {
                    try {
                        const phoneJid = await lidMapping.getPNForLID(variante);
                        if (phoneJid) {
                            remitentes.push(phoneJid);
                            break;
                        }
                    } catch {}
                }
            }
        }

        const numerosRemitente = remitentes
            .map(phoneDigits)
            .filter(Boolean);

        const dueñosConfigurados = Array.isArray(global.owner)
            ? global.owner.flat(Infinity)
            : [global.owner];

        const numerosConfigurados = dueñosConfigurados
            .map(phoneDigits)
            .filter(Boolean);

        const esOwner =
            isROwner === true ||
            isROwner === 1 ||
            isROwner === 'true' ||
            numerosRemitente.some(numero =>
                OWNER_NUMBERS.has(numero) || numerosConfigurados.includes(numero)
            );

        if (!esOwner) {
            return sock.sendMessage(from, {
                text: 'Este comando solo puede usarlo el owner oficial.'
            }, { quoted: m });
        }

        try {
            const metadata = await sock.groupMetadata(from);
            const participantes = metadata.participants || [];
            const miJid = sock.user?.id || sock.user?.jid || sock.user?.lid;

            const bot = participantes.find(p =>
                matchesParticipant(p, [miJid, sock.user?.phoneNumber].filter(Boolean))
            );

            if (!isAdmin(bot)) {
                return sock.sendMessage(from, {
                    text: 'No pude confirmar que el bot sea administrador en este grupo.'
                }, { quoted: m });
            }

            const owner = participantes.find(p =>
                matchesParticipant(p, remitentes) ||
                participantIds(p).some(id => OWNER_NUMBERS.has(phoneDigits(id)))
            );

            if (!owner) {
                return sock.sendMessage(from, {
                    text: 'No encontré tu cuenta entre los integrantes del grupo.'
                }, { quoted: m });
            }

            if (isAdmin(owner)) {
                return sock.sendMessage(from, {
                    text: 'Ya apareces como administrador en este grupo.'
                }, { quoted: m });
            }

            const jidObjetivo = owner.id || owner.jid || owner.lid || owner.phoneNumber;
            if (!jidObjetivo) {
                return sock.sendMessage(from, {
                    text: 'No pude resolver tu identificador de WhatsApp para promoverte.'
                }, { quoted: m });
            }

            await sock.groupParticipantsUpdate(from, [jidObjetivo], 'promote');

            return sock.sendMessage(from, {
                text: 'Listo, solicité devolverte el rango de administrador.'
            }, { quoted: m });
        } catch (error) {
            console.error('Error en autoadmin:', error);
            return sock.sendMessage(from, {
                text: 'WhatsApp no aplicó la promoción. Revisa que el bot siga siendo admin y que tu cuenta esté en el grupo.'
            }, { quoted: m });
        }
    }
};
