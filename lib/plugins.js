const { readdirSync } = require('fs');
const { join } = require('path');
const chalk = require('chalk');

global.plugins = global.plugins || {};
global.pluginErrors = global.pluginErrors || {};

async function loadPlugins() {
    // Apunta directamente a la carpeta 'plugins' en la raíz de tu proyecto
    const pluginsFolder = join(__dirname, '../plugins');
    let files;
    
    try {
        files = readdirSync(pluginsFolder);
    } catch (err) {
        console.log(chalk.redBright(`❌ Error crítico leyendo la carpeta de comandos: ${pluginsFolder}`));
        return;
    }

    for (let file of files) {
        if (!file.endsWith('.js')) continue;
        const filePath = join(pluginsFolder, file);

        try {
            // Limpiar caché para permitir recargas en vivo limpias
            delete require.cache[require.resolve(filePath)];
            const plugin = require(filePath);

            global.plugins[file] = plugin;
            console.log(chalk.greenBright(`✨ [CARGADO] -> ${file}`));
        } catch (e) {
            global.pluginErrors[file] = e.message;

            console.log(
                chalk.redBright(
                    `❌ No se pudo cargar el plugin "${file}":`
                ),
                e
            );
        }
    }
}

// Exportamos de forma nativa para que tu main.js lo reciba perfectamente mediante requireCJS
module.exports = { loadPlugins };
