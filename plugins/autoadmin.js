module.exports = {
    command: ['autoadmin'],
    group: true,
    botAdmin: true,

    execute: async (m, { sock, from }) => {
        try {
            const metadata = await sock.groupMetadata(from);
            const participantes = metadata.participants || [];

            const owners = [
                '5218146379657',
                '528146379657',
                '5218136068555',
                '528136068555',
                '18096758983'
            ];

            const limpiar = valor =>
                String(valor || '')
                    .split(':')[0]
                    .split('@')[0]
                    .replace(/[^0-9]/g, '');

            const ultimos10 = valor =>
                limpiar(valor).slice(-10);

            const botNumero = limpiar(sock.user?.id);

            const bot = participantes.find(participante => {
                const ids = [
                    participante.id,
                    participante.jid,
                    participante.phoneNumber,
                    participante.participantAlt
                ];

                return ids.some(id =>
                    limpiar(id) === botNumero ||
                    ultimos10(id) === ultimos10(botNumero)
                );
            });

            if (!bot || !bot.admin) {
                return sock.sendMessage(
                    from,
                    {
                        text: '⚠️ Primero debes hacer administrador al bot.'
                    },
                    { quoted: m }
                );
            }

            const owner = participantes.find(participante => {
                const ids = [
                    participante.id,
                    participante.jid,
                    participante.lid,
                    participante.phoneNumber,
                    participante.participantAlt
                ];

                return ids.some(id =>
                    owners.some(ownerNumero =>
                        ultimos10(id) === ultimos10(ownerNumero)
                    )
                );
            });

            if (!owner) {
                return sock.sendMessage(
                    from,
                    {
                        text: '⚠️ Ningún número owner aparece en este grupo.'
                    },
                    { quoted: m }
                );
            }

            const numeroOwner = owners.find(ownerNumero =>
                [
                    owner.id,
                    owner.jid,
                    owner.lid,
                    owner.phoneNumber,
                    owner.participantAlt
                ].some(id =>
                    ultimos10(id) === ultimos10(ownerNumero)
                )
            );

            const ownerJid = `${numeroOwner}@s.whatsapp.net`;

            await sock.groupParticipantsUpdate(
                from,
                [ownerJid],
                'promote'
            );

            await sock.sendMessage(
                from,
                {
                    text: '👑 El owner ahora es administrador del grupo.'
                },
                { quoted: m }
            );
        } catch (error) {
            console.error('Error en autoadmin:', error);

            await sock.sendMessage(
                from,
                {
                    text: '❌ WhatsApp rechazó la promoción. Confirma que el bot sea administrador y que el número owner esté en el grupo.'
                },
                { quoted: m }
            );
        }
    }
};
