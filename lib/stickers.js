// lib/stickers.js

/**
 * Maneja respuestas automáticas a stickers guardados por hash.
 * @param {import('@whiskeysockets/baileys').WASocket} conn
 * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} m
 * @returns {Promise<boolean>}
 */
export async function manejarRespuestasStickers(conn, m) {
  try {
    const msgContent = m.message || {}
    
    // --- LÍNEA ACTUALIZADA CON MÁXIMA COMPATIBILIDAD ---
    const stickerMsg = msgContent.stickerMessage || 
                       msgContent.ephemeralMessage?.message?.stickerMessage ||
                       msgContent.viewOnceMessage?.message?.stickerMessage ||
                       msgContent.viewOnceMessageV2?.message?.stickerMessage

    if (!stickerMsg || !stickerMsg.fileSha256) {
      return false
    }

    const fileSha256Buffer = Buffer.from(stickerMsg.fileSha256);
    const hash = fileSha256Buffer.toString('base64');

    // Nos aseguramos de que la base de datos y la sección de stickers existan
    if (!global.db || !global.db.data || !global.db.data.sticker) {
      return false
    }

    const sticker = global.db.data.sticker

    if (sticker[hash]) {
      const { text, mentionedJid } = sticker[hash]

      // Aseguramos que mentionedJid sea un array de strings válidos
      const validMentions = Array.isArray(mentionedJid)
        ? mentionedJid.filter(jid => typeof jid === 'string' && jid.length > 0)
        : [];

      // Respondemos al mensaje con el texto y las menciones filtradas
      await conn.reply(m.chat, text, m, { mentions: validMentions });
      return true
    }

    return false
  } catch (err) {
    // Si hay algún error inesperado que impida el funcionamiento, lo logeamos.
    console.error('❌ Error en manejarRespuestasStickers:', err);
    return false;
  }
}
