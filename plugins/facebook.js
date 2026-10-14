const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const ejecutar = promisify(execFile);

module.exports = {
    command: ['fb', 'facebook'],

    execute: async (m, { sock, from, args }) => {
        const enlace = args[0];

        if (
            !enlace ||
            !/^https?:\/\//i.test(enlace) ||
            !/(facebook\.com|fb\.watch)/i.test(enlace)
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '📘 Usa el comando con un enlace público de Facebook.\n\n' +
                        '.fb enlace'
                },
                { quoted: m }
            );
        }

        const carpeta = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), 'facebook-')
        );

        const plantilla = path.join(carpeta, 'video.%(ext)s');
        const videoLigero = path.join(carpeta, 'video-ligero.mp4');

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
                    '-N',
                    '8',
                    '--concurrent-fragments',
                    '8',
                    '-f',
                    'bestvideo[height<=720]+bestaudio/best[height<=720]/best[ext=mp4]/best',
                    '--merge-output-format',
                    'mp4',
                    '-o',
                    plantilla,
                    enlace
                ],
                { timeout: 180000 }
            );

            const archivos = await fs.promises.readdir(carpeta);

            const nombreVideo = archivos.find(archivo =>
                /^video\.(mp4|mkv|webm|mov)$/i.test(archivo)
            );

            if (!nombreVideo) {
                throw new Error('No se encontró el video descargado');
            }

            const rutaVideo = path.join(carpeta, nombreVideo);
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

              const numero = valor =>
                  valor
                      ? Number(valor).toLocaleString('es-MX')
                      : 'No disponibles';

              const segundos = Number(datos.duration || 0);

              const duracion = segundos
                  ? Math.floor(segundos / 60) + ':' +
                    String(Math.floor(segundos % 60)).padStart(2, '0')
                  : 'No disponible';

              const titulo =
                  datos.title || 'Video de Facebook';

              const autor =
                  datos.uploader ||
                  datos.uploader_id ||
                  'No disponible';

              const canal =
                  datos.channel ||
                  datos.uploader ||
                  'No disponible';

              const vistas = numero(datos.view_count);
              const likes = numero(datos.like_count);

              const resolucion =
                  datos.width && datos.height
                      ? datos.width + 'x' + datos.height
                      : 'No disponible';

              let fecha = 'No disponible';

              if (datos.upload_date && datos.upload_date.length === 8) {
                  fecha =
                      datos.upload_date.slice(6, 8) + '/' +
                      datos.upload_date.slice(4, 6) + '/' +
                      datos.upload_date.slice(0, 4);
              }

              const caracteristicas =
                  '╭━━〔 📘 FACEBOOK 〕━━╮\n' +
                  '┃\n' +
                  '┃ 🎬 Título: ' + titulo + '\n' +
                  '┃ 👤 Autor: ' + autor + '\n' +
                  '┃ 📺 Canal/Página: ' + canal + '\n' +
                  '┃ ⏱️ Duración: ' + duracion + '\n' +
                  '┃ 👁️ Vistas: ' + vistas + '\n' +
                  '┃ 👍 Me gusta: ' + likes + '\n' +
                  '┃ 📅 Fecha: ' + fecha + '\n' +
                  '┃ 🎥 Resolución: ' + resolucion + '\n' +
                  '┃\n' +
                  '╰━━━━━━━━━━━━━━━━╯';


            await sock.sendMessage(from, {
                react: {
                    text: '✅',
                    key: m.key
                }
            });

            await sock.sendMessage(
                from,
                {
                    video: fs.readFileSync(rutaVideo),
                    mimetype: 'video/mp4',
                    caption: caracteristicas
                },
                { quoted: m }
            );
        } catch (error) {
            console.error('❌ Error en Facebook:', error.message);

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
                        '⚠️ No pude descargar el video. Comprueba que sea público ' +
                        'y que el enlace siga disponible.'
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
