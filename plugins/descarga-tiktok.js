const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const run = promisify(execFile);

function numero(valor) {
    return valor !== undefined && valor !== null
        ? Number(valor).toLocaleString('es-MX')
        : 'No disponible';
}

function duracion(valor) {
    const segundos = Number(valor || 0);

    if (!segundos) {
        return 'No disponible';
    }

    const minutos = Math.floor(segundos / 60);
    const segundosFinales = String(
        Math.floor(segundos % 60)
    ).padStart(2, '0');

    return `\({minutos}:\){segundosFinales}`;
}

function resolucion(datos) {
    if (datos.width && datos.height) {
        return `\({datos.width}x\){datos.height}`;
    }

    return 'No disponible';
}

module.exports = {
    command: ['tt', 'tiktok', 'tiktokdl'],

    execute: async (m, { sock, from, args }) => {
        const url = args[0];

        if (!url || !url.includes('tiktok')) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '🎵 Envía un enlace válido de TikTok.\n\n' +
                        '.tiktok enlace_de_tiktok'
                },
                { quoted: m }
            );
        }

        const tmpDir = path.join(
            process.cwd(),
            'tmp'
        );

        fs.mkdirSync(tmpDir, { recursive: true });

        const base = `tiktok-${Date.now()}`;
        const output = path.join(
            tmpDir,
            `${base}.%(ext)s`
        );

        try {
            await sock.sendMessage(from, {
                react: {
                    text: '⌛',
                    key: m.key
                }
            });

            const { stdout } = await run(
                'yt-dlp',
                [
                    '--no-playlist',
                    '--no-warnings',
                    '--impersonate',
                    'chrome',
                    '--js-runtimes',
                    'node',
                    '--write-info-json',
                    '--max-filesize',
                    '50M',
                    '--print',
                    'after_move:filepath',
                    '-f',
                    'best[ext=mp4]/best',
                    '--merge-output-format',
                    'mp4',
                    '-o',
                    output,
                    url
                ],
                {
                    maxBuffer: 10 * 1024 * 1024,
                    timeout: 180000
                }
            );

            const filePath = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .find(file =>
                    fs.existsSync(file) &&
                    !file.endsWith('.json')
                );

            if (!filePath) {
                throw new Error(
                    'No se pudo localizar el video descargado.'
                );
            }

            const infoPath = `${filePath}.info.json`;
            let datos = {};

            if (fs.existsSync(infoPath)) {
                try {
                    datos = JSON.parse(
                        fs.readFileSync(infoPath, 'utf8')
                    );
                } catch {}
            }

            const titulo =
                datos.title ||
                datos.description ||
                'Video de TikTok';

            const autor =
                datos.uploader ||
                datos.channel ||
                datos.uploader_id ||
                'No disponible';

            const fecha = datos.upload_date
                ? `${datos.upload_date.slice(6, 8)}/` +
                  `${datos.upload_date.slice(4, 6)}/` +
                  `${datos.upload_date.slice(0, 4)}`
                : 'No disponible';

            const caption =
                '╭━━〔 🎵 TIKTOK 〕━━╮\n' +
                '┃\n' +
                '┃ 🎬 Título: ' + titulo + '\n' +
                '┃ 👤 Autor: ' + autor + '\n' +
                '┃ ⏱️ Duración: ' + duracion(datos.duration) + '\n' +
                '┃ 👁️ Vistas: ' + numero(datos.view_count) + '\n' +
                '┃ 👍 Me gusta: ' + numero(datos.like_count) + '\n' +
                '┃ 📅 Fecha: ' + fecha + '\n' +
                '┃ 📐 Resolución: ' + resolucion(datos) + '\n' +
                '┃\n' +
                '╰━━━━━━━━━━━━━━━━╯';

            await sock.sendMessage(
                from,
                {
                    video: fs.readFileSync(filePath),
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

            fs.unlinkSync(filePath);
            if (fs.existsSync(infoPath)) {
                fs.unlinkSync(infoPath);
            }
        } catch (error) {
            console.error(
                'Error en TikTok:',
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
                        'Verifica que el enlace sea público.'
                },
                { quoted: m }
            );
        }
    }
};
