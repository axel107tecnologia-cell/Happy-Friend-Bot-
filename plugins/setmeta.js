'use strict';

module.exports = {
    command: ['setmeta', 'delmeta'],
    group: true,

    execute: async (m, {
        sock,
        conn,
        from,
        senderJid,
        args = [],
        text = '',
        command,
        usedPrefix
    }) => {
        const socket = sock || conn;
        const chatId = from || m.chat;
        const sender = m.sender || senderJid ||
            m.key?.participant || m.key?.participantAlt;

        const responder = mensaje => socket.sendMessage(
            chatId,
            { text: mensaje },
            { quoted: m }
        );

        if (!sender || sender === chatId) {
            return responder('No pude identificar tu cuenta para guardar tus metadatos.');
        }

        const db = global.db;
        if (!db?.data || typeof db.write !== 'function') {
            return responder('No pude guardar el cambio en la base de datos.');
        }

        db.data.users ||= {};
        const usuario = db.data.users[sender] ||= {};
        const cmd = String(command || '').toLowerCase();

        const anterior1 = usuario.text1;
        const anterior2 = usuario.text2;

        if (cmd === 'delmeta') {
            if (!usuario.text1 && !usuario.text2) {
                return responder('No tienes metadatos personalizados guardados.');
            }

            delete usuario.text1;
            delete usuario.text2;

            try {
                await db.write();
                return responder('Se restableció tu pack y autor por defecto.');
            } catch (error) {
                if (anterior1 === undefined) delete usuario.text1;
                else usuario.text1 = anterior1;

                if (anterior2 === undefined) delete usuario.text2;
                else usuario.text2 = anterior2;

                console.error('Error en delmeta:', error);
                return responder('No pude guardar el cambio; tus metadatos siguen igual.');
            }
        }

        const entrada = String(text || args.join(' ') || '').trim();
        if (!entrada) {
            const prefijo = usedPrefix || '.';
            return responder(
                'Uso: ' + prefijo + 'setmeta Nombre del pack | Autor\n' +
                'Ejemplo: ' + prefijo + 'setmeta Mi pack | Axel'
            );
        }

        const separador = entrada.search(/[|•]/);
        const pack = separador < 0
            ? entrada
            : entrada.slice(0, separador).trim();
        const autor = separador < 0
            ? ''
            : entrada.slice(separador + 1).trim();

        if (!pack && !autor) {
            return responder('Escribe al menos el nombre del pack o el autor.');
        }

        usuario.text1 = pack;
        usuario.text2 = autor;

        try {
            await db.write();
            return responder(
                'Metadatos guardados para tus stickers.\n' +
                'Pack: ' + (pack || '(vacío)') + '\n' +
                'Autor: ' + (autor || '(vacío)')
            );
        } catch (error) {
            if (anterior1 === undefined) delete usuario.text1;
            else usuario.text1 = anterior1;

            if (anterior2 === undefined) delete usuario.text2;
            else usuario.text2 = anterior2;

            console.error('Error en setmeta:', error);
            return responder('No pude guardar el cambio; tus metadatos siguen igual.');
        }
    }
};
