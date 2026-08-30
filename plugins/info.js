const fs = require('fs');
const path = require('path');

function tiempoEnLinea(segundos) {
    segundos = Math.floor(Number(segundos) || 0);

    const dias = Math.floor(segundos / 86400);
    const horas = Math.floor((segundos % 86400) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);

    return (
        String(dias).padStart(2, '0') + 'd ' +
        String(horas).padStart(2, '0') + 'h ' +
        String(minutos).padStart(2, '0') + 'm'
    );
}

function cargarVersiones() {
    try {
        const archivo = path.join(process.cwd(), 'versiones.json');
        return JSON.parse(fs.readFileSync(archivo, 'utf8'));
    } catch {
        return {
            versionActual: '1.0.0',
            actualizaciones: 1,
            historial: []
        };
    }
}

function contarPlugins() {
    try {
        const carpeta = path.join(process.cwd(), 'plugins');

        return fs.readdirSync(carpeta).filter(archivo =>
            archivo.endsWith('.js')
        ).length;
    } catch {
        return 'No disponible';
    }
}

module.exports = {
    command: ['info'],

    execute: async (m, { sock, from }) => {
        const versiones = cargarVersiones();
        const enLinea = tiempoEnLinea(process.uptime());
        const plugins = contarPlugins();

        const ultimasVersiones = versiones.historial
            .slice(-3)
            .reverse()
            .map(item =>
                '┃ └─ ' + item.version + ' | ' + item.cambios
            )
            .join('\n');

        const mensaje =
            '╭━━〔 💎 INFORMACIÓN DEL BOT 〕━━╮\n' +
            '┃\n' +
            '┃ 🤖 NOMBRE\n' +
            '┃ └─ FRIENDS HAPPY BOT\n' +
            '┃\n' +
            '┃ 👨‍💻 DESARROLLADOR\n' +
            '┃ └─ AXEL ALBERTO\n' +
            '┃\n' +
            '┃ 📅 FECHA DE CREACIÓN\n' +
            '┃ └─ 22/08/2026\n' +
            '┃\n' +
            '┃ 🏷️ VERSIÓN ACTUAL\n' +
            '┃ └─ ' + versiones.versionActual + '\n' +
            '┃\n' +
            '┃ 🔄 ACTUALIZACIONES\n' +
            '┃ └─ ' + versiones.actualizaciones + '\n' +
            '┃\n' +
            '┃ 📜 HISTORIAL RECIENTE\n' +
            ultimasVersiones + '\n' +
            '┃\n' +
            '┃ ⏱️ TIEMPO EN LÍNEA\n' +
            '┃ └─ ' + enLinea + '\n' +
            '┃\n' +
            '┃ 🧩 PLUGINS ACTIVOS\n' +
            '┃ └─ ' + plugins + '\n' +
            '┃\n' +
            '╰━━━━━━━━━━━━━━━━━━━━╯';

        await sock.sendMessage(
            from,
            { text: mensaje },
            { quoted: m }
        );
    }
};
