const handler = {
    command: ['kick', 'echar', 'hechar', 'sacar', 'ban'],
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
                (text && !text.includes('@') ? text : null);

            if (user) user = user.replace(/:[0-9]+/, '') + (user.includes('@') ? '' : '@s.whatsapp.net');

            if (!user || user === '@s.whatsapp.net') {
                return conn.sendMessage(from, { 
                    text: "REPORTE DE LA RADIO\n\nNo detecto a ningún pecador. Responde a su mensaje, etiquétalo o escribe su número para expulsarlo." 
                });
            }

            await conn.groupParticipantsUpdate(from, [user], "remove");
            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

        } catch (error) {
            console.error(error);
            await conn.sendMessage(from, { 
                text: "INTERFERENCIA\n\nNo pude expulsar a este usuario. Revisa mis permisos." 
            });
        }
    }
};

export default handler;
