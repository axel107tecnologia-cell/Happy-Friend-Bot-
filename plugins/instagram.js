const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const ejecutar = promisify(execFile);

const IG_REGEX =
    /(?:instagram\.com|instagr\.am)\/(?:reels?|p|tv|stories)\//i;

function formatearDuracion(segundos) {
    segundos = Number(segundos || 0);

    if (!segundos) {
        return 'No disponible';
    }

    const minutos = Math.floor(segundos / 60);
    const segundosFinales = Math.floor(segundos % 60)
        .toString()
        .padStart(2, '0');

    return minutos + ':' + segundosFinales;
}

function numero(valor) {
    return valor
        ? Number(valor).toLocaleString('es-MX')
        : 'No disponibles';
}

module.exports = {
    command: ['ig', 'instagram'],

    execute: async (m, { sock, from, args }) => {
        const enlace = args[0];

        if (!enlace || !IG_REGEX.test(enlace)) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '📸 Usa un enlace público de Instagram.\n\n' +
                        '.ig enlace_de_instagram'
                },
                { quoted: m }
            );
        }

        const carpeta = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), 'instagram-')
        );

        const plantilla = path.join(
            carpeta,
            'instagram.%(ext)s'
        );

        try {
            await sock.sendMessage(from, {
                react: {
                    text: '⌛',
                    key: m.key
                }
            });

            await ejecutar(
                'yt-dlp',
                [
                    '--no-playlist',
                    '--no-warnings',
                    '--write-info-json',
                    '--max-filesize',
                    '50M',
                    '-f',
                    'best[ext=mp4]/best',
                    '--merge-output-format',
                    'mp4',
                    '-o',
                    plantilla,
                    enlace
                ],
                {
                    timeout: 180000,
                    maxBuffer: 10 * 1024 * 1024
                }
            );

            const archivos = await fs.promises.readdir(
                carpeta
            );

            const nombreVideo = archivos.find(archivo =>
                /^instagram\.(mp4|mkv|webm|mov)$/i.test(
                    archivo
                )
            );

            if (!nombreVideo) {
                throw new Error(
                    'No se encontró un video público.'
                );
            }

            const rutaVideo = path.join(
                carpeta,
                nombreVideo
            );

            const archivoInfo = archivos.find(archivo =>
                archivo.endsWith('.info.json')
            );

            let datos = {};

            if (archivoInfo) {
                try {
                    datos = JSON.parse(
                        await fs.promises.readFile(
                            path.join(carpeta, archivoInfo),
                            'utf8'
                        )
                    );
                } catch {}
            }

            const titulo =
                datos.title ||
                datos.description ||
                'Video de Instagram';

            const autor =
                datos.uploader ||
                datos.channel ||
                datos.uploader_id ||
                'No disponible';

            const vistas = numero(datos.view_count);
            const likes = numero(datos.like_count);
            const duracion = formatearDuracion(
                datos.duration
            );

            const resolucion =
                datos.width && datos.height
                    ? `\({datos.width}x\){datos.height}`
                    : 'No disponible';

            const caption =
                '╭━━〔 📸 INSTAGRAM 〕━━╮\n' +
                '┃\n' +
                '┃ 🎬 Título: ' + titulo + '\n' +
                '┃ 👤 Autor: ' + autor + '\n' +
                '┃ ⏱️ Duración: ' + duracion + '\n' +
                '┃ 👁️ Vistas: ' + vistas + '\n' +
                '┃ 👍 Me gusta: ' + likes + '\n' +
                '┃ 📐 Resolución: ' + resolucion + '\n' +
                '┃\n' +
                '╰━━━━━━━━━━━━━━━━╯';

            await sock.sendMessage(
                from,
                {
                    video: fs.readFileSync(rutaVideo),
                    mimetype: 'video/mp4',
                    caption
                },
                { quoted: m }
            );

            await sock.sendMessage(from, {
                react: {
                    text: '✅',
                    key: m.key
                }
            });
        } catch (error) {
            console.error(
                '❌ Error en Instagram:',
                error.message
            );

            await sock.sendMessage(from, {
                react: {
                    text: '❌',
                    key: m.key
                }
            }).catch(() => {});

            await sock.sendMessage(
                from,
                {
                    text:
                        '⚠️ No pude descargar el video. ' +
                        'Debe ser público y no requerir inicio de sesión.'
                },
                { quoted: m }
            );
        } finally {
            await fs.promises.rm(carpeta, {
                recursive: true,
                force: true
            }).catch(() => {});
        }
    }
};
