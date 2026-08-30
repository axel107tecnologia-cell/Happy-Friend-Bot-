const fs = require('fs');

module.exports = {
    command: ['gif'],

    execute: async (m, { sock, from }) => {
        let lista;

        try {
            lista = fs.readFileSync(
                'gifs.txt',
                'utf8'
            )
                .split(/\r?\n/)
                .map(url => url.trim())
                .filter(url => url.length > 0);
        } catch {
            return sock.sendMessage(
                from,
                {
                    text: '⚠️ No se encontró el archivo gifs.txt.'
                },
                { quoted: m }
            );
        }

        if (!lista.length) {
            return sock.sendMessage(
                from,
                {
                    text: '⚠️ gifs.txt está vacío.'
                },
                { quoted: m }
            );
        }

        const url = lista[
            Math.floor(Math.random() * lista.length)
        ];

        try {
            await sock.sendMessage(from, {
                react: {
                    text: '💎',
                    key: m.key
                }
            });

            await sock.sendMessage(
                from,
                {
                    video: { url },
                    mimetype: 'video/mp4',
                    gifPlayback: true,
                    caption: '🎞️ GIF'
                },
                { quoted: m }
            );
        } catch (error) {
            console.error(
                'Error enviando GIF:',
                error.message
            );

            await sock.sendMessage(
                from,
                {
                    text:
                        '⚠️ No se pudo enviar ese GIF. ' +
                        'Puede que el enlace haya caducado.'
                },
                { quoted: m }
            );
        }
    }
};
