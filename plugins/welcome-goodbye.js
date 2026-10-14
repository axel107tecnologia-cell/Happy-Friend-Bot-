const fs = require('fs');
const path = require('path');

const FILE = 'welcome-settings.json';
const DIR = path.join('database', 'welcome-media');

function read() {
    try {
        return JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch {
        return {};
    }
}

function save(data) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function cfg(data, group) {
    if (!data[group]) {
        data[group] = {
            welcome: true,
            bye: true,
            welcomeText: '¡Bienvenido/a @user a @subject! 👋',
            byeText: 'Hasta luego, @user. 👋'
        };
    }
    return data[group];
}

function rawJid(value) {
    if (typeof value === 'string') return value;
    return value?.participantAlt || value?.phoneNumber || value?.idAlt ||
        value?.id || value?.jid || value?.participant || '';
}

function toJid(value) {
    const id = String(value || '').trim();
    if (!id) return '';

    if (id.includes('@')) return id;

    const digits = id.replace(/[^0-9]/g, '');
    return digits ? digits + '@s.whatsapp.net' : '';
}

function resolveParticipant(value, metadata) {
    const raw = rawJid(value);
    const participants = metadata?.participants || [];

    const found = participants.find(participant => {
        const ids = [
            participant?.id,
            participant?.jid,
            participant?.lid,
            participant?.phoneNumber,
            participant?.idAlt,
            participant?.participantAlt
        ].filter(Boolean).map(String);

        return ids.includes(raw);
    });

    const preferred =
        found?.phoneNumber ||
        found?.participantAlt ||
        found?.idAlt ||
        found?.id ||
        raw;

    return toJid(preferred);
}

async function resolveParticipantForMention(value, metadata, sock) {
    const jid = resolveParticipant(value, metadata);

    if (!/@lid$/i.test(jid)) return jid;

    try {
        const pn = await sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);
        if (pn) return toJid(pn);
    } catch (_) {}

    return jid;
}

function tag(jid) {
    const id = String(jid || '').replace(/:\d+(?=@)/, '');
    const local = id.split('@')[0].replace(/[^A-Za-z0-9._-]/g, '');
    return local ? '@' + local : '@miembro';
}

function render(template, users, subject, count) {
    let text = String(template || '');
    const hasCount = /@members|@miembros|@count/i.test(text);

    text = text
        .replace(/@user|@usuario/gi, users)
        .replace(/@subject|@grupo/gi, subject || 'este grupo')
        .replace(/@members|@miembros|@count/gi, String(count));

    if (!hasCount) {
        text += '\n\n👥 Miembros actuales: ' + count;
    }

    return text;
}

async function groupPhoto(sock, group) {
    try {
        const url = await sock.profilePictureUrl(group, 'image');
        if (!url) return null;

        const response = await fetch(url);
        if (!response.ok) return null;

        const buffer = Buffer.from(await response.arrayBuffer());

        // Evita intentar enviar una imagen anormalmente grande.
        if (!buffer.length || buffer.length > 5 * 1024 * 1024) return null;

        return buffer;
    } catch {
        return null;
    }
}


const installedWelcomeSockets = new WeakSet();

function installWelcomeListener(sock) {
    if (!sock?.ev || installedWelcomeSockets.has(sock)) return;
    installedWelcomeSockets.add(sock);

    sock.ev.on('group-participants.update', async update => {
        try {
            const chat = update?.id;
            const action = String(update?.action || '').toLowerCase();

            const type =
                action === 'add' || action === 'join' ? 'welcome' :
                action === 'remove' || action === 'leave' ? 'bye' :
                null;

            if (!chat || !type) return;

            const data = read();
            const settings = cfg(data, chat);
            if (settings[type] === false) return;

            const affected = Array.isArray(update.participants)
                ? update.participants
                : [];

            if (!affected.length) return;

            let metadata = null;
            try {
                await new Promise(resolve => setTimeout(resolve, 400));
                metadata = await sock.groupMetadata(chat);
            } catch (_) {}

            const resolved = await Promise.all(
                affected.map(user => resolveParticipantForMention(user, metadata, sock))
            );
            const members = [...new Set(resolved.filter(Boolean))];

            if (!members.length) return;

            const memberTags = members.map(tag).join(', ');
            const count = Array.isArray(metadata?.participants)
                ? metadata.participants.length
                : 'no disponible';

            const template = settings[type + 'Text'] ||
                (type === 'welcome'
                    ? '¡Bienvenido/a @user a @subject! 👋'
                    : 'Hasta luego, @user. 👋');

            const caption = render(
                template,
                memberTags,
                metadata?.subject || 'este grupo',
                count
            );

            const mentions = members;
            const enviarBienvenidaConBotones = async imagen => {
                const { sendInteractiveMessage } = require('zqbaileys_helper');
                let baileys;

                for (const paquete of ['baileys', '@whiskeysockets/baileys', '@adiwajshing/baileys']) {
                    try {
                        baileys = require(paquete);
                        if (
                            baileys.generateWAMessageContent ||
                            baileys.Utils?.generateWAMessageContent ||
                            baileys.prepareWAMessageMedia ||
                            baileys.Utils?.prepareWAMessageMedia
                        ) break;
                    } catch {}
                }

                const generar =
                    baileys?.generateWAMessageContent ||
                    baileys?.Utils?.generateWAMessageContent;
                const preparar =
                    baileys?.prepareWAMessageMedia ||
                    baileys?.Utils?.prepareWAMessageMedia;

                const header = {
                    title: '🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸'
                };

                if (imagen) {
                    if (typeof sock.waUploadToServer !== 'function') {
                        throw new Error('No está disponible la carga de imagen de Baileys.');
                    }

                    const mediaOptions = {
                        upload: sock.waUploadToServer.bind(sock),
                        logger: sock.logger,
                        userJid: sock.user?.id || sock.authState?.creds?.me?.id
                    };

                    let media;
                    if (generar) {
                        media = await generar({ image: imagen }, mediaOptions);
                    } else if (preparar) {
                        media = await preparar({ image: imagen }, mediaOptions);
                    } else {
                        throw new Error('Baileys no expone la preparación de imágenes.');
                    }

                    const imageMessage = media?.imageMessage || media?.message?.imageMessage;
                    if (!imageMessage) throw new Error('No se pudo preparar la foto de bienvenida.');

                    header.hasMediaAttachment = true;
                    header.imageMessage = imageMessage;
                }

                const botones = [
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'Menu',
                            id: '.menu'
                        })
                    },
                    {
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'Github del Owner',
                            url: 'https://github.com/axel107tecnologia-cell/Happy-Friend-Bot-'
                        })
                    }
                ];

                return sendInteractiveMessage(sock, chat, {
                    interactiveMessage: {
                        header,
                        body: { text: caption },
                        footer: { text: 'Dev. Ao Ork' },
                        contextInfo: { mentionedJid: mentions },
                        nativeFlowMessage: { buttons: botones }
                    }
                });
            };

            let photoUrl = null;

            try {
                photoUrl = await sock.profilePictureUrl(chat, 'image');
            } catch (_) {}

            if (photoUrl && caption.length <= 1024) {
                try {
                    if (type === 'welcome') {
                        return await enviarBienvenidaConBotones({ url: photoUrl });
                    }
                    return await sock.sendMessage(chat, {
                        image: { url: photoUrl },
                        caption,
                        mentions
                    });
                } catch (error) {
                    console.error('No pude enviar el aviso con foto del grupo:', error.message);
                }
            }

            const customImage = settings[type + 'Image'];
            if (customImage && fs.existsSync(customImage) && caption.length <= 1024) {
                try {
                    const imagen = fs.readFileSync(customImage);
                    if (type === 'welcome') {
                        return await enviarBienvenidaConBotones(imagen);
                    }
                    return await sock.sendMessage(chat, {
                        image: imagen,
                        caption,
                        mentions
                    });
                } catch (error) {
                    console.error('No pude enviar la imagen de respaldo:', error.message);
                }
            }

            if (type === 'welcome') {
                try {
                    return await enviarBienvenidaConBotones(null);
                } catch (error) {
                    console.error('No pude enviar la bienvenida con botones:', error.message);
                }
            }

            return await sock.sendMessage(chat, {
                text: caption,
                mentions
            });
        } catch (error) {
            console.error('Error en bienvenida/despedida:', error);
        }
    });
}

module.exports = {
    command: [
        'setwelcome', 'setbienvenida', 'setbye', 'setdespedida',
        'welcome', 'bienvenida', 'bye', 'despedida'
    ],
    group: true,
    admin: true,

    execute: async (m, { sock, from, args = [], text = '', command = '' }) => {
        const data = read();
        const settings = cfg(data, from);

        if (['welcome', 'bienvenida', 'bye', 'despedida'].includes(command)) {
            const value = String(args[0] || '').toLowerCase();

            if (!['on', 'off'].includes(value)) {
                return sock.sendMessage(
                    from,
                    { text: `Usa .\({command} on o .\){command} off` },
                    { quoted: m }
                );
            }

            const isWelcome = ['welcome', 'bienvenida'].includes(command);
            settings[isWelcome ? 'welcome' : 'bye'] = value === 'on';
            save(data);

            return sock.sendMessage(
                from,
                {
                    text: 'Función ' + command + ': ' +
                        (value === 'on' ? 'activada ✅' : 'desactivada ❌')
                },
                { quoted: m }
            );
        }

        const isWelcome = ['setwelcome', 'setbienvenida'].includes(command);
        const type = isWelcome ? 'welcome' : 'bye';

        if (!text && !m.quoted) {
            return sock.sendMessage(
                from,
                {
                    text:
                        `Escribe el mensaje para .set${type}.\n` +
                        'La foto se tomará automáticamente del grupo.'
                },
                { quoted: m }
            );
        }

        // Se conserva la opción antigua de imagen personalizada como respaldo
        // por si el grupo no tiene una foto accesible.
        if (m.quoted?.mimetype?.startsWith('image/')) {
            try {
                fs.mkdirSync(DIR, { recursive: true });
                const file = path.join(
                    DIR,
                    from.replace(/[^0-9]/g, '') + '-' + type + '.jpg'
                );
                fs.writeFileSync(file, await m.quoted.download());
                settings[type + 'Image'] = file;
            } catch (error) {
                console.error('No pude guardar la imagen personalizada:', error.message);
            }
        }

        if (text) {
            if (/^--sinimagen/i.test(text)) {
                delete settings[type + 'Image'];
            }
            settings[type + 'Text'] =
                text.replace(/^--sinimagen\s*/i, '').trim() ||
                settings[type + 'Text'];
        }

        save(data);

        return sock.sendMessage(
            from,
            { text: `✅ Mensaje de ${isWelcome ? 'bienvenida' : 'despedida'} actualizado.` },
            { quoted: m }
        );
    },

    before: async (_m, { sock } = {}) => {
        installWelcomeListener(sock);
    }
};
