const { fancyText } = require('./fancy.js');
require('../settings');
const { default: makeWASocket, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, getContentType, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const chalk = require('chalk');
const { useSQLiteAuthState } = require('../src/database/db');

async function connectBot(options = {}) {
    const mod = await import('../src/handler.js');
    const handlerModule = mod.default || mod;
    const handler = handlerModule.handler || handlerModule;

    const { basePath, jid, isSub = false, pairingNumber = null, qrCallback = null, onCode = null, onConnected = null } = options;
    const { state, saveCreds, clearDb } = await useSQLiteAuthState(basePath, jid);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 5000,
        connectTimeoutMs: 60000,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        }
    });


    // Cache local de contactos y chats para comandos como .addstatus.
    sock.chats = sock.chats || {};

    const guardarContactos = data => {
        const lista = Array.isArray(data) ? data : data?.contacts;
        if (!Array.isArray(lista)) return;

        for (const contacto of lista) {
            const id = String(
                contacto?.id || contacto?.jid || contacto?.phoneNumber || ''
            ).toLowerCase();
            if (!id || id === 'status@broadcast') continue;

            sock.chats[id] = {
                ...(sock.chats[id] || {}),
                ...contacto,
                id
            };
        }
    };

    const guardarChats = data => {
        const lista = Array.isArray(data) ? data : data?.chats;
        if (!Array.isArray(lista)) return;

        for (const chat of lista) {
            const id = String(chat?.id || '').toLowerCase();
            if (!id || id === 'status@broadcast') continue;

            sock.chats[id] = {
                ...(sock.chats[id] || {}),
                ...chat,
                id
            };
        }
    };

    sock.ev.on('contacts.set', guardarContactos);
    sock.ev.on('contacts.upsert', guardarContactos);
    sock.ev.on('contacts.update', guardarContactos);
    sock.ev.on('chats.set', guardarChats);
    sock.ev.on('chats.upsert', guardarChats);

    sock.__isSub = Boolean(isSub);

    if (isSub && jid) {
        global.subbotSockets = global.subbotSockets || new Map();
        global.subbotSockets.set(String(jid), sock);
    } else if (!isSub) {
        global.mainBotSocket = sock;
    }

    const originalSendMessage = sock.sendMessage.bind(sock);
    sock.__channelButtonChats = sock.__channelButtonChats || new Set();

    sock.sendMessage = async (jid, content, options) => {
        if (content && typeof content === 'object') {
            content = { ...content };
            if (typeof content.text === 'string') {
                content.text = fancyText(content.text);
            }
            if (typeof content.caption === 'string') {
                content.caption = fancyText(content.caption);
            }
        }

        const tiposMultimedia = [
            'image', 'video', 'audio', 'document', 'sticker',
            'contacts', 'contact', 'location', 'liveLocation',
            'poll', 'interactiveMessage'
        ];
        const soloTexto = content &&
            typeof content.text === 'string' &&
            !tiposMultimedia.some(tipo => content[tipo] != null);

        if (soloTexto && sock.__channelButtonChats.has(jid)) {
            sock.__channelButtonChats.delete(jid);
            try {
                const helperBotones = await import('zqbaileys_helper');
                const sendButtons =
                    helperBotones.sendButtons || helperBotones.default?.sendButtons;

                if (typeof sendButtons !== 'function') {
                    throw new Error('El helper no exporta sendButtons');
                }

                return await sendButtons(sock, jid, {
                    title: 'Canal oficial',
                    text: content.text,
                    mentions: content.mentions || [],
                    footer: 'Canal oficial',
                    buttons: [{
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'Ver Canal',
                            url: 'https://whatsapp.com/channel/0029VbD53WDGZNCqmpU0zY0E'
                        })
                    }]
                });
            } catch (error) {
                console.error('[CANAL] No pude integrar el botón:', error?.message || error);
            }
        }

        return originalSendMessage(jid, content, options);
    };

    if (!sock.authState.creds.registered && pairingNumber) {
        const solicitarCodigo = async intento => {
            try {
                let numero = pairingNumber.replace(/[^0-9]/g, '');

                if (
                    numero.startsWith('52') &&
                    !numero.startsWith('521')
                ) {
                    numero = '521' + numero.slice(2);
                }

                const code = await sock.requestPairingCode(numero);
                const codigoFormateado =
                    code?.match(/.{1,4}/g)?.join('-') || code;

                if (onCode) {
                    await onCode(codigoFormateado);
                }

                console.log('✅ Código de vinculación generado');
            } catch (error) {
                console.error(
                    `⚠️ Intento ${intento}/4: no se pudo solicitar el código:`,
                    error.message
                );

                if (intento < 4) {
                    setTimeout(
                        () => solicitarCodigo(intento + 1),
                        7000
                    );
                } else {
                    console.error(
                        '❌ No se pudo generar el código después de varios intentos.'
                    );
                }
            }
        };

        setTimeout(() => solicitarCodigo(1), 12000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && qrCallback) qrCallback(qr);

        if (connection === 'open') {
            console.log(chalk.bgRed.black.bold(` 📻 TRANSMISIÓN EN VIVO: ${sock.user.id.split(':')[0]} `));
            try {
                const infoCanal = await sock.newsletterMetadata(
                    'invite',
                    '0029VbD53WDGZNCqmpU0zY0E'
                );

                console.log('📢 Canal oficial consultado.');
            } catch (error) {
                console.log('⚠️ No se pudo consultar el canal:', error.message);
            }

            if (onConnected) onConnected(sock);
        }

        if (connection === 'close') {
            if (
                isSub &&
                jid &&
                global.subbotSockets?.get(String(jid)) === sock
            ) {
                global.subbotSockets.delete(String(jid));
            }
            let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

            if (reason === DisconnectReason.badSession) {
                console.log(chalk.bold.cyanBright(`\n⚠️ SESIÓN CORRUPTA. ${!isSub ? 'BORRANDO DB PRINCIPAL...' : 'SUB-BOT DETENIDO.'}`));
                if (!isSub) await clearDb();
            } else if (reason === DisconnectReason.connectionClosed) {
                console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄ • • • ┄┄┄┄\n┆ ⚠️ CONEXIÓN CERRADA, RECONECTANDO....\n╰┄┄┄┄ • • • ┄┄┄┄`));
                setTimeout(() => connectBot(options), 5000);
            } else if (reason === DisconnectReason.connectionLost) {
                console.log(chalk.bold.blueBright(`\n╭┄┄┄┄ • • • ┄┄┄┄\n┆ ⚠️ CONEXIÓN PERDIDA, RECONECTANDO....\n╰┄┄┄┄ • • • ┄┄┄┄`));
                setTimeout(() => connectBot(options), 5000);
            } else if (reason === DisconnectReason.connectionReplaced) {
                console.log(chalk.bold.yellowBright(`\n⚠️ CONEXIÓN REEMPLAZADA, CIERRE LA OTRA SESIÓN PRIMERO.`));
            } else if (reason === DisconnectReason.loggedOut) {
                console.log(chalk.bold.redBright(`\n⚠️ DISPOSITIVO DESCONECTADO. ${!isSub ? 'LIMPIANDO DB PRINCIPAL...' : 'ELIMINANDO SESIÓN DE SUB-BOT.'}`));
                if (!isSub) await clearDb();
            } else if (reason === DisconnectReason.restartRequired) {
                console.log(chalk.bold.cyanBright(`\n🔄 REINICIO REQUERIDO, CONECTANDO...`));
                connectBot(options);
            } else if (reason === DisconnectReason.timedOut) {
                console.log(chalk.bold.yellowBright(`\n⌛ TIEMPO AGOTADO, RECONECTANDO....`));
                setTimeout(() => connectBot(options), 5000);
            } else {
                console.log(chalk.bold.redBright(`\n⚠️ RAZÓN DESCONOCIDA (${reason}), REINTENTANDO...`));
                setTimeout(() => connectBot(options), 5000);
            }
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const m = chatUpdate.messages[0];
        if (!m.message) return;

        const from = m.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const type = getContentType(m.message);
        const pushName = m.pushName || 'Alma en pena';
        const hora = new Date().toLocaleTimeString('es-DO', { hour12: false });
        const color = isSub ? '#8A2BE2' : '#FF0000';
        let body = String(m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '');
        const sender = isGroup ? (m.key.participant || from) : from;
        const senderNum = sender ? sender.split('@')[0] : '0';

        console.log(chalk.hex(color)(`📻-------------------------------------------📻`));
        console.log(chalk.hex(color)(` `) + chalk.bold.white(` BOT: `) + chalk.red(`${global.botname || 'Alastor'} ${isSub ? '(SUB)' : '(MAIN)'}`));
        console.log(chalk.hex(color)(` `) + chalk.bold.white(` HORA: `) + chalk.cyan(hora));
        console.log(chalk.hex(color)(` `) + chalk.bold.white(` OYENTE: `) + chalk.green(`${pushName} (${senderNum})`));
        console.log(chalk.hex(color)(` `) + chalk.bold.white(` CANAL: `) + chalk.magenta(isGroup ? 'Grupo' : 'Privado'));
        console.log(chalk.hex(color)(` `) + chalk.bold.white(` FRECUENCIA: `) + chalk.white(type || 'Unknown'));
        console.log(chalk.hex(color)(`+-------------------------------------------+`));
        console.log(chalk.hex(color)(` `) + chalk.italic.gray(` Msg: ${body.substring(0, 35).replace(/\n/g, ' ')}...`));
        console.log(chalk.hex(color)(`📻-------------------------------------------📻`));

        // --- ENVIAMOS SOCK DIRECTAMENTE COMO CONTEXTO Y CHATUPDATE ---
        if (typeof handler === 'function') {
            try {
                await handler.call(sock, sock, chatUpdate, connectBot, isSub);
            } catch (error) {
                const cerrado =
                    Number(error?.output?.statusCode) === Number(DisconnectReason.connectionClosed) ||
                    /Connection Closed/i.test(error?.message || '') ||
                    /Connection Closed/i.test(error?.output?.payload?.message || '');

                if (cerrado) {
                    console.warn('⚠️ Mensaje interrumpido: el socket se cerró; la conexión intentará recuperarse.');
                    return;
                }

                console.error('❌ Error procesando mensaje:', error?.stack || error);
            }
        }
    });
}

    
module.exports = { connectBot };
