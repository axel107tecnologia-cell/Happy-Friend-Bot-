'use strict';

const {
    generateWAMessageContent,
    generateWAMessageFromContent,
    proto
} = require('@whiskeysockets/baileys');

const API_PINTEREST = 'https://ellen-api-three.vercel.app/api/pinterest';

function extraerEnlacePinterest(texto) {
    const coincidencia = String(texto || '').match(/https?:\/\/[^\s]+/i);
    if (!coincidencia) return null;

    const candidata = coincidencia[0].replace(/[),.;!?]+$/g, '');

    try {
        const url = new URL(candidata);
        const host = url.hostname.toLowerCase();

        const valido =
            host === 'pin.it' ||
            host.endsWith('.pin.it') ||
            host === 'pinterest.com' ||
            host.endsWith('.pinterest.com') ||
            /^pinterest\.[a-z.]+$/.test(host);

        return valido ? url.toString() : null;
    } catch {
        return null;
    }
}

async function pedirJson(endpoint, contenido) {
    const respuesta = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contenido)
    });

    const texto = await respuesta.text();
    let datos;

    try {
        datos = JSON.parse(texto);
    } catch {
        throw new Error('Respuesta de búsqueda inválida.');
    }

    if (!respuesta.ok || datos.success === false) {
        throw new Error('La búsqueda no está disponible.');
    }

    return datos;
}

async function descargarImagen(url) {
    const respuesta = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!respuesta.ok) {
        throw new Error('No se pudo cargar una imagen.');
    }

    const tipo = String(respuesta.headers.get('content-type') || '')
        .toLowerCase();

    if (!tipo.startsWith('image/')) {
        throw new Error('El enlace no contiene una imagen.');
    }

    const longitud = Number(respuesta.headers.get('content-length') || 0);
    if (longitud > 15 * 1024 * 1024) {
        throw new Error('La imagen supera el tamaño permitido.');
    }

    const buffer = Buffer.from(await respuesta.arrayBuffer());

    if (!buffer.length) {
        throw new Error('La imagen está vacía.');
    }

    return buffer;
}

function obtenerAtributo(tag, nombre) {
    const expresion = new RegExp(
        "\\b" + nombre + "\\s*=\\s*(['\"])(.*?)\\1",
        'i'
    );
    const coincidencia = tag.match(expresion);

    return coincidencia
        ? coincidencia[2]
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
        : '';
}
async function extraerImagenDelPin(enlace) {
    const respuesta = await fetch(enlace, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!respuesta.ok) {
        throw new Error('No se pudo abrir ese pin.');
    }

    const html = await respuesta.text();
    const etiquetas = html.match(/<meta\b[^>]*>/gi) || [];

    let imagenUrl = '';
    let titulo = 'Pinterest';

    for (const etiqueta of etiquetas) {
        const propiedad =
            obtenerAtributo(etiqueta, 'property') ||
            obtenerAtributo(etiqueta, 'name');

        const contenido = obtenerAtributo(etiqueta, 'content');

        if (propiedad.toLowerCase() === 'og:image' && contenido) {
            imagenUrl = contenido;
        }

        if (propiedad.toLowerCase() === 'og:title' && contenido) {
            titulo = contenido;
        }
    }

    if (!imagenUrl) {
        throw new Error('Ese pin no tiene una imagen pública disponible.');
    }

    const imagenCompleta = new URL(imagenUrl, respuesta.url).toString();

    return {
        imagen: await descargarImagen(imagenCompleta),
        titulo
    };
}

module.exports = {
    command: ['pin', 'pinterest'],

    execute: async (m, { sock, from, args }) => {
        const busqueda = args.join(' ').trim();

        if (!busqueda) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '📌 Escribe qué imagen quieres buscar.\n\n' +
                        '.pin fondos azules'
                },
                { quoted: m }
            );
        }

        try {
            await sock.sendMessage(from, {
                react: { text: '⌛', key: m.key }
            });

            const enlace = extraerEnlacePinterest(busqueda);

            if (enlace) {
                const pin = await extraerImagenDelPin(enlace);

                await sock.sendMessage(
                    from,
                    {
                        image: pin.imagen,
                        caption: '📌 ' + pin.titulo
                    },
                    { quoted: m }
                );
            } else {
                const resultado = await pedirJson(API_PINTEREST, {
                    query: busqueda
                });

                const seleccion = Array.isArray(resultado.items)
                    ? resultado.items.slice(0, 10)
                    : [];

                const tarjetas = [];

                for (const item of seleccion) {
                    const imagenUrl = item.image || item.image_small;
                    if (!imagenUrl) continue;

                    try {
                        const imagenBuffer = await descargarImagen(imagenUrl);
                        const imagenMensaje = await generateWAMessageContent(
                            { image: imagenBuffer },
                            { upload: sock.waUploadToServer }
                        );

                        tarjetas.push({
                            body: proto.Message.InteractiveMessage.Body.fromObject({
                                text: String(item.title || item.desc || 'Imagen de Pinterest')
                                    .slice(0, 180)
                            }),

                            footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                text: '🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸'
                            }),

                            header: proto.Message.InteractiveMessage.Header.fromObject({
                                hasMediaAttachment: true,
                                imageMessage: imagenMensaje.imageMessage
                            }),

                            nativeFlowMessage:
                                proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                    buttons: []
                                })
                        });
                    } catch (errorImagen) {
                        console.error(
                            'No se pudo cargar una imagen de Pinterest:',
                            errorImagen.message
                        );
                    }
                }

                if (!tarjetas.length) {
                    throw new Error('No se encontraron imágenes disponibles.');
                }

                const textoCarrusel =
                    '╭━━〔 📌 PINTEREST 〕━━╮\n' +
                    '┃\n' +
                    '┃ 🔎 Búsqueda: ' + busqueda + '\n' +
                    '┃ 🖼️ Resultados: ' + tarjetas.length + '\n' +
                    '┃\n' +
                    '╰━━━━━━━━━━━━━━━━╯';

                const carrusel = generateWAMessageFromContent(
                    from,
                    {
                        viewOnceMessage: {
                            message: {
                                interactiveMessage:
                                    proto.Message.InteractiveMessage.fromObject({
                                        body:
                                            proto.Message.InteractiveMessage.Body.fromObject({
                                                text: textoCarrusel
                                            }),

                                        footer:
                                            proto.Message.InteractiveMessage.Footer.fromObject({
                                                text: '🌸 𝐁𝐨𝐭 𝐌𝐚𝐭𝐢𝐤𝐚𝐧𝐞𝐭𝐚𝐧𝐧𝐡𝐚𝐮𝐬𝐞𝐫 🌸'
                                            }),

                                        carouselMessage:
                                            proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                                                cards: tarjetas
                                            })
                                    })
                            }
                        }
                    },
                    { quoted: m }
                );

                await sock.relayMessage(
                    from,
                    carrusel.message,
                    { messageId: carrusel.key.id }
                );
            }

            await sock.sendMessage(from, {
                react: { text: '✅', key: m.key }
            });
        } catch (error) {
            console.error('Error en búsqueda Pinterest:', error.message);

            await sock.sendMessage(from, {
                react: { text: '❌', key: m.key }
            }).catch(() => {});

            await sock.sendMessage(
                from,
                {
                    text: '⚠️ No pude obtener imágenes. Prueba con otra búsqueda o un pin público.'
                },
                { quoted: m }
            );
        }
    }
};
