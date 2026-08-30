module.exports = {
    command: ['setprefix', 'cambiarprefijo'],
    rowner: true,
    execute: async (m, { text }) => {
        if (!text) return m.reply('✨ *Por favor, proporciona los nuevos prefijos separados por espacio.*\n*Ejemplo:* . ! #');

        const newPrefixes = text.trim().split(/\s+/);
        global.prefix = newPrefixes;

        m.reply(`✅ *¡Configuración actualizada! Ahora los prefijos son:* [ ${global.prefix.join(' ')} ]`);
    }
};
