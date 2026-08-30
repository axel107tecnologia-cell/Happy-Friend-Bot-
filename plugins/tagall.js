module.exports = {
    command: ['tagall', 'todos'],
    group: true,
    admin: true,
    botAdmin: true,

    execute: async (m, { sock, from }) => {
        try {
            const metadata = await sock.groupMetadata(from);
            const participantes = metadata.participants || [];

            const menciones = participantes
                .map(participante =>
                    participante.id ||
                    participante.jid ||
                    participante.participantAlt
                )
                .filter(Boolean);

            if (!menciones.length) {
                return sock.sendMessage(
                    from,
                    { text: '⚠️ No encontré participantes para mencionar.' },
                    { quoted: m }
                );
            }

            const texto = [
                '📢 𝐀𝐓𝐄𝐍𝐂𝐈𝐎́𝐍 𝐀 𝐓𝐎𝐃𝐎𝐒',
                '',
                ...menciones.map(jid =>
                    '@' + jid.split('@')[0].split(':')[0]
                )
            ].join('\n');

            await sock.sendMessage(
                from,
                {
                    text: texto,
                    mentions: menciones
                },
                { quoted: m }
            );
        } catch (error) {
            console.error('❌ Error en tagall:', error.message);

            await sock.sendMessage(
                from,
                {
                    text: '⚠️ No pude mencionar a todos los participantes.'
                },
                { quoted: m }
            );
        }
    }
};
