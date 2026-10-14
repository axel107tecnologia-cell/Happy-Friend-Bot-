module.exports = {
    command: ['open', 'abrir', 'close', 'cerrar'],
    botadmin: true,
    admin: true,
    execute: async ({ sock, from, m, command }) => {
        try {
            // Lógica para abrir
            if (command === 'open' || command === 'abrir') {
                await sock.groupSettingUpdate(from, 'not_announcement');
                await sock.sendMessage(from, { 
                    text: "RADIO 🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸: CANAL ABIERTO\n\nEl microfono esta encendido para todos. ¡Que empiece la charla!" 
                }, { quoted: m });
                await sock.sendMessage(from, { react: { text: "🔓", key: m.key } });
            } 

            // Lógica para cerrar
            if (command === 'close' || command === 'cerrar') {
                await sock.groupSettingUpdate(from, 'announcement');
                await sock.sendMessage(from, { 
                    text: "RADIO 🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸: CANAL CERRADO\n\nSilencio en el estudio. Solo los administradores tienen la palabra." 
                }, { quoted: m });
                await sock.sendMessage(from, { react: { text: "🔒", key: m.key } });
            }

        } catch (error) {
            console.log("--- ERROR EN GROUP CONTROL ---", error);
            await sock.sendMessage(from, { 
                text: "INTERFERENCIA\n\nNo tengo el poder suficiente. Asegurate de que soy administrador." 
            }, { quoted: m });
        }
    }
};
