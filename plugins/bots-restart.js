module.exports = {
    command: ['restart', 'reiniciar'],
    rowner: true,
    execute: async (m, { sock, from }) => {
        await sock.sendMessage(from, {
            text: "ESTADO DE LA SEÑAL\n\n¡Corte de energía! El espectáculo se detiene un momento para limpiar las manchas de sangre... ¡No cambien de frecuencia!"
        }, { quoted: m });

        process.exit(1);
    }
};