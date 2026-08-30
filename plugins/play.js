const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const run = promisify(execFile);

module.exports = {
    command: ['play', 'ytplay', 'video', 'ytvideo'],

    execute: async (m, { sock, from, args, command }) => {
        const query = args.join(' ').trim();
        const isVideo = ['video', 'ytvideo'].includes(command);

        if (!query) {
            return sock.sendMessage(
                from,
                { text: `Escribe el nombre de la ${isVideo ? 'canción o video' : 'canción'}.` },
                { quoted: m }
            );
        }

        const tmpDir = path.join(process.cwd(), 'tmp');
        fs.mkdirSync(tmpDir, { recursive: true });

        const output = path.join(
            tmpDir,
            `alastor-${Date.now()}.%(ext)s`
        );

        try {
            await sock.sendMessage(from, {
                react: { text: '⌛', key: m.key }
            });

            const argsYt = [
                '--no-playlist',
                '--no-warnings',
                '--js-runtimes', 'node',
                '--print', 'after_move:filepath',
                '-o', output
            ];

            if (isVideo) {
                argsYt.push(
                    '-f',
                    'bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best',
                    '--merge-output-format',
                    'mp4'
                );
            } else {
                argsYt.push(
                    '-f',
                    'bestaudio[ext=m4a]/bestaudio/best',
                    '-x',
                    '--audio-format',
                    'mp3',
                    '--audio-quality',
                    '96K',
                    '--postprocessor-args',
                    'ExtractAudio:-ac 2 -ar 44100 -b:a 96k'
                );
            }

            argsYt.push(`ytsearch1:${query}`);

            const { stdout } = await run('yt-dlp', argsYt, {
                maxBuffer: 10 * 1024 * 1024
            });

            const filePath = stdout
                .split('\n')
                .map(x => x.trim())
                .filter(Boolean)
                .pop();

            if (!filePath || !fs.existsSync(filePath)) {
                throw new Error('No se pudo crear el archivo multimedia.');
            }

            const buffer = fs.readFileSync(filePath);

            if (isVideo) {
                await sock.sendMessage(
                    from,
                    {
                        video: buffer,
                        mimetype: 'video/mp4',
                        caption: `🎬 ${query}`
                    },
                    { quoted: m }
                );
            } else {
                await sock.sendMessage(
                    from,
                    {
                        audio: buffer,
                        mimetype: 'audio/mpeg',
                        ptt: false
                    },
                    { quoted: m }
                );
            }

            await sock.sendMessage(from, {
                react: { text: '✅', key: m.key }
            });

            fs.unlinkSync(filePath);
        } catch (error) {
            console.error('Error en play:', error.message);

            await sock.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });

            await sock.sendMessage(
                from,
                { text: `⚠️ No pude descargarlo: ${error.message}` },
                { quoted: m }
            );
        }
    }
};
