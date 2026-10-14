const OWN_CHANNEL_CODE = '0029VbD53WDGZNCqmpU0zY0E';

const ALLOWED_EXTERNAL_DOMAINS = [
    'instagram.com',
    'facebook.com',
    'fb.watch',
    'tiktok.com',
    'vm.tiktok.com',
    'pinterest.com',
    'pin.it',
    'youtube.com',
    'youtu.be',
    'youtube-nocookie.com'
];

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

function cleanUrl(value) {
    return String(value || '').replace(/[),.!?;:]+$/g, '');
}

function parseUrl(value) {
    try {
        const cleaned = cleanUrl(value);
        return new URL(/^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`);
    } catch (_) {
        return null;
    }
}

function normalizeHost(host) {
    return String(host || '').toLowerCase().replace(/^www\./, '');
}

function cleanId(value) {
    return String(value || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
}

function matchesDomain(host, domain) {
    return host === domain || host.endsWith(`.${domain}`);
}

function channelCodeFrom(url) {
    const host = normalizeHost(url.hostname);
    const match = url.pathname.match(/^\/channel\/([a-z0-9]{20,24})(?:\/|$)/i);
    return host === 'whatsapp.com' && match ? match[1] : null;
}

function groupCodeFrom(url) {
    const host = normalizeHost(url.hostname);
    const match = url.pathname.match(/^\/([a-z0-9]{20,24})(?:\/|$)/i);
    return host === 'chat.whatsapp.com' && match ? match[1] : null;
}

function isAdmin(participant) {
    return participant?.admin === 'admin' || participant?.admin === 'superadmin' || participant?.admin === true;
}

function participantIds(participant) {
    return [
        participant?.id,
        participant?.jid,
        participant?.lid,
        participant?.phoneNumber,
        participant?.participantAlt
    ].map(cleanId).filter(Boolean);
}

export async function revisarAntiLink({
    sock,
    rawM,
    body,
    chat,
    isGroup,
    senderJid,
    isSub = false
} = {}) {
    if (!isGroup || isSub || !sock || !rawM?.key || !chat) return false;

    // Nunca moderar mensajes enviados por este bot, aunque el wrapper no marque fromMe.
    const botIds = [sock.user?.id, sock.user?.jid, sock.user?.lid].map(cleanId).filter(Boolean);
    const messageIds = [
        rawM.key?.participant,
        rawM.key?.participantAlt,
        rawM.participant,
        senderJid
    ].map(cleanId).filter(Boolean);
    if (rawM.key?.fromMe || rawM.fromMe || messageIds.some(id => botIds.includes(id))) return false;

    // El control global apaga el filtro central además de los plugins individuales.
    if (global.antilinkDisabled?.has?.(chat)) return false;

    const config = global.db?.data?.chats?.[chat] || {};
    const blockWhatsApp = config.antiLink !== false;
    const blockExternal = config.antiLink2 !== false;
    if (!blockWhatsApp && !blockExternal) return false;

    const links = String(body || '').match(URL_PATTERN) || [];
    if (!links.length) return false;

    const parsedLinks = links.map(value => ({ raw: value, url: parseUrl(value) })).filter(item => item.url);
    if (!parsedLinks.length) return false;

    let currentGroupCode = null;
    if (blockWhatsApp && parsedLinks.some(item => groupCodeFrom(item.url))) {
        try {
            currentGroupCode = await sock.groupInviteCode(chat);
        } catch (error) {
            // Si no se puede verificar el enlace de este grupo, no expulsar a alguien por error.
            console.error('Anti-link: no pude verificar la invitación actual; no moderaré enlaces de grupo en este mensaje.');
        }
    }

    const disallowed = parsedLinks.filter(({ url }) => {
        const host = normalizeHost(url.hostname);
        const ownChannel = channelCodeFrom(url);
        if (ownChannel && ownChannel.toLowerCase() === OWN_CHANNEL_CODE.toLowerCase()) return false;

        const ownGroup = groupCodeFrom(url);
        if (ownGroup) {
            if (!blockWhatsApp) return false;
            // Si la consulta del código actual falló, fallar de forma segura y no expulsar.
            if (!currentGroupCode) return false;
            return ownGroup.toLowerCase() !== String(currentGroupCode).toLowerCase();
        }

        if (host === 'whatsapp.com' && url.pathname.toLowerCase().startsWith('/channel/')) {
            return blockWhatsApp;
        }
        if (host === 'whatsapp.com' || host === 'chat.whatsapp.com') return blockWhatsApp;

        if (ALLOWED_EXTERNAL_DOMAINS.some(domain => matchesDomain(host, domain))) return false;
        return blockExternal;
    });

    if (!disallowed.length) return false;

    let metadata;
    try {
        metadata = await sock.groupMetadata(chat);
    } catch (error) {
        console.error('Anti-link: no pude revisar el grupo; no moderaré el mensaje.');
        return false;
    }
    const participants = metadata?.participants || [];

    const senderCandidates = [
        rawM.key?.participant,
        rawM.key?.participantAlt,
        rawM.participant,
        senderJid
    ].map(cleanId).filter(Boolean);
    const sender = participants.find(participant =>
        participantIds(participant).some(id => senderCandidates.includes(id))
    );
    if (!sender) return false;

    const owners = [
        '5218146379657', '528146379657', '5218136068555', '528136068055',
        ...[global.rowner, global.owner].flat().filter(Boolean).map(cleanId)
    ].filter(Boolean);
    const isOwner = senderCandidates.some(id => owners.some(owner => id.endsWith(owner.slice(-10))));
    if (isAdmin(sender) || isOwner) return false;

    const target = rawM.key?.participant || senderJid || rawM.key?.participantAlt;
    if (!target || String(target).endsWith('@g.us')) return false;

    const botParticipant = participants.find(participant =>
        participantIds(participant).some(id => botIds.includes(id))
    );
    const botAdmin = isAdmin(botParticipant);

    try {
        await sock.sendMessage(chat, { delete: rawM.key });
    } catch (error) {
        console.error('Anti-link: no pude borrar el mensaje:', error);
    }

    if (botAdmin) {
        try {
            await sock.groupParticipantsUpdate(chat, [target], 'remove');
            await sock.sendMessage(chat, {
                text: '💢 Regla rota: los enlaces no permitidos no están autorizados en este grupo.'
            });
            console.log('Anti-link: mensaje moderado y usuario expulsado');
        } catch (error) {
            console.error('Anti-link: no pude expulsar al usuario:', error);
        }
    } else {
        await sock.sendMessage(chat, {
            text: 'Anti-link: se detectó un enlace no permitido; no puedo expulsar al usuario porque el bot no es administrador.'
        });
    }

    return true;
}
