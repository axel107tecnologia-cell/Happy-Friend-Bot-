const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const run = promisify(execFile);
const {
    generateWAMessageContent,
    generateWAMessageFromContent,
    proto
} = require('@whiskeysockets/baileys');

const PIN_URL = /https?:\/\/(?:www\.)?(?:pin\.it|pinterest\.[^/]+)\//i;

const ENDPOINT =
    'https://id.pinterest.com/resource/BaseSearchResource/get/';

async function buscarPinterest(texto) {
    const apiKey = process.env.SERPAPI_KEY;

    if (!apiKey) {
        throw new Error(
            'Falta configurar SERPAPI_KEY en Termux.'
        );
    }

    const url =
        'https://serpapi.com/search?engine=google_images' +
        '&q=' + encodeURIComponent(texto) +
        '&num=10' +
        '&safe=active' +
        '&api_key=' + encodeURIComponent(apiKey);

    const respuesta = await fetch(url);

    if (!respuesta.ok) {
        throw new Error(
            'SerpApi respondió HTTP ' + respuesta.status
        );
    }

    const json = await respuesta.json();

    const resultados = (json.images_results || [])
        .filter(item =>
            item.original ||
            item.thumbnail
        )
        .slice(0, 10)
        .map(item => ({
            titulo: item.title || 'Imagen',
            descripcion: item.source || 'Google Imágenes',
            imagen: item.original || item.thumbnail
        }));

    if (!resultados.length) {
        throw new Error(
            'SerpApi no encontró imágenes.'
        );
    }

    return resultados;
}

module.exports = {
    command: ['pin', 'pinterest'],

    execute: async (m, { sock, from, args }) => {
        const busqueda = args.join(' ').trim();

        if (PIN_URL.test(busqueda)) {
            let archivo;

            try {
                await sock.sendMessage(from, {
                    react: {
                        text: '⌛',
                        key: m.key
                    }
                });

                archivo = await descargarPin(busqueda);
                const extension = path.extname(archivo)
                    .toLowerCase();

                const contenido = fs.readFileSync(archivo);

                if (['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
                    await sock.sendMessage(
                        from,
                        {
                            image: contenido,
                            caption: '📌 Pinterest'
                        },
                        { quoted: m }
                    );
                } else {
                    await sock.sendMessage(
                        from,
                        {
                            video: contenido,
                            mimetype: 'video/mp4',
                            caption: '📌 Pinterest'
                        },
                        { quoted: m }
                    );
                }

                await sock.sendMessage(from, {
                    react: {
                        text: '✅',
                        key: m.key
                    }
                });
            } catch (error) {
                console.error(
                    'Error en enlace Pinterest:',
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
                            '⚠️ No pude descargar ese Pin. ' +
                            'Prueba con un enlace público.'
                    },
                    { quoted: m }
                );
            } finally {
                if (archivo) {
                    fs.unlink(
                        archivo,
                        () => {}
                    );
                }
            }

            return;
        }

        if (!busqueda) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '📌 Escribe lo que quieres buscar.\n\n' +
                        '.pin fondos azules'
                },
                { quoted: m }
            );
        }

        try {
            await sock.sendMessage(from, {
                react: {
                    text: '⌛',
                    key: m.key
                }
            });

            const resultados = await buscarPinterest(busqueda);
            const seleccion = resultados.slice(0, 10);
            const tarjetas = [];

            for (const resultado of seleccion) {
                const respuestaImagen = await fetch(
                    resultado.imagen
                );

                if (!respuestaImagen.ok) {
                    continue;
                }

                const imagenBuffer = Buffer.from(
                    await respuestaImagen.arrayBuffer()
                );

                const imagenMessage =
                    await generateWAMessageContent(
                        {
                            image: imagenBuffer
                        },
                        {
                            upload: sock.waUploadToServer
                        }
                    );

                tarjetas.push({
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: resultado.titulo || 'Imagen encontrada'
                    }),

                    footer: proto.Message.InteractiveMessage.Footer.fromObject({
                        text: 'Friends Happy Bot'
                    }),

                    header: proto.Message.InteractiveMessage.Header.fromObject({
                        hasMediaAttachment: true,
                        imageMessage: imagenMessage.imageMessage
                    }),

                    nativeFlowMessage:
                        proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: []
                        })
                });
            }

            if (!tarjetas.length) {
                throw new Error(
                    'No se encontraron imágenes disponibles'
                );
            }

            const carrusel = generateWAMessageFromContent(
                from,
                {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage:
                                proto.Message.InteractiveMessage.fromObject({
                                    body:
                                        proto.Message.InteractiveMessage.Body.fromObject({
                                            text:
                                                '╭━━〔 📌 PINTEREST 〕━━╮\n' +
                                                '┃\n' +
                                                '┃ 🔎 Búsqueda: ' + busqueda + '\n' +
                                                '┃ 🖼️ Resultados: ' + seleccion.length + '\n' +
                                                '┃\n' +
                                                '╰━━━━━━━━━━━━━━━━╯'
                                        }),

                                    footer:
                                        proto.Message.InteractiveMessage.Footer.fromObject({
                                            text: 'Friends Happy Bot'
                                        }),

                                    carouselMessage:
                                        proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                                            cards: tarjetas
                                        })
                                })
                        }
                    }
                },
                {
                    quoted: m
                }
            );

            await sock.relayMessage(
                from,
                carrusel.message,
                {
                    messageId: carrusel.key.id
                }
            );

            await sock.sendMessage(from, {
                react: {
                    text: '✅',
                    key: m.key
                }
            });
        } catch (error) {
            console.error(
                'Error en búsqueda Pinterest:',
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
                        '⚠️ No pude buscar en Pinterest.\n\n' +
                        error.message
                },
                { quoted: m }
            );
        }
    }
};
