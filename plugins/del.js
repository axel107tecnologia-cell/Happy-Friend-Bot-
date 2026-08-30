module.exports = {
    command: ['del', 'delete', 'borrar'],
    group: true,
    admin: true,
    botAdmin: true,

    execute: async (m, { sock, from }) => {
        try {
            const contexto =
                m.message?.extendedTextMessage?.contextInfo ||
                m.message?.imageMessage?.contextInfo ||
                m.message?.videoMessage?.contextInfo ||
                m.message?.documentMessage?.contextInfo ||
                {};

            if (!contexto.stanzaId) {
                return sock.sendMessage(
                    from,
                    {
                        text: '🗑️ Responde al mensaje que quieres borrar usando .del'
                    },
                    { quoted: m }
                );
            }

            const mensajeObjetivo = {
                remoteJid: from,
                fromMe: false,
                id: contexto.stanzaId,
                participant:
                    contexto.participantAlt ||
                    contexto.participant
            };

            await sock.sendMessage(
                from,
                {
                    delete: mensajeObjetivo
                }
            );
        } catch (error) {
            console.error('❌ Error en .del:', error.message);

            await sock.sendMessage(
                from,
                {
                    text: '⚠️ No pude borrar ese mensaje. Confirma que el bot sea administrador.'
                },
                { quoted: m }
            );
        }
    }
};
