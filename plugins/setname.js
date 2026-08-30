const fs = require('fs');
const path = require('path');

const OWNERS = [
    '126951364800652'
];

function limpiar(valor) {
    return String(valor || '')
        .split(':')[0]
        .split('@')[0]
        .replace(/[^0-9]/g, '');
}

function esOwner(m) {
    const ids = [
        m.sender,
        m.key?.participant,
        m.key?.remoteJid
    ];

    return ids.some(id => {
        const numero = limpiar(id);

        return OWNERS.some(owner =>
            numero === owner ||
            numero.slice(-10) === owner.slice(-10)
        );
    });
}

module.exports = {
    command: ['setname'],

    execute: async (m, { sock, from, args }) => {
        if (!esOwner(m)) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '🚫 Solo el creador puede cambiar el nombre del bot.'
                },
                { quoted: m }
            );
        }

        const nombre = args.join(' ').trim();

        if (!nombre) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '✏️ Usa el comando así:\n\n' +
                        '.setname Nuevo Nombre'
                },
                { quoted: m }
            );
        }

        if (nombre.length > 25) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '⚠️ El nombre no puede superar 25 caracteres.'
                },
                { quoted: m }
            );
        }

        try {
            if (
                typeof sock.updateProfileName !== 'function'
            ) {
                throw new Error(
                    'Baileys no permite cambiar el nombre del perfil.'
                );
            }

            await sock.updateProfileName(nombre);

            await fs.promises.writeFile(
                path.join(process.cwd(), 'botname.json'),
                JSON.stringify(
                    {
                        nombre,
                        actualizado: new Date().toISOString()
                    },
                    null,
                    2
                )
            );

            global.botname = nombre;

            await sock.sendMessage(
                from,
                {
                    text:
                        '✅ Nombre del bot actualizado:\n\n' +
                        '🤖 ' + nombre
                },
                { quoted: m }
            );
        } catch (error) {
            console.error(
                'Error en setname:',
                error.message
            );

            await sock.sendMessage(
                from,
                {
                    text:
                        '❌ No pude cambiar el nombre del bot.\n\n' +
                        error.message
                },
                { quoted: m }
            );
        }
    }
};
