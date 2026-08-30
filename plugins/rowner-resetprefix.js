const { settings } = require('../settings'); 

module.exports = {
    command: ['resetprefix', 'resetearprefijos'],
    rowner: true,
    execute: async ({ m }) => {
        // Restauramos el global al array predefinido
        global.prefix = ['.', '/', '#', '!']; 
        
        m.reply(`🎼 *¡El show vuelve a sus raíces! La sintonía ha regresado a los prefijos originales:* [ ${global.prefix.join(' ')} ]`);
    }
};
