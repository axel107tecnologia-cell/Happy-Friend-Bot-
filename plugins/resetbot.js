const fs = require('fs');
const path = require('path');

const ARCHIVO = path.join(
    process.cwd(),
    'setbot-groups.json'
);

module.exports = {
    command: ['resetbot'],
    group: true,
    admin: true,

    execute: async (m, { sock, from }) => {
        let seleccionados = {};

        try {
            seleccionados = JSON.parse(
                await fs.promises.readFile(
                    ARCHIVO,
                    'utf8'
                )
            );
        } catch {}

        if (seleccionados[from]) {
            delete seleccionados[from];

            await fs.promises.writeFile(
                ARCHIVO,
                JSON.stringify(seleccionados, null, 2)
            );
        }

        await sock.sendMessage(
            from,
            {
                text:
                    '✅ Selección reiniciada.\n\n' +
                    'Todos los sub-bots volverán a escuchar los comandos ' +
                    'de este grupo.\n\n' +
                    '🔒 Ninguna sesión fue eliminada.'
            },
            { quoted: m }
        );
    }
};
