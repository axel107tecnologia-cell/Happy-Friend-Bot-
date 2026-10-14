const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

async function obtenerTemperatura() {
    try {
        const resultado = await execFileAsync(
            'termux-battery-status',
            [],
            { timeout: 5000 }
        );

        const datos = JSON.parse(resultado.stdout);
        const temperatura = Number(datos.temperature);

        if (Number.isFinite(temperatura)) {
            return temperatura.toFixed(1) + '°C';
        }
    } catch (error) {
        console.error(
            '⚠️ No se pudo leer la temperatura:',
            error.message
        );
    }

    return 'No disponible';
}

function tiempoLegible(segundos) {
    segundos = Math.floor(Number(segundos) || 0);

    const dias = Math.floor(segundos / 86400);
    const horas = Math.floor((segundos % 86400) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segundosFinales = segundos % 60;

    return (
        String(dias).padStart(2, '0') + 'd ' +
        String(horas).padStart(2, '0') + 'h ' +
        String(minutos).padStart(2, '0') + 'm ' +
        String(segundosFinales).padStart(2, '0') + 's'
    );
}

module.exports = {
    command: ['ping', 'p', 'status'],

    execute: async (m, { sock, from }) => {
        const inicio = Date.now();

        sock.sendMessage(from, {
            react: {
                text: '💎',
                key: m.key
            }
        }).catch(() => {});

        const totalRam =
            os.totalmem() / 1024 / 1024 / 1024;

        const libreRam =
            os.freemem() / 1024 / 1024 / 1024;

        const usadaRam = totalRam - libreRam;
        const porcentajeRam = totalRam > 0
            ? (usadaRam / totalRam) * 100
            : 0;

        const procesadores = os.cpus() || [];

        let nucleos = procesadores.length;

        if (!nucleos && typeof os.availableParallelism === 'function') {
            nucleos = os.availableParallelism();
        }

        if (!nucleos) {
            nucleos = 'No disponible';
        }

        const modeloCpu =
            procesadores[0] &&
            procesadores[0].model
                ? procesadores[0].model.replace(/\s+/g, ' ').trim()
                : os.platform() + ' ' + os.arch();

        const temperatura = await obtenerTemperatura();
        const enLinea = tiempoLegible(process.uptime());
        const ping = Date.now() - inicio;

        const usuario = m.pushName || 'Usuario';

        const mensaje =
            '╭━━〔 💎 🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸 〕━━╮\n' +
            '┃\n' +
            '┃ ⏱️ TIEMPO EN LÍNEA\n' +
            '┃ └─ ' + enLinea + '\n' +
            '┃\n' +
            '┃ ✨ PING\n' +
            '┃ └─ ' + ping + ' ms\n' +
            '┃\n' +
            '┃ 👤 USUARIO\n' +
            '┃ └─ ' + usuario + '\n' +
            '┃\n' +
            '┃ 💾 MEMORIA RAM\n' +
            '┃ ├─ Usada: ' + usadaRam.toFixed(2) + ' GB\n' +
            '┃ ├─ Total: ' + totalRam.toFixed(2) + ' GB\n' +
            '┃ └─ Uso: ' + porcentajeRam.toFixed(1) + '%\n' +
            '┃\n' +
            '┃ 🌡️ TEMPERATURA\n' +
            '┃ └─ ' + temperatura + '\n' +
            '┃\n' +
            '┃ ⚙️ PROCESADOR\n' +
            '┃ ├─ ' + modeloCpu + '\n' +
            '┃ └─ Núcleos: ' + nucleos + '\n' +
            '┃\n' +
            '╰━━━━━━━━━━━━━━━━━━━━╯';

        await sock.sendMessage(
            from,
            { text: mensaje },
            { quoted: m }
        );
    }
};
