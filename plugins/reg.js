'use strict';

const fs = require('fs');
const path = require('path');
const archivo = path.join(process.cwd(), 'database.json');

const REGALO_MONEDAS = 50000;
const REGALO_XP = 1000;

function idDe(m) {
    return (
        m.sender ||
        m.participant ||
        m.key?.participant ||
        m.key?.participantAlt ||
        m.key?.remoteJid ||
        m.key?.remoteJidAlt
    );
}

function limpiar(id) {
    return String(id || '').replace(/:\d+(?=@)/, '').trim();
}

function leer() {
    if (!fs.existsSync(archivo)) return {};

    try {
        const datos = JSON.parse(fs.readFileSync(archivo, 'utf8'));
        return datos && typeof datos === 'object' && !Array.isArray(datos)
            ? datos
            : null;
    } catch {
        return null;
    }
}

function obtenerBaseEconomia() {
    if (!global.db || typeof global.db.write !== 'function') {
        const base = require('../src/database/db.js');
        global.db = base.default || base;
    }

    global.db.data ||= {};
    global.db.data.users ||= {};

    if (typeof global.db.write !== 'function') {
        throw new Error('No está disponible el guardado de la economía.');
    }

    return global.db;
}

function claveEconomia(users, usuario, id) {
    const posibles = [usuario, id].filter(Boolean);

    for (const posible of posibles) {
        if (users[posible]) return posible;
    }

    const normalizados = new Set(posibles.map(limpiar));
    return Object.keys(users).find(clave =>
        normalizados.has(limpiar(clave))
    ) || id;
}

module.exports = {
    command: ['reg', 'register', 'registrar'],

    execute: async (m, { sock, from, args }) => {
        const usuarioOriginal = idDe(m);
        const id = limpiar(usuarioOriginal);
        const nombre = Array.isArray(args) ? args.join(' ').trim() : '';

        if (!nombre) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '📲 Regístrate usando:\n\n' +
                        '.reg nombre.edad\n\n' +
                        'Ejemplo:\n' +
                        '.reg Axel.18'
                },
                { quoted: m }
            );
        }

        if (!id) {
            return sock.sendMessage(from, {
                text: '❌ No pude identificar tu usuario; no guardé cambios.'
            });
        }

        const datos = leer();
        if (!datos) {
            return sock.sendMessage(from, {
                text: '❌ No pude leer database.json; no guardé cambios.'
            });
        }

        const anterior =
            datos[id] && typeof datos[id] === 'object'
                ? datos[id]
                : {};

        if (anterior.nombre) {
            return sock.sendMessage(
                from,
                { text: '✅ Ya estás registrado.' },
                { quoted: m }
            );
        }

        try {
            const db = obtenerBaseEconomia();
            const users = db.data.users;
            const clave = claveEconomia(users, usuarioOriginal, id);
            const usuarioDb = users[clave] ||= {};

            const yaRecibioBono =
                Boolean(anterior.bonoRegistroOwner) ||
                Boolean(usuarioDb.bonoRegistroOwner);

            if (!yaRecibioBono) {
                usuarioDb.coin = Number(usuarioDb.coin || 0) + REGALO_MONEDAS;
                usuarioDb.exp = Number(usuarioDb.exp || 0) + REGALO_XP;
                usuarioDb.bonoRegistroOwner = true;

                try {
                    await db.write();
                } catch (error) {
                    usuarioDb.coin -= REGALO_MONEDAS;
                    usuarioDb.exp -= REGALO_XP;
                    delete usuarioDb.bonoRegistroOwner;
                    throw error;
                }
            }

            const registro = Object.assign({}, anterior, {
                nombre,
                fecha: anterior.fecha || new Date().toISOString()
            });

            registro.bonoRegistroOwner =
                anterior.bonoRegistroOwner ||
                (usuarioDb.bonoRegistroOwner
                    ? { fecha: new Date().toISOString() }
                    : null);

            if (!registro.bonoRegistroOwner) {
                delete registro.bonoRegistroOwner;
            }

            datos[id] = registro;
            fs.writeFileSync(archivo, JSON.stringify(datos, null, 2));

            const mensaje = yaRecibioBono
                ? '✅ Registro guardado. El bono de bienvenida ya se había entregado; no se duplicó.'
                : '✅ Registro guardado.\n\n🎁 Bono de bienvenida: *+50,000 monedas* y *+1,000 XP*.';

            sock.__channelButtonChats = sock.__channelButtonChats || new Set();
            sock.__channelButtonChats.add(from);
            return sock.sendMessage(
                from,
                { text: mensaje },
                { quoted: m }
            );
        } catch (error) {
            console.error('Error al registrar y entregar bono:', error.message);

            return sock.sendMessage(
                from,
                {
                    text: '❌ No pude guardar el registro y su bono. No vuelvas a intentarlo aún; avisa al owner para revisar la base de datos.'
                },
                { quoted: m }
            );
        }
    }
};
