const { exec } = require('child_process');

module.exports = {
    command: ['$', 'exec', 'shell'],
    botadmin: false,
    owner: true,
    rowner: true,
    execute: async ({ sock, from, m, args, text }) => {
        const name = m.pushName || 'pecador';
        
        if (!text) {
            return sock.sendMessage(from, { 
                text: ` *¡Vaya falta de iniciativa!*\n\n¿Quieres que mueva los hilos del sistema pero no me das órdenes? ¡Dime qué comando ejecutar!` 
            }, { quoted: m });
        }

        await sock.sendMessage(from, { react: { text: "⚙️", key: m.key } });

        exec(text, async (error, stdout, stderr) => {
            let response = `📻 *𝙏𝙀𝙍𝙈𝙄𝙉𝘼𝙇 𝘿𝙀𝙇 𝙄𝙉𝙁𝙄𝙀𝙍𝙉𝙊*\n\n`;
            
            if (error) {
                response += `❌ *¡Zzzt... Error estático!*\n\`\`\`${error.message}\`\`\``;
                await sock.sendMessage(from, { react: { text: "💥", key: m.key } });
                return sock.sendMessage(from, { text: response }, { quoted: m });
            }

            if (stderr) {
                response += `⚠️ *Advertencia en la sintonía:*\n\`\`\`${stderr}\`\`\``;
            }

            if (stdout) {
                response += `✅ *Resultado de la transmisión:*\n\`\`\`${stdout}\`\`\``;
            } else if (!stderr) {
                response += `🎶 *¡Silencio absoluto! El comando se ejecutó sin dejar rastro.*`;
            }

            await sock.sendMessage(from, { react: { text: "", key: m.key } });
            await sock.sendMessage(from, { text: response }, { quoted: m });
        });
    }
};
