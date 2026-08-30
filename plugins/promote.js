module.exports = {
    command: ['promote', 'daradmin', 'haceradmin'],
    group: true,
    admin: true,
    botAdmin: true,

    run: async function (m, { conn, from, text }) {
        try {
            const contextInfo =
                m.message?.extendedTextMessage?.contextInfo ||
                m.message?.imageMessage?.contextInfo ||
                m.message?.videoMessage?.contextInfo ||
                {};

            let user =
                contextInfo.mentionedJid?.[0] ||
                contextInfo.participant ||
                m.mentionedJid?.[0] ||
                m.quoted?.sender ||
                (text && /^\d+$/.test(text.trim())
                    ? text.trim() + '@s.whatsapp.net'
                    : null);

            if (user) {
                user = user.replace(/:[0-9]+/, '');

                if (!user.includes('@')) {
                    user += '@s.whatsapp.net';
                }
            }

            if (!user || user === '@s.whatsapp.net') {
                return conn.sendMessage(
                    from,
                    {
                        text: 'No detecto a quién darle administrador. Responde a su mensaje o menciona a la persona.'
                    },
                    { quoted: m }
                );
            }

            await conn.sendMessage(from, {
                react: { text: '👑', key: m.key }
            });

            await conn.groupParticipantsUpdate(
                from,
                [user],
                'promote'
            );

            await conn.sendMessage(
                from,
                {
                    text: `👑 Usuario @${user.split('@')[0]} ahora es administrador.`,
                    mentions: [user]
                },
                { quoted: m }
            );
        } catch (error) {
            console.error('Error en promote:', error);

            await conn.sendMessage(
                from,
                {
                    text: 'No pude darle administrador. Verifica que Alastor sea administrador del grupo.'
                },
                { quoted: m }
            );
        }
    }
};
