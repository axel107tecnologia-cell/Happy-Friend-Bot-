const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = {
    command: ['ia', 'gemini'],

    execute: async (m, { sock, from, args }) => {
        const pregunta = args.join(' ').trim();

        if (!pregunta) {
            return sock.sendMessage(
                from,
                { text: 'Ejemplo: .ia ¿Qué puedes hacer?' },
                { quoted: m }
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return sock.sendMessage(
                from,
                { text: '⚠️ Falta configurar la clave de Gemini en Termux.' },
                { quoted: m }
            );
        }

        try {
            const google = new GoogleGenerativeAI(
                process.env.GEMINI_API_KEY
            );

            const modelo = google.getGenerativeModel({
                model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
            });

            const resultado = await modelo.generateContent(
                `Responde en español, de forma clara y breve:\n\n${pregunta}`
            );

            const respuesta = resultado.response.text();

            await sock.sendMessage(
                from,
                { text: `🧠 *Gemini:*\n\n${respuesta}` },
                { quoted: m }
            );
        } catch (error) {
            console.error('Error en Gemini:', error.message);

            await sock.sendMessage(
                from,
                { text: `⚠️ Gemini no pudo responder: ${error.message}` },
                { quoted: m }
            );
        }
    }
};
