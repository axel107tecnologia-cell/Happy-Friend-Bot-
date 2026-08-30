module.exports = {
    command: ['owner'],

    execute: async (m, { sock, from }) => {
        await sock.sendMessage(
            from,
            {
                text: '𝐃𝐞𝐯 𝐀𝐱𝐞𝐥 𝐀𝐥𝐛𝐞𝐫𝐭𝐨\n𝟐𝟐/𝟎𝟖/𝟐𝟎𝟐𝟔'
            },
            { quoted: m }
        );
    }
};
