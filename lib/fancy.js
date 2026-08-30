const smallCaps = {
    A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ',
    F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ', J: 'ᴊ',
    K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ',
    P: 'ᴘ', Q: 'ǫ', R: 'ʀ', S: 's', T: 'ᴛ',
    U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ',
    Z: 'ᴢ'
};

function fancyText(value) {
    const original = String(value);

    if (
        /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(
            original.trim()
        )
    ) {
        return original;
    }

    return original
        .split(/(https?:\/\/\S+)/g)
        .map((parte, indice) => {
            if (indice % 2 === 1) {
                return parte;
            }

            return [...parte].map(char =>
                smallCaps[char.toUpperCase()] || char
            ).join('');
        })
        .join('');
}

module.exports = {
    fancyText
};
