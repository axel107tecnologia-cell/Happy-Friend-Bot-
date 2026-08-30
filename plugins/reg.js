const fs = require('fs');

module.exports = {
    command: ['reg', 'registrar', 'contrato'],
    execute: async (m, { conn, from, args }) => {
        // Cargar o crear base de datos
        let db = {};
        if (fs.existsSync('./database.json')) {
            db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
        }

        const userId = m.sender;

        if (db[userId]) return conn.sendMessage(from, { text: "⚠️ ¡Ya has firmado tu contrato con el Hotel, pecador!" }, { quoted: m });
        if (args.length < 2) return conn.sendMessage(from, { text: "⚠️ Uso: .reg [nombre] [edad]\n\n*Ejemplo: .reg Friends Happy Bot 100*" }, { quoted: m });

        // Inicialización del perfil estilo Hazbin
        db[userId] = {
            nombre: args[0],
            edad: args[1],
            registrado: true,
            recursos: {
                monedas: 100,      // Monedas infernales
                gemas: 10,        // Gemas del inframundo
                almas: 1,         // Tu propia alma
                contratos: 0      // Contratos firmados con otros
            },
            inventario: {
                waifus: [],
                pokemons: [],
                objetos: ["Radio Antigua"] // Objeto inicial por defecto
            },
            meta: { 
                packname: "Hazbin Bot", 
                author: "Friends Happy Bot" 
            }
        };

        fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
        
        await conn.sendMessage(from, { 
            text: `🎭 *¡Bienvenido al Hazbin Hotel!* 🎭\n\nTu contrato ha sido sellado, ${args[0]}.\n\nTu alma ahora es parte de nuestra colección. Disfruta de tus recursos iniciales:\n💰 Monedas: 100\n💎 Gemas: 10\n💀 Almas: 1\n📜 Contratos: 0`, 
            quoted: m 
        });
    }
};
