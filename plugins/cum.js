const fs = require('fs');

module.exports = {
    command: ['cum'],
    group: true,

    execute: async (m, { sock, from }) => {
        const archivo = '/sdcard/Download/cum.mp4';

        try {
            const contexto =
                m.message?.extendedTextMessage?.contextInfo ||
                m.message?.imageMessage?.contextInfo ||
                m.message?.videoMessage?.contextInfo ||
                {};

            const actorJid =
                m.sender ||
                m.key?.participantAlt ||
                m.key?.participant ||
                m.key?.remoteJid;

            const objetivoJid =
                contexto.mentionedJid?.[0] ||
                contexto.participantAlt ||
                contexto.participant;

            if (!objetivoJid) {
                return sock.sendMessage(
                    from,
                    {
                        text: '🔞 Menciona a la persona o responde a uno de sus mensajes para usar .cum.'
                    },
                    { quoted: m }
                );
            }

            if (!fs.existsSync(archivo)) {
                throw new Error('No existe cum.mp4');
            }

            const actorNumero = String(actorJid)
                .split('@')[0]
                .split(':')[0];

            const objetivoNumero = String(objetivoJid)
                .split('@')[0]
                .split(':')[0];

            const mensaje =
                '🔞 @' + actorNumero +
                ' cumeó a @' + objetivoNumero +
                ' +18';

            await sock.sendMessage(
                from,
                {
                    text: mensaje,
                    mentions: [actorJid, objetivoJid]
                },
                { quoted: m }
            );

            await sock.sendMessage(
                from,
                {
                    video: fs.readFileSync(archivo),
                    mimetype: 'video/mp4',
                    gifPlayback: true
                },
                { quoted: m }
            );
        } catch (error) {
            console.error('❌ Error en .cum:', error.message);

            await sock.sendMessage(
                from,
                {
                    text: '⚠️ No pude enviar el contenido +18.'
                },
                { quoted: m }
            );
        }
    }
};
