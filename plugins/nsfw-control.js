module.exports = {
    command: ['nsfw'],
    group: true,
    admin: true,
    botAdmin: true,

    execute: async (m, { sock, from, args }) => {
        const opcion = String(args[0] || '').toLowerCase();

        global.nsfwGroups =
            global.nsfwGroups || new Set();

        if (opcion === 'on') {
            global.nsfwGroups.add(from);

            return sock.sendMessage(
                from,
                {
                    text: '🔞 Modo NSFW activado en este grupo.'
                },
                { quoted: m }
            );
        }

        if (opcion === 'off') {
            global.nsfwGroups.delete(from);

            return sock.sendMessage(
                from,
                {
                    text: '💎 Modo NSFW desactivado en este grupo.'
                },
                { quoted: m }
            );
        }

        await sock.sendMessage(
            from,
            {
                text: 'Usa:\n.nsfw on\n.nsfw off'
            },
            { quoted: m }
        );
    }
};
