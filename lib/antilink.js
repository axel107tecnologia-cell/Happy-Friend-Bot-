export async function revisarAntiLink({
    sock,
    rawM,
    body,
    chat,
    isGroup,
    senderJid,
    isSub = false
}) {
    if (!isGroup) return false;
    if (isSub) return false;

    const enlaces = body.match(
        /(?:https?:\/\/|www\.)[^\s<>"']+/gi
    ) || [];

    if (!enlaces.length) return false;

    const dominiosPermitidos = [
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

    const enlacesDesconocidos = enlaces.filter(enlace => {
        const dominio = enlace
            .replace(/^[a-z]+:\/\//i, '')
            .split('/')[0]
            .split('?')[0]
            .split('#')[0]
            .replace(/^www\./i, '')
            .toLowerCase();

        const permitido = dominiosPermitidos.some(
            dominioPermitido =>
                dominio === dominioPermitido ||
                dominio.endsWith(`.${dominioPermitido}`)
        );

        return !permitido;
    });

    if (!enlacesDesconocidos.length) return false;

    const limpiarId = valor =>
        String(valor || '')
            .split(':')[0]
            .split('@')[0]
            .replace(/[^0-9]/g, '');

    const esAdmin = participante =>
        participante?.admin === 'admin' ||
        participante?.admin === 'superadmin';

    const metadata = await sock.groupMetadata(chat);
    const participantes = metadata.participants || [];

    const idsRemitente = [
        rawM.key.participant,
        rawM.key.participantAlt,
        rawM.key.remoteJid,
        rawM.key.remoteJidAlt,
        senderJid
    ]
        .map(limpiarId)
        .filter(Boolean);

    const remitente = participantes.find(participante => {
        const ids = [
            participante.id,
            participante.jid,
            participante.lid,
            participante.phoneNumber,
            participante.participantAlt
        ].map(limpiarId);

        return ids.some(id => idsRemitente.includes(id));
    });

    const owners = [
        '5218146379657',
        '528146379657',
        '5218136068555',
        '528136068555'
    ];

    const esOwner = owners.some(owner =>
        idsRemitente.some(id =>
            id.endsWith(owner.slice(-10))
        )
    );

    if (esAdmin(remitente) || esOwner) return false;

    const idsBot = [
        sock.user?.id,
        sock.user?.jid,
        sock.user?.lid
    ].map(limpiarId);

    const bot = participantes.find(participante => {
        const ids = [
            participante.id,
            participante.jid,
            participante.lid,
            participante.phoneNumber,
            participante.participantAlt
        ].map(limpiarId);

        return ids.some(id => idsBot.includes(id));
    });

    console.log('🔎 Anti-link: enlace desconocido detectado');

    const objetivo =
        rawM.key.participantAlt ||
        rawM.key.participant ||
        senderJid;

    await sock.sendMessage(chat, {
        delete: rawM.key
    });

    if (objetivo) {
        await sock.groupParticipantsUpdate(
            chat,
            [objetivo],
            'remove'
        );
    }

    await sock.sendMessage(chat, {
        text: `💢 ʀᴇɢʟᴀ ʀᴏᴍᴘɪᴅᴀ 💢

✨• ʟᴏs ᴇɴʟᴀᴄᴇs ɴᴏ ᴠᴇʀɪғɪᴄᴀᴅᴏs ɴᴏ ᴇsᴛᴀ́ɴ ᴘᴇʀᴍɪᴛɪᴅᴏs ᴇɴ ᴇsᴛᴇ ɢʀᴜᴘᴏ✨`
    });

    console.log('🚫 Anti-link: mensaje eliminado y usuario expulsado');

    return true;
}
