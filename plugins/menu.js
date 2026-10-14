'use strict';

const fs = require('fs');
const path = require('path');

function normalizeJid(value) {
    return String(value || '').replace(/:\d+(?=@)/, '').toLowerCase();
}

function asPhoneJid(value) {
    const jid = normalizeJid(value);
    if (jid.endsWith('@s.whatsapp.net')) return jid;
    if (/^\+?\d{10,15}$/.test(jid)) return `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    return null;
}

async function getMentionJid(m, sock, from) {
    // En Baileys 7 el remitente puede llegar como LID; prioriza su PN alternativo.
    const candidates = [
        m?.key?.participantAlt,
        m?.key?.remoteJidAlt,
        m?.participantAlt,
        m?.senderAlt,
        m?.sender,
        m?.key?.participant,
        m?.participant,
        from && !String(from).endsWith('@g.us') ? from : null
    ].map(normalizeJid).filter(Boolean);

    const phoneJid = candidates.map(asPhoneJid).find(Boolean);
    if (phoneJid) return phoneJid;

    if (String(from || '').endsWith('@g.us') && typeof sock?.groupMetadata === 'function') {
        try {
            const metadata = await sock.groupMetadata(from);
            const wanted = new Set(candidates);
            const wantedDigits = new Set(candidates.map(value => value.split('@')[0].replace(/\D/g, '')).filter(Boolean));
            const participant = (metadata?.participants || []).find(p => {
                const ids = [p?.id, p?.jid, p?.lid, p?.phoneNumber, p?.participantAlt]
                    .map(normalizeJid).filter(Boolean);
                return ids.some(id => wanted.has(id) || wantedDigits.has(id.split('@')[0].replace(/\D/g, '')));
            });
            const resolved = [participant?.phoneNumber, participant?.participantAlt, participant?.id, participant?.jid]
                .map(asPhoneJid).find(Boolean);
            if (resolved) return resolved;
        } catch (error) {
            console.error('[MENU] No pude resolver el PN de la mención:', error?.message || error);
        }
    }

    // No expongas un LID en el texto si no se pudo resolver el número real.
    return null;
}

function row(command, description = '') {
    const rawCommand = String(command || '').trim();
    const displayCommand = rawCommand.startsWith('.') ? rawCommand : `.${rawCommand}`;
    return `│ ✿ *${displayCommand}*${description ? ` — ${description}` : ''}`;
}

function sector(name, subtitle, commands) {
    return `🌸╭───〔 *SECTOR│ ${name}* 〕───╮\n` +
        `│ _${subtitle}_\n` + commands.map(item => row(item[0], item[1])).join('\n') +
        `\n🌸╰────────────────────╯`;
}

module.exports = {
    command: ['menu', 'help', 'ayuda'],
    execute: async (m, { sock, from }) => {
        const jid = await getMentionJid(m, sock, from);
        const tag = jid ? `@${jid.split('@')[0]}` : (m?.pushName || 'amigo');
        const heading =
            `╭─〔 🌸 *𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫* 🌸 〕─╮\n` +
            `│ 🌷 Hola, *${tag}*\n` +
            `╰────────────────────────╯`;

        const info =
            `🌷╭───〔 *INFORMACIÓN* 〕───╮\n` +
            `│ ✿ Tipo: Bot principal\n` +
            `│ ✿ Sistema: Android\n` +
            `│ ✿ Usuario: ${tag}\n` +
            `│ ✿ Prefijo: .\n` +
            `│ ✿ Desarrollador: Axel A.\n` +
            `│ 📣 Ver Canal: al final del menú\n` +
            `🌷╰──────────────────────╯`;

        const sections = [
            sector('OWNER', 'Comandos del propietario', [
                ['setbanner', 'Cambiar imagen del menú'],
                ['setname', 'Cambiar nombre del bot'],
                ['kickall', 'Expulsar a todos los integrantes'],
                ['chetar', 'Asignar recursos'],
                ['deschetar', 'Restablecer recursos'],
                ['invite / .join', 'Unir el bot usando una invitación'],
                ['salir / .leave', 'Hacer que el bot salga del grupo'],
                ['quitarcoin @usuario <cantidad>', 'Quitar MatikaCoins']
            ]),

            sector('HOME', 'Inicio e información', [
                ['reg <nombre.edad>', 'Registrarte'],
                ['unreg', 'Eliminar tu registro'],
                ['menu / .help / .ayuda', 'Mostrar este menú'],
                ['owner', 'Datos del desarrollador'],
                ['info', 'Información del bot'],
                ['ping', 'Estado del bot'],
                ['autoadmin', 'Auto administrador'],
                ['delsesion', 'Cerrar tu subbot']
            ]),

            sector('ECONOMY', 'Comandos de economía', [
                ['trabajar', 'Ganar MatikaCoins'],
                ['minar', 'Conseguir MatikaCoins y XP (15 min)'],
                ['pescar', 'Conseguir MatikaCoins y XP (15 min)'],
                ['minar', 'Conseguir MatikaCoins y XP (15 min)'],
                ['pescar', 'Conseguir MatikaCoins y XP (15 min)'],
                ['semanal', 'Reclamar regalo semanal'],
                ['bank', 'Ver saldo y comandos'],
                ['perfil', 'Ver perfil y MatikaCoins'],
                ['depositar <cantidad>', 'Guardar MatikaCoins en el banco'],
                ['d all', 'Depositar todo el efectivo en el banco'],
                ['retirar <cantidad>', 'Retirar MatikaCoins del banco'],
                ['transferir <cantidad> @usuario', 'Transferir MatikaCoins'],
                ['buy <cantidad>', 'Comprar MatikaCoins con XP'],
                ['slot <cantidad>', 'Apostar XP'],
                ['ruleta <cantidad> rojo/negro/verde/verde', 'Jugar ruleta'],
                ['robar @usuario', 'Intentar robar MatikaCoins'],
                ['robxp @usuario', 'Intentar robar XP']
            ]),

            sector('LEVELS', 'Nivel y experiencia', [
                ['levelup', 'Consultar nivel y rango'],
                ['lvl', 'Alias de nivel'],
                ['nivel', 'Alias de nivel']
            ]),

            sector('POKÉMON', 'Aventura y colección', [
                ['pokemon', 'Encontrar un Pokémon salvaje'],
                ['pkatrapar <bola>', 'Intentar atrapar un Pokémon'],
                ['pokemones', 'Ver Pokémon capturados'],
                ['pkinv', 'Ver inventario Pokémon'],
                ['pktienda', 'Abrir tienda Pokémon'],
                ['pkaventura', 'Iniciar aventura'],
                ['pkvender', 'Vender un Pokémon'],
                ['pkcurar', 'Curar un Pokémon'],
                ['pkevolucionar', 'Evolucionar un Pokémon']
            ]),

            sector('GACHA', 'Personajes y waifus', [
                ['rw', 'Mostrar personaje aleatorio'],
                ['claim / .c', 'Reclamar personaje; responde a su tarjeta'],
                ['harem', 'Ver personajes reclamados'],
                ['regalar <nombre> @usuario', 'Regalar personaje'],
                ['robarwaifu <nombre o ID>', 'Intentar robar personaje'],
                ['comprartoken / .buytoken', 'Comprar token de protección'],
                ['proteccion', 'Proteger personaje'],
                ['tokenall', 'Proteger todos; cobra MatikaCoins'],
                ['wimage <nombre>', 'Buscar imagen del personaje'],
                ['winfo <nombre>', 'Ver información del personaje']
            ]),

            sector('GROUP', 'Comandos para administrar grupos', [
                ['antilink on/off', 'Bloquear invitaciones de WhatsApp'],
                ['antilink2 on/off', 'Bloquear enlaces externos; permite YouTube'],
                ['adminnotify', 'Avisos automáticos al dar o quitar administrador'],
                ['link', 'Obtener enlace de invitación del grupo'],
                ['del', 'Borrar mensaje citado'],
                ['grupocerrar', 'Cerrar el grupo'],
                ['grupoabrir', 'Abrir el grupo'],
                ['kick @usuario', 'Expulsar usuario'],
                ['promote @usuario', 'Dar administrador'],
                ['demote @usuario', 'Quitar administrador'],
                ['setmeta', 'Cambiar metadatos del grupo'],
                ['setdesc', 'Cambiar descripción del grupo'],
                ['welcome on/off', 'Activar bienvenida'],
                ['bye on/off', 'Activar despedida'],
                ['setwelcome', 'Configurar bienvenida'],
                ['setbye', 'Configurar despedida'],
                ['warn @usuario motivo', 'Advertir usuario'],
                ['warnings @usuario', 'Ver advertencias'],
                ['delwarn @usuario', 'Eliminar advertencia'],
                ['unwarn @usuario', 'Quitar advertencia'],
                ['listadv / .listaadv', 'Ver advertencias del grupo'],
                ['mute @usuario', 'Silenciar a un integrante'],
                ['unmute @usuario', 'Permitirle hablar de nuevo'],
                ['antibot2 on/off', 'Salida del subbot si está el principal'],
                ['autoaudio on/off', 'Responder con audios por palabras clave'],
                ['autorechazar on/off', 'Rechazar solicitudes por prefijo'],
                ['autoaceptar on/off', 'Aceptar solicitudes cuyo número inicia en 5'],
                ['tagall', 'Mencionar integrantes']
            ]),

            sector('SOCIAL', 'Parejas, sorteos y diversión', [
                ['formarpareja', 'Formar una pareja aleatoria'],
                ['formarpareja5', 'Mostrar cinco parejas aleatorias'],
                ['ship nombre1 nombre2', 'Calcular compatibilidad'],
                ['piropo', 'Enviar un piropo SFW'],
                ['sorteo <premio>', 'Sortear un premio'],
                ['marry @usuario', 'Proponer matrimonio'],
                ['divorce', 'Divorciarse'],
                ['baltop', 'Ver el top de MatikaCoins']
            ]),

            sector('MEDIA', 'Música, videos e imágenes', [
                ['play', 'Buscar música o video y elegir formato'],
                ['pfp @usuario', 'Ver foto de perfil'],
                ['togifaud', 'Enviar un video como GIF'],
                ['spotify', 'Buscar audio'],
                ['ig / .instagram', 'Descargar Instagram'],
                ['fb / .facebook', 'Descargar Facebook'],
                ['tiktok', 'Descargar TikTok'],
                ['mediafire <url>', 'Descargar un archivo de MediaFire'],
                ['apk <app>', 'Buscar y enviar APK desde Aptoide'],
                ['pin / .pinterest', 'Buscar imágenes en Pinterest']
            ]),

            sector('ANIME', 'Reacciones', [
                ['angry', ''], ['bath', ''], ['bite', ''], ['bleh', ''],
                ['blush', ''], ['bored', ''], ['clap', ''], ['coffee', ''],
                ['cry', ''], ['cuddle', ''], ['dance', ''], ['drunk', ''],
                ['eat', ''], ['facepalm', ''], ['happy', ''], ['hug', ''],
                ['kill', ''], ['kiss', ''], ['laugh', ''], ['lick', ''],
                ['love', ''], ['pat', ''], ['poke', ''], ['pout', ''],
                ['punch', ''], ['run', ''], ['sad', ''], ['scared', ''],
                ['shy', ''], ['slap', ''], ['sleep', ''], ['smoke', ''],
                ['think', '']
            ]),

            sector('STICKERS', 'Crear y personalizar stickers', [
                ['sticker', 'Crear sticker'],
                ['HD <imagen>', 'Mejorar calidad de imagen'],
                ['sticker2', 'Crear sticker 2'],
                ['stickersearch <tema>', 'Buscar paquetes en Sticker.ly'],
                ['s', 'Crear sticker personalizado'],
                ['brat <texto>', 'Crear sticker Brat con texto negro sobre fondo blanco'],
            ]),

            sector('WARNINGS & UTILS', 'Advertencias y utilidades', [
                ['afk <motivo>', 'Activar modo ausente'],
                ['read', 'Recuperar mensaje de una sola vista'],
                ['toimg', 'Convertir a imagen'],
                ['report <problema>', 'Enviar reporte con tu número y enlace de contacto'],
                ['admins <texto>', 'Avisar a los administradores del grupo'],
                ['tiktoksearch <tema>', 'Buscar videos en TikTok'],
                ['youtubesearch <tema>', 'Buscar videos en YouTube'],
                ['randomplay', 'Enviar canción aleatoria de YouTube'],
                ['top <tema>', 'Crear top aleatorio']
            ]),

            sector('SYSTEM', 'Subbots y sistema', [
                ['code / serbot', 'Código de conexión'],
                ['subbots', 'Gestionar subbots'],
                ['.genpremium 30d', 'Generar código premium (owner)'],
                ['.premium <código>', 'Canjear premium en privado'],
                ['.premiuminfo', 'Ver vigencia premium'],
                ['restart', 'Reiniciar bot'],
                ['bot on/off', 'Activar o apagar bots']
            ]),

            sector('IA', 'Inteligencia artificial', [
                ['ia <pregunta>', 'Hablar con Gemini'],
                ['mambo <mensaje>', 'Hablar con Mambo'],
            ])
        ];

        const text = `${heading}\n${info}\n\n${sections.join('\n\n')}\n\n` +
            `🌸━━━━━━━━━━━━━━━━━━━━🌸\n` +
            `*𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫* · Powered by Ao Ork\n` +
            `🌸━━━━━━━━━━━━━━━━━━━━🌸\n\n` +
            `⚠️ Usa los comandos con el prefijo .\n\n📣 *Ver Canal:*\nhttps://whatsapp.com/channel/0029VbD53WDGZNCqmpU0zY0E`;

        const animatedBanner = path.join(__dirname, 'menu-banner.mp4');
        const customImage = ['jpg', 'jpeg', 'png', 'webp']
            .map(ext => path.join(__dirname, `menu-banner.${ext}`))
            .find(file => fs.existsSync(file));
        const fallbackImage = '/sdcard/Download/menu.jpg';
        const mentions = jid ? [jid] : [];
        const caption = '🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸 — Powered by Ao Ork';

        let bannerSent = false;
        if (fs.existsSync(animatedBanner)) {
            try {
                await sock.sendMessage(from, {
                    video: fs.readFileSync(animatedBanner),
                    gifPlayback: true,
                    caption
                }, { quoted: m });
                bannerSent = true;
            } catch (error) {
                console.error('[MENU] Falló el banner animado; intentaré la imagen fija:', error?.message || error);
            }
        }

        if (!bannerSent) {
            const imagePath = customImage || fallbackImage;
            if (fs.existsSync(imagePath)) {
                try {
                    await sock.sendMessage(from, {
                        image: fs.readFileSync(imagePath),
                        mimetype: 'image/jpeg',
                        caption
                    }, { quoted: m });
                    bannerSent = true;
                } catch (error) {
                    console.error('[MENU] Falló la imagen del menú; enviaré solo el texto:', error?.message || error);
                }
            }
        }

        // Pausa breve entre el banner y el menú; el enlace va al final del mismo texto.
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Enviar el menú con un CTA URL real y conservar la URL visible al final.
        const channelUrl = 'https://whatsapp.com/channel/0029VbD53WDGZNCqmpU0zY0E';
        try {
            const helperBotones = await import('zqbaileys_helper');
            const sendButtons =
                helperBotones.sendButtons || helperBotones.default?.sendButtons;
            if (typeof sendButtons !== 'function') {
                throw new Error('El helper no exporta sendButtons');
            }
            await sendButtons(sock, from, {
                title: '🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸',
                text,
                mentions,
                footer: 'Canal oficial de 🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸',
                buttons: [{
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: 'Ver Canal',
                        url: channelUrl
                    })
                }]
            });
        } catch (error) {
            console.error('[MENU] No pude enviar el botón URL; mandaré el menú normal:', error?.message || error);
            await sock.sendMessage(from, { text, mentions }, { quoted: m });
        }
    }
};
