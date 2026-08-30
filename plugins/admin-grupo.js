module.exports = {
    command: ['grupocerrar', 'grupoabrir'],
    group: true,
    admin: true,
    botAdmin: true,

    execute: async (m, { sock, from, command }) => {
        try {
            const cerrar = command === 'grupocerrar';

            await sock.groupSettingUpdate(
                from,
                cerrar ? 'announcement' : 'not_announcement'
            );

            await sock.sendMessage(
                from,
                {
                    text: cerrar
                        ? '🔒 Grupo cerrado. Solo los administradores pueden escribir.'
                        : '🔓 Grupo abierto. Todos los participantes pueden escribir.'
                },
                { quoted: m }
            );
        } catch (error) {
            console.error('Error en configuración del grupo:', error);

            await sock.sendMessage(
                from,
                {
                    text: '❌ No pude cambiar el estado del grupo. Verifica que sea administrador.'
                },
                { quoted: m }
            );
        }
    }
};
