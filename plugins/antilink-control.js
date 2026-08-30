module.exports = {
    command: ['antilink'],
    group: true,
    admin: true,
    botAdmin: true,

    execute: async (m, { sock, from, args }) => {
        const opcion = String(args[0] || '').toLowerCase();

        global.antilinkDisabled =
            global.antilinkDisabled || new Set();

        if (opcion === 'off') {
            global.antilinkDisabled.add(from);

            return sock.sendMessage(
                from,
                {
                    text: '💎 Anti-link desactivado en este grupo.'
                },
                { quoted: m }
            );
        }

        if (opcion === 'on') {
            global.antilinkDisabled.delete(from);

            return sock.sendMessage(
                from,
                {
                    text: '💎 Anti-link activado en este grupo.'
                },
                { quoted: m }
            );
        }

        await sock.sendMessage(
            from,
            {
                text: 'Usa:\n.antilink on\n.antilink off'
            },
            { quoted: m }
        );
    }
};
