'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const ejecutar = promisify(execFile);
const ejecutarYtDlp = (args, options) => ejecutar('python', ['-m', 'yt_dlp', ...args], options);
const API_BASE = 'https://ellen-api-three.vercel.app/api/youtube';
const MARCA = 'Descargado con 🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸';
const MAX_BYTES = 64 * 1024 * 1024;

function urlYouTube(valor) {
    try {
        const url = new URL(String(valor || '').trim());
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
            return null;
        }
        return url.toString();
    } catch {
        return null;
    }
}

function urlDeEntrada(entrada) {
    const enlace = entrada?.webpage_url || entrada?.original_url;
    if (enlace) return urlYouTube(enlace);
    if (entrada?.id) return 'https://www.youtube.com/watch?v=' + encodeURIComponent(entrada.id);
    return urlYouTube(entrada?.url);
}

async function obtenerVideo(consulta) {
    const directa = urlYouTube(consulta);

    if (directa) {
        const result = await ejecutarYtDlp( [
            '--no-playlist', '--no-warnings', '--dump-single-json',
            '--skip-download', directa
        ], { timeout: 120000, maxBuffer: 20 * 1024 * 1024 });

        const datos = JSON.parse(result.stdout);
        if (!datos?.title || datos.is_live) throw new Error('No se encontró un video disponible.');
        return { datos, url: urlDeEntrada(datos) || directa };
    }

    const busqueda = await ejecutarYtDlp( [
        '--no-warnings', '--flat-playlist', '--dump-single-json',
        '--skip-download', 'ytsearch5:' + consulta
    ], { timeout: 120000, maxBuffer: 20 * 1024 * 1024 });

    const entradas = JSON.parse(busqueda.stdout).entries || [];

    for (const entrada of entradas) {
        const candidata = urlDeEntrada(entrada);
        if (!candidata) continue;

        try {
            const resultado = await ejecutarYtDlp( [
                '--no-playlist', '--no-warnings', '--dump-single-json',
                '--skip-download', candidata
            ], { timeout: 120000, maxBuffer: 20 * 1024 * 1024 });

            const datos = JSON.parse(resultado.stdout);
            if (datos?.title && !datos.is_live) {
                return { datos, url: urlDeEntrada(datos) || candidata };
            }
        } catch {
            continue;
        }
    }

    throw new Error('No se encontró un video disponible.');
}

function duracion(segundos) {
    segundos = Number(segundos || 0);
    if (!segundos) return 'Desconocida';

    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const resto = segundos % 60;

    return horas
        ? horas + 'h ' + minutos + 'm ' + resto + 's'
        : minutos + 'm ' + resto + 's';
}

function vistas(valor) {
    return valor ? Number(valor).toLocaleString('es-MX') : 'Desconocidas';
}

function nombreSeguro(valor) {
    return String(valor || 'youtube')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100) || 'youtube';
}

function codificarUrl(url) {
    return Buffer.from(url, 'utf8').toString('base64url');
}

function decodificarUrl(token) {
    try {
        return urlYouTube(Buffer.from(String(token || ''), 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

async function bajarAudio(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180000);

    try {
        const respuesta = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, type: 'audio', upload: false }),
            signal: controller.signal
        });

        const texto = await respuesta.text();
        let datos;
        try {
            datos = JSON.parse(texto);
        } catch {
            throw new Error('Respuesta inválida del servicio de audio.');
        }

        if (!respuesta.ok || datos.success === false || !datos.url) {
            throw new Error(datos.message || datos.error || 'No se obtuvo el audio.');
        }

        const enlace = new URL(datos.url);
        if (enlace.protocol !== 'https:') throw new Error('El enlace de audio no es válido.');

        const archivo = await fetch(enlace, { signal: controller.signal });
        if (!archivo.ok) throw new Error('No se pudo descargar el audio.');

        const tamaño = Number(archivo.headers.get('content-length') || 0);
        if (tamaño > MAX_BYTES) throw new Error('El audio supera el límite de 64 MB.');

        const buffer = Buffer.from(await archivo.arrayBuffer());
        if (!buffer.length || buffer.length > MAX_BYTES) {
            throw new Error('El audio está vacío o supera 64 MB.');
        }

        return {
            buffer,
            mimetype: datos.mimetype || 'audio/mpeg',
            fileName: datos.fileName || 'youtube.mp3'
        };
    } finally {
        clearTimeout(timer);
    }
}

async function bajarVideo(url, titulo) {
    const carpeta = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'friends-play-'));
    const plantilla = path.join(carpeta, 'video.%(ext)s');
    const salida = path.join(carpeta, 'video-final.mp4');

    try {
        await ejecutarYtDlp( [
            '--no-playlist', '--no-warnings',
            '-f', 'bestvideo[height<=480]+bestaudio/best[height<=480]/best',
            '-N', '8', '--concurrent-fragments', '8',
            '--merge-output-format', 'mp4', '-o', plantilla, url
        ], { timeout: 3600000, maxBuffer: 20 * 1024 * 1024 });

        const archivos = await fs.promises.readdir(carpeta);
        const original = archivos.find(nombre => /\.(mp4|mkv|webm|mov)$/i.test(nombre));
        if (!original) throw new Error('No se encontró el video descargado.');

        await ejecutar('ffmpeg', [
            '-y', '-i', path.join(carpeta, original),
            '-map', '0:v:0', '-map', '0:a?',
            '-vf', 'scale=-2:min(480\\,ih)',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27',
            '-c:a', 'aac', '-b:a', '96k',
            '-movflags', '+faststart', salida
        ], { timeout: 3600000, maxBuffer: 20 * 1024 * 1024 });

        const buffer = await fs.promises.readFile(salida);
        if (!buffer.length || buffer.length > MAX_BYTES) {
            throw new Error('El video supera el límite de 64 MB.');
        }

        return {
            buffer,
            fileName: nombreSeguro(titulo) + '.mp4'
        };
    } finally {
        await fs.promises.rm(carpeta, { recursive: true, force: true }).catch(() => {});
    }
}

async function reaccion(sock, chat, m, emoji) {
    try {
        await sock.sendMessage(chat, { react: { text: emoji, key: m.key } });
    } catch {}
}

async function procesarAudio(sock, chat, m, url, titulo, documento) {
    const audio = await bajarAudio(url);
    const nombre = nombreSeguro(titulo) + '.mp3';

    if (documento) {
        return sock.sendMessage(chat, {
            document: audio.buffer,
            fileName: nombre,
            mimetype: audio.mimetype,
            caption: '🎵 Audio listo'
        }, { quoted: m });
    }

    return sock.sendMessage(chat, {
        audio: audio.buffer,
        fileName: nombre,
        mimetype: audio.mimetype,
        ptt: false
    }, { quoted: m });
}

async function procesarVideo(sock, chat, m, url, titulo, documento) {
    const video = await bajarVideo(url, titulo);
    const caption = '🎬 ' + titulo + '\n\n' + MARCA;

    if (documento) {
        return sock.sendMessage(chat, {
            document: video.buffer,
            fileName: video.fileName,
            mimetype: 'video/mp4',
            caption
        }, { quoted: m });
    }

    return sock.sendMessage(chat, {
        video: video.buffer,
        fileName: video.fileName,
        mimetype: 'video/mp4',
        caption
    }, { quoted: m });
}

module.exports = {
    command: ['play', 'ytplay'],

    execute: async (m, { sock, from, args = [] }) => {
        if (args[0] === '__action') {
            const opcion = args[1];
            const url = decodificarUrl(args[2]);

            if (!url) {
                return sock.sendMessage(from, {
                    text: '⚠️ La opción venció. Vuelve a usar .play.'
                }, { quoted: m });
            }

            try {
                await reaccion(sock, from, m, '⏳');

                const { datos } = await obtenerVideo(url);
                const titulo = datos.title || 'YouTube';

                if (opcion === 'audio') {
                    await procesarAudio(sock, from, m, url, titulo, false);
                } else if (opcion === 'video') {
                    await procesarVideo(sock, from, m, url, titulo, false);
                } else if (opcion === 'audiodoc') {
                    await procesarAudio(sock, from, m, url, titulo, true);
                } else if (opcion === 'videodoc') {
                    await procesarVideo(sock, from, m, url, titulo, true);
                } else {
                    throw new Error('Opción no reconocida.');
                }

                await reaccion(sock, from, m, '✅');
            } catch (error) {
                console.error('Error al procesar botón de .play:', error.message);
                await reaccion(sock, from, m, '❌');
                await sock.sendMessage(from, {
                    text: '⚠️ No pude preparar esa opción. Prueba con otro video.'
                }, { quoted: m });
            }
            return;
        }

        const consulta = args.join(' ').trim();
        if (!consulta) {
            return sock.sendMessage(from, {
                text: '🎵 Usa .play seguido del nombre o enlace de una canción o video.'
            }, { quoted: m });
        }

        await reaccion(sock, from, m, '🔎');

        try {
            const { datos, url } = await obtenerVideo(consulta);
            const youtubeUrl = datos.id
                ? 'https://www.youtube.com/watch?v=' + datos.id
                : url;

            const titulo = datos.title || consulta;
            const canal = datos.uploader || datos.channel || 'Desconocido';
            const miniatura = datos.thumbnail || '';
            const ficha =
                '🎬 *' + titulo + '*\n' +
                '👤 Canal: ' + canal + '\n' +
                '⏱️ Duración: ' + duracion(datos.duration) + '\n' +
                '👁️ Vistas: ' + vistas(datos.view_count) + '\n\n' +
                'Elige el formato en el siguiente mensaje.';

            const { sendInteractiveMessage } = require('zqbaileys_helper');

            const token = codificarUrl(youtubeUrl);
            const botones = [
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: 'Audio',
                        id: '.play __action audio ' + token
                    })
                },
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: 'Video',
                        id: '.play __action video ' + token
                    })
                },
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: 'Audio Doc',
                        id: '.play __action audiodoc ' + token
                    })
                },
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: 'Video Doc',
                        id: '.play __action videodoc ' + token
                    })
                },
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: 'Ver en YouTube',
                        url: youtubeUrl
                    })
                }
            ];

            const header = { title: '🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸' };

            if (miniatura) {
                try {
                    const respuestaImagen = await fetch(miniatura);
                    const tipoImagen = (respuestaImagen.headers.get('content-type') || '').toLowerCase();

                    if (!respuestaImagen.ok || !tipoImagen.startsWith('image/')) {
                        throw new Error('La miniatura no se pudo descargar.');
                    }

                    const bufferImagen = Buffer.from(await respuestaImagen.arrayBuffer());
                    if (!bufferImagen.length || bufferImagen.length > 8 * 1024 * 1024) {
                        throw new Error('La miniatura está vacía o supera 8 MB.');
                    }

                    let baileys;
                    for (const paquete of ['baileys', '@whiskeysockets/baileys', '@adiwajshing/baileys']) {
                        try {
                            baileys = require(paquete);
                            if (baileys.generateWAMessageContent || baileys.Utils?.generateWAMessageContent) break;
                        } catch {}
                    }

                    const generarContenido =
                        baileys?.generateWAMessageContent ||
                        baileys?.Utils?.generateWAMessageContent;

                    if (!generarContenido || typeof sock.waUploadToServer !== 'function') {
                        throw new Error('No está disponible la preparación de imagen de Baileys.');
                    }

                    const media = await generarContenido(
                        { image: bufferImagen },
                        {
                            upload: sock.waUploadToServer.bind(sock),
                            logger: sock.logger,
                            userJid: sock.user?.id || sock.authState?.creds?.me?.id
                        }
                    );

                    const imageMessage = media?.imageMessage || media?.message?.imageMessage;
                    if (!imageMessage) throw new Error('Baileys no preparó la imagen.');

                    header.hasMediaAttachment = true;
                    header.imageMessage = imageMessage;
                } catch (error) {
                    console.error('No pude preparar la miniatura del mensaje .play:', error.message);
                }
            }

            await sendInteractiveMessage(sock, from, {
                interactiveMessage: {
                    header,
                    body: { text: ficha },
                    footer: { text: 'Dev. Ao Ork' },
                    nativeFlowMessage: { buttons: botones }
                }
            });

            await reaccion(sock, from, m, '✅');
        } catch (error) {
            console.error('Error en búsqueda de .play:', error.message);
            await reaccion(sock, from, m, '❌');
            await sock.sendMessage(from, {
                text: '⚠️ No pude encontrar ese video. Prueba con otro nombre o enlace.'
            }, { quoted: m });
        }
    }
};
