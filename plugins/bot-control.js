const fs = require('fs');

const archivoEstados = 'bot-groups.json';
const archivoSelecciones = 'setbot-groups.json';

function leerArchivo(archivo) {
    try {
        return JSON.parse(
            fs.readFileSync(archivo, 'utf8')
        );
    } catch {
        return {};
    }
}

function guardarArchivo(archivo, datos) {
    fs.writeFileSync(
        archivo,
        JSON.stringify(datos, null, 2)
    );
}

module.exports = {
    command: ['bot'],
    group: true,
    admin: true,

    execute: async (m, { sock, from, args }) => {
        const accion = String(args[0] || '')
            .toLowerCase();

        if (!['on', 'off'].includes(accion)) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '⚙️ Usa una de estas opciones:\n\n' +
                        '.bot on\n' +
                        '.bot off'
                },
                { quoted: m }
            );
        }

        const estados = leerArchivo(archivoEstados);

        if (accion === 'off') {
            estados[from] = false;
            guardarArchivo(archivoEstados, estados);

            return sock.sendMessage(
                from,
                {
                    text:
                        '🔴 Bot apagado en este grupo.\n' +
                        'Todos los bots y sub-bots dejarán de responder.\n\n' +
                        'Un administrador puede reactivarlos con:\n' +
                        '.bot on'
                },
                { quoted: m }
            );
        }

        estados[from] = true;
        guardarArchivo(archivoEstados, estados);

        const selecciones = leerArchivo(
            archivoSelecciones
        );

        if (Object.prototype.hasOwnProperty.call(
            selecciones,
            from
        )) {
            delete selecciones[from];
            guardarArchivo(
                archivoSelecciones,
                selecciones
            );
        }

        return sock.sendMessage(
            from,
            {
                text:
                    '🟢 Bot activado en este grupo.\n' +
                    'Todos los bots y sub-bots disponibles ' +
                    'pueden responder nuevamente.'
            },
            { quoted: m }
        );
    }
};
