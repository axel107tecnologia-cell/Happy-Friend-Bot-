const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const ejecutar = promisify(execFile);

function duracion(segundos) {
    if (!segundos) return 'Desconocida';

    segundos = Number(segundos);

    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segundosRestantes = segundos % 60;

    if (horas > 0) {
        return horas + 'h ' + minutos + 'm ' + segundosRestantes + 's';
    }

    return minutos + 'm ' + segundosRestantes + 's';
}

function numero(valor) {
    if (!valor) return 'Desconocidas';
    return Number(valor).toLocaleString('es-MX');
}

async function obtenerVideo(consulta) {
    const esEnlace = /^https?:\/\//i.test(consulta);

    if (esEnlace) {
        const resultado = await ejecutar(
            'yt-dlp',
            [
                '--no-warnings',
                '--ignore-errors',
                '--dump-single-json',
                '--skip-download',
                consulta
            ],
            { timeout: 120000 }
        );

        return {
            datos: JSON.parse(resultado.stdout),
            entrada: consulta
        };
    }

    const busqueda = await ejecutar(
        'yt-dlp',
        [
            '--no-warnings',
            '--ignore-errors',
            '--flat-playlist',
            '--dump-single-json',
            '--skip-download',
            `ytsearch5:${consulta}`
        ],
        { timeout: 120000 }
    );

    const resultados = JSON.parse(busqueda.stdout);
    const candidatos = resultados.entries || [];

    for (const candidato of candidatos) {
        const entrada =
            candidato.webpage_url ||
            candidato.original_url ||
            candidato.url;

        if (!entrada) continue;

        try {
            const resultado = await ejecutar(
                'yt-dlp',
                [
                    '--no-warnings',
                    '--ignore-errors',
                    '--dump-single-json',
                    '--skip-download',
                    entrada
                ],
                { timeout: 120000 }
            );

            const datos = JSON.parse(resultado.stdout);

            if (datos && datos.title && !datos.is_live) {
                return { datos, entrada };
            }
        } catch {
            continue;
        }
    }

    throw new Error('No se encontró un video disponible');
}

module.exports = {
    command: ['play2'],

    execute: async (m, { sock, from, args }) => {
        const consulta = args.join(' ').trim();

        if (!consulta) {
            return sock.sendMessage(
                from,
                {
                    text: '🎬 Usa .play2 seguido del nombre del video.'
                },
                { quoted: m }
            );
        }

        const carpeta = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), 'play2-')
        );

        const plantilla = path.join(
            carpeta,
            'video.%(ext)s'
        );

        try {
            const { datos, entrada } =
                await obtenerVideo(consulta);

            await sock.sendMessage(
                from,
                {
                    react: {
                        text: '⌛',
                        key: m.key
                    }
                }
            );

            await sock.sendMessage(
                from,
                {
                    text: '⌛ Buscando, descargando y preparando el video...'
                },
                { quoted: m }
            );

            await ejecutar(
                'yt-dlp',
                [
                    '--no-playlist',
                    '--no-warnings',
                    '--ignore-errors',
                    '--max-filesize',
                    '50M',
                    '-f',
                    'bestvideo[height<=720]+bestaudio/best[height<=720]',
                    '-N',
                    '8',
                    '--concurrent-fragments',
                    '8',
                    '--merge-output-format',
                    'mp4',
                    '-o',
                    plantilla,
                    entrada
                ],
                { timeout: 180000 }
            );

            const archivos = await fs.promises.readdir(carpeta);

            const nombreVideo = archivos.find(archivo =>
                /\.(mp4|mkv|webm|mov)$/i.test(archivo)
            );

            if (!nombreVideo) {
                throw new Error('No se encontró el video descargado');
            }

            const rutaVideo = path.join(carpeta, nombreVideo);

            const titulo = datos.title || consulta;
            const canal =
                datos.uploader ||
                datos.channel ||
                'Desconocido';

            const fecha = datos.upload_date
                ? datos.upload_date.slice(6, 8) + '/' +
                  datos.upload_date.slice(4, 6) + '/' +
                  datos.upload_date.slice(0, 4)
                : 'Desconocida';

            const salto = String.fromCharCode(10);

            const caption =
                '🎬 VIDEO DESCARGADO' + salto + salto +
                '📌 Título: ' + titulo + salto +
                '👤 Canal: ' + canal + salto +
                '⏱️ Duración: ' + duracion(datos.duration) + salto +
                '👁️ Vistas: ' + numero(datos.view_count) + salto +
                '📅 Fecha: ' + fecha + salto + salto +
                '💎 Descargado con .play2';

            await sock.sendMessage(
                from,
                {
                    react: {
                        text: '✅',
                        key: m.key
                    }
                }
            );

            await sock.sendMessage(
                from,
                {
                    video: fs.readFileSync(rutaVideo),
                    mimetype: 'video/mp4',
                    caption
                },
                { quoted: m }
            );
        } catch (error) {
            console.error('Error en play2:', error.message);

            await sock.sendMessage(
                from,
                {
                    text: '⚠️ No encontré un video disponible para esa búsqueda.'
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
