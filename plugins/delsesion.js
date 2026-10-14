'use strict';

const fs = require('fs');
const path = require('path');
const { db } = require('../src/database/db');

const OWNER_ID = '126951364800652';

function limpiarNumero(valor) {
    return String(valor || '')
        .split(':')[0]
        .split('@')[0]
        .replace(/[^0-9]/g, '');
}

function ultimos10(valor) {
    return limpiarNumero(valor).slice(-10);
}

function esOwner(m, ctx, from) {
    const candidatos = [
        ctx.senderJid,
        ctx.senderNum,
        m.sender,
        m.key?.participantAlt,
        m.key?.participant
    ];

    if (!String(from || '').endsWith('@g.us')) {
        candidatos.push(m.key?.remoteJidAlt, m.key?.remoteJid);
    }

    return candidatos.some(valor => limpiarNumero(valor) === OWNER_ID);
}

async function responder(sock, from, m, text) {
    return sock.sendMessage(from, { text }, { quoted: m });
}

async function cerrarSubbot(jid) {
    const conexion = global.subbotSockets?.get(jid);

    if (conexion) {
        await conexion.logout().catch(() => {});
        global.subbotSockets?.delete(jid);
    }

    if (!global.alastorsubs) {
        throw new Error('No está configurada la carpeta de sesiones de subbots.');
    }

    const raiz = path.resolve(global.alastorsubs);
    const carpeta = path.resolve(raiz, jid);

    if (!carpeta.startsWith(raiz + path.sep)) {
        throw new Error('La ruta de sesión no es válida.');
    }

    await fs.promises.rm(carpeta, { recursive: true, force: true });
    db.prepare('DELETE FROM subbots WHERE jid = ?').run(jid);
}

module.exports = {
    command: ['delsesion', 'cerrarsesion'],

    execute: async (m, ctx) => {
        const {
            sock, from, senderJid, senderNum,
            command, args, text
        } = ctx;

        const cuerpo = String(
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            ''
        ).trim();

        const partes = cuerpo.split(/\s+/).filter(Boolean);
        const comando = String(
            command || partes[0]?.replace(/^[.#$!+]/, '') || ''
        ).toLowerCase();

        let numeroObjetivo;

        if (comando === 'cerrarsesion') {
            if (!esOwner(m, ctx, from)) {
                return responder(sock, from, m, '⛔ Solo el owner puede cerrar sesiones de subbots.');
            }

            const argumentos = Array.isArray(args)
                ? args
                : String(args || '').split(/\s+/).filter(Boolean);

            const primerArgumento = argumentos[0] ||
                String(text || '').trim().split(/\s+/)[0] ||
                partes[1] ||
                '';

            numeroObjetivo = ultimos10(primerArgumento);

            if (numeroObjetivo.length !== 10) {
                return responder(sock, from, m, 'Uso: .cerrarsesion 8146379657');
            }

            const numeroPrincipal = ultimos10(
                sock.user?.id || sock.authState?.creds?.me?.id
            );

            if (numeroPrincipal && numeroPrincipal === numeroObjetivo) {
                return responder(sock, from, m, '⛔ No cierro la sesión principal desde este comando.');
            }
        } else {
            const candidatos = [
                senderJid,
                senderNum,
                m.sender,
                m.key?.participantAlt,
                m.key?.participant
            ];

            if (!String(from || '').endsWith('@g.us')) {
                candidatos.push(m.key?.remoteJidAlt, m.key?.remoteJid);
            }

            const numerosUnicos = [...new Set(
                candidatos
                    .filter(Boolean)
                    .map(ultimos10)
                    .filter(numero => numero.length === 10)
            )];

            if (!numerosUnicos.length) {
                return responder(
                    sock, from, m,
                    '⚠️ No pude identificar tu número real. Intenta usar .delsesion desde un chat privado.'
                );
            }

            const subbots = db.prepare('SELECT jid, status FROM subbots').all();
            const encontrados = subbots.filter(bot =>
                numerosUnicos.includes(ultimos10(bot.jid))
            );

            if (!encontrados.length) {
                return responder(sock, from, m, 'ℹ️ No encontré un sub-bot vinculado a tu número.');
            }

            if (encontrados.length > 1) {
                return responder(sock, from, m, '⚠️ Encontré varias sesiones asociadas; no hice cambios.');
            }

            return cerrarYResponder(encontrados[0].jid, sock, from, m);
        }

        const subbots = db.prepare('SELECT jid, status FROM subbots').all();
        const encontrados = subbots.filter(bot =>
            ultimos10(bot.jid) === numeroObjetivo
        );

        if (!encontrados.length) {
            return responder(sock, from, m, 'ℹ️ No encontré un sub-bot registrado con ese número.');
        }

        if (encontrados.length > 1) {
            return responder(sock, from, m, '⚠️ Hay varias sesiones que coinciden con ese número; no hice cambios.');
        }

        return cerrarYResponder(encontrados[0].jid, sock, from, m);
    }
};

async function cerrarYResponder(jid, sock, from, m) {
    try {
        await responder(sock, from, m, '⌛ Cerrando la sesión del sub-bot...');
        await cerrarSubbot(jid);
        return responder(
            sock, from, m,
            '✅ Sesión cerrada y desvinculada. La sesión principal no fue afectada.'
        );
    } catch (error) {
        console.error('Error al cerrar sesión de subbot:', error.message);
        return responder(sock, from, m, '❌ No pude cerrar esa sesión de sub-bot.');
    }
}
