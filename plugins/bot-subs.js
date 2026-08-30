const { db } = require('../src/database/db');

function obtenerNumero(jid) {
    return String(jid || '')
        .split('@')[0]
        .split(':')[0];
}

module.exports = {
    command: ['bots', 'listbots', 'subbots'],

    execute: async (m, { sock, from }) => {
        const subbots = db
            .prepare('SELECT jid, status FROM subbots')
            .all();

        const total = subbots.length;
        const memoria = process.memoryUsage().rss / 1024 / 1024;
        const promedio = memoria / (total + 1);

        let mensaje =
            'Friends Happy Bot\n\n' +
            'Bot principal: En línea\n' +
            `Sub-bots activos: ${total}\n` +
            `Memoria utilizada: ${memoria.toFixed(2)} MB\n` +
            `Promedio por bot: ${promedio.toFixed(2)} MB\n\n`;

        if (!subbots.length) {
            mensaje += 'No hay sub-bots activos.';
        } else {
            mensaje += 'SUB-BOTS ACTIVOS:\n';

            subbots.forEach((bot, indice) => {
                const numero = obtenerNumero(bot.jid);
                const estado = bot.status || 'activo';

                mensaje +=
                    `\({indice + 1}. \){numero} — ${estado}\n`;
            });
        }

        await sock.sendMessage(
            from,
            { text: mensaje },
            { quoted: m }
        );
    }
};
