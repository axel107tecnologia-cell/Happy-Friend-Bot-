const { db } = require('../src/database/db');

function obtenerNumero(jid) {
    return String(jid || '')
        .split('@')[0]
        .split(':')[0];
}

function fecha(ms) {
    return new Date(ms).toLocaleDateString('es-MX', {
        timeZone: 'America/Monterrey'
    });
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
            '🤖 🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸\n\n' +
            '🟢 Bot principal: En línea\n' +
            `📊 Sub-bots registrados: ${total}\n` +
            `💾 Memoria utilizada: ${memoria.toFixed(2)} MB\n` +
            `📈 Promedio por bot: ${promedio.toFixed(2)} MB\n\n`;

        if (!subbots.length) {
            mensaje += 'No hay sub-bots registrados.';
        } else {
            mensaje += '📋 SUB-BOTS:\n\n';

            subbots.forEach((bot, indice) => {
                const numero = obtenerNumero(bot.jid);
                const estado = bot.status || 'activo';
                const premium = db.prepare(
                    'SELECT expires_at FROM premium_sessions WHERE jid = ?'
                ).get(bot.jid);

                const etiquetaPremium = premium && premium.expires_at > Date.now()
                    ? ` ✨ PREMIUM hasta ${fecha(premium.expires_at)}`
                    : '';

                mensaje +=
                    (indice + 1) + '. ' + numero + ' — ' +
                    estado + etiquetaPremium + '\n';
            });
        }

        await sock.sendMessage(from, { text: mensaje }, { quoted: m });
    }
};
