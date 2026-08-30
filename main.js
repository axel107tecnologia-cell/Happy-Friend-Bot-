import './settings.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode-terminal';
import readline from 'readline';

// --- TRUCO DE COMPATIBILIDAD INTEGRADO ---
import { createRequire } from 'module';
const requireCJS = createRequire(import.meta.url);
const { connectBot } = requireCJS('./lib/connection.js');
const { useSQLiteAuthState } = requireCJS('./src/database/db.js');
const { loadPlugins } = requireCJS('./lib/plugins.js'); 
// --------------------------------------------------

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

function setupFolders() {
    [global.tmpDir, global.alastorsessions, global.alastorsubs].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
    // Limpiar TMP
    if (fs.existsSync(global.tmpDir)) {
        fs.readdirSync(global.tmpDir).forEach(file => fs.unlinkSync(path.join(global.tmpDir, file)));
    }
}

async function startAlastor() {
    console.clear();
    console.log(chalk.hex('#FF0000').bold(`
    █████╗ ██╗      █████╗ ███████╗████████╗ ██████╗ ██████╗ 
    ██╔══██╗██║     ██╔══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗
    ███████║██║     ███████║███████╗   ██║   ██║   ██║██████╔╝
    ██╔══██║██║     ██╔══██║╚════██║   ██║   ██║   ██║██╔══██╗
    ██║  ██║███████╗██║  ██║███████║   ██║   ╚██████╔╝██║  ██║
    ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
    `));
    console.log(chalk.white.bold(`      DEV: `) + chalk.bgRed.black.bold(` Friends Happy Bot `) + chalk.red(` - "¡Es un placer conocerte!"\n`));

    setupFolders();

    // Ejecución indexadora de comandos de forma síncrona/esperada
    await loadPlugins();

    const { state } = await useSQLiteAuthState(global.alastorsessions, 'main');
    const hasSession = state.creds && state.creds.me && state.creds.me.id;

    let method = null, phoneNumber = null;

    if (!hasSession) {
        console.log(chalk.red.bold(' Demonio de la Radio: ¿Cómo sintonizaremos?'));
        console.log(chalk.white('1. Código QR\n2. Pairing Code (Recomendado)'));
        method = await question(chalk.yellow('\nOpción: '));
        if (method === '2') {
            phoneNumber = (await question(chalk.green('Número (ej: 18255699594): '))).replace(/[^0-9]/g, '');
        }
    }

    // Iniciar Principal
    await connectBot({
        basePath: global.alastorsessions,
        jid: 'main',
        pairingNumber: method === '2' ? phoneNumber : null,
        qrCallback: (qr) => {
            if (method === '1') {
                console.log(chalk.bgRed.white.bold('\n  ESCANEA EL QR PARA SINTONIZAR  \n'));
                qrcode.generate(qr, { small: true });
            }
        },
        onCode: (code) => console.log(chalk.bold.red(`\n[ FRECUENCIA DE EMPAREJAMIENTO ] `) + chalk.bold.white(code))
    });

    // Iniciar Sub-Bots
    if (fs.existsSync(global.alastorsubs)) {
        fs.readdirSync(global.alastorsubs).forEach(jid => {
            connectBot({ basePath: global.alastorsubs, jid, isSub: true });
        });
    }
}

startAlastor();
