const { db } = require('../src/database/db');
const fs = require('fs');
const path = require('path');

module.exports = {
    command: ['serbot', 'code'],

    execute: async (
        m,
        { sock, args = [], senderNum, senderJid, from, connectBot }
    ) => {
        const numeroIngresado = String(args.join('') || '')
            .replace(/[^0-9]/g, '');
        const numeroRemitente = String(senderNum || senderJid || '')
            .replace(/[^0-9]/g, '');

        const numero = numeroIngresado || numeroRemitente;

        const responder = texto =>
            sock.sendMessage(from, { text: texto }, { quoted: m });

        if (!numero || numero.length < 10 || numero.length > 15) {
            return responder(
                '⚠️ No pude identificar un número válido.\n\n' +
                'Usa el comando con tu número completo:\n' +
                '.code número_con_código_de_país'
            );
        }

        try {
            const socketActivo =
                global.subbotSockets?.get(String(numero));

            if (socketActivo) {
                return responder(
                    `🔥 El sub-bot ${numero} todavía está conectado.`
                );
            }

            db.prepare(
                'DELETE FROM subbots WHERE jid = ?'
            ).run(numero);

            const carpetaSesion = path.join(
                global.alastorsubs,
                numero
            );

            await fs.promises.rm(carpetaSesion, {
                recursive: true,
                force: true
            });

            await responder(
                `⌛ Preparando el código de vinculación para ${numero}...`
            );

            await connectBot({
                basePath: global.alastorsubs,
                jid: numero,
                isSub: true,
                pairingNumber: numero,

                onCode: async code => {
                    const codigoLimpio = String(code || '')
                        .replace(/[^A-Z0-9]/gi, '')
                        .toUpperCase();

                    const codigoFormateado =
                        codigoLimpio.length === 8
                            ? codigoLimpio.slice(0, 4) +
                              '-' +
                              codigoLimpio.slice(4)
                            : codigoLimpio;

                    const textoCodigo =
                        '📱 Abre WhatsApp en el número que quieres vincular.\n\n' +
                        '1️⃣ Entra a Ajustes.\n' +
                        '2️⃣ Abre Dispositivos vinculados.\n' +
                        '3️⃣ Pulsa Vincular un dispositivo.\n' +
                        '4️⃣ Elige Vincular con número de teléfono.\n\n' +
                        '⌛ Introduce este código antes de que expire:\n\n' +
                        `*${codigoFormateado}*`;

                    try {
                        const { sendInteractiveMessage } =
                            require('zqbaileys_helper');

                        if (typeof sendInteractiveMessage !== 'function') {
                            throw new Error('El helper no exporta sendInteractiveMessage');
                        }

                        await sendInteractiveMessage(sock, from, {
                            text: textoCodigo,
                            interactiveButtons: [{
                                name: 'cta_copy',
                                buttonParamsJson: JSON.stringify({
                                    display_text: 'Copiar código',
                                    copy_code: codigoFormateado
                                })
                            }]
                        });
                    } catch (error) {
                        console.error(
                            'No pude enviar el botón Copiar código:',
                            error.message
                        );

                        await sock.sendMessage(
                            from,
                            { text: textoCodigo },
                            { quoted: m }
                        );
                    }
                },

                onConnected: async () => {
                    db.prepare(
                        'INSERT OR REPLACE INTO subbots (jid, status) VALUES (?, ?)'
                    ).run(numero, 'online');

                    await responder(
                        `✅ Sub-bot ${numero} vinculado correctamente.`
                    );
                }
            });
        } catch (error) {
            console.error('❌ Error en .code:', error);

            await responder(
                '⚠️ No pude generar el código de vinculación. ' +
                'Comprueba el número e inténtalo de nuevo.'
            );
        }
    }
};
