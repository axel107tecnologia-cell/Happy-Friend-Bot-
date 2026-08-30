import { smsg } from '../lib/simple.js';
import { revisarAntiLink } from '../lib/antilink.js';
import chalk from 'chalk';
import fs from 'node:fs';

export async function handler(sock, chatUpdate, connectBot, isSub = false) {
    if (!chatUpdate) return;
    
    let rawM = chatUpdate.messages[chatUpdate.messages.length - 1];
    if (!rawM) return;
    if (rawM.isBaileys) return;

    try {
        let m = smsg(sock, rawM) || rawM;
        if (!m) return;

        const chat = m.chat || m.key.remoteJid;
        const isGroup = chat.endsWith('@g.us');
        const senderJid = isGroup
            ? (rawM.key.participantAlt || rawM.key.participant || chat)
            : (rawM.key.remoteJidAlt || chat);
        const senderNum = senderJid.split('@')[0].split(':')[0];
        

        const stubType = Number(rawM.messageStubType);
        const stubUsers = rawM.messageStubParameters || [];

        if (
            isGroup &&
            stubUsers.length &&
            [27, 28, 29, 30].includes(stubType)
        ) {
            let groupMetadata = null;
            let participants = [];

            try {
                groupMetadata = await sock.groupMetadata(chat);
                participants = groupMetadata.participants || [];
            } catch {}

            for (let name in global.plugins) {
                const rawPlugin = global.plugins[name];
                const plugin = rawPlugin?.default || rawPlugin;

                if (
                    plugin &&
                    typeof plugin.onGroupUpdate === 'function'
                ) {
                    try {
                        await plugin.onGroupUpdate(rawM, {
                            sock,
                            from: chat,
                            chat,
                            groupMetadata,
                            participants,
                            stubType,
                            stubUsers
                        });
                    } catch (err) {
                        console.error(
                            '❌ Error en evento del plugin ' + name + ':',
                            err
                        );
                    }
                }
            }

            return;
        }

        let body = String(
            m.message?.conversation || 
            m.message?.extendedTextMessage?.text || 
            m.message?.imageMessage?.caption || 
            m.message?.videoMessage?.caption || 
            ''
        ).trim();



        const fueModerado = await revisarAntiLink({
            sock,
            rawM,
            body,
            chat,
            isGroup,
            senderJid,
            isSub
        });

        if (fueModerado) return;

        const prefixes = ['.', '#'];
        const usedPrefix = prefixes.find(p => body.startsWith(p));
        if (!usedPrefix) return; 

        const noPrefix = body.slice(usedPrefix.length).trim();
        const args = noPrefix.split(' ').filter(Boolean);
        const command = args.shift().toLowerCase();
        if (!command) return;

        if (isGroup && command !== 'bot') {
            let estadosBot = {};

            try {
                estadosBot = JSON.parse(
                    fs.readFileSync(
                        'bot-groups.json',
                        'utf8'
                    )
                );
            } catch {}

            if (estadosBot[chat] === false) {
                return;
            }
        }

          if (
              true &&
              isGroup &&
              command !== 'setbot' &&
              command !== 'resetbot'
          ) {
              let seleccionados = {};

              try {
                  seleccionados = JSON.parse(
                      fs.readFileSync(
                          'setbot-groups.json',
                          'utf8'
                      )
                  );
              } catch {}

              const elegido = String(
                  seleccionados[chat] || ''
              )
                  .split(':')[0]
                  .split('@')[0];

              const actual = String(
                  sock.__sessionJid ||
                  sock.user?.id ||
                  sock.user?.jid ||
                  sock.user?.lid ||
                  ''
              )
                  .split(':')[0]
                  .split('@')[0];

              // Sin selección específica, solo responde el bot principal
              if (!elegido && isSub) {
                  return;
              }

              // Si el grupo tiene una selección, solo responde ese bot
              if (elegido && actual && elegido !== actual) {
                  return;
              }
          }



        console.log(chalk.bold.yellow('\n⚡ [COMANDO DETECTADO]: ' + usedPrefix + command + ' por ' + (m.pushName || 'Usuario')));

        let groupMetadata = null;
        let participants = [];
        if (isGroup) {
            try {
                 groupMetadata = await sock.groupMetadata(chat);
                participants = groupMetadata.participants;
            } catch {
                participants = [];
            }
        }

        for (let name in global.plugins) {
            let rawPlugin = global.plugins[name];
            let plugin = rawPlugin?.default || rawPlugin;
            if (!plugin) continue;

            let executeFn = plugin.run || plugin.execute;
            let cmdList = plugin.command || [];
            if (!Array.isArray(cmdList)) cmdList = [cmdList];
            
            const isMatch = cmdList.map(c => String(c).toLowerCase()).includes(command);
            if (!isMatch) continue;
            if (typeof executeFn !== 'function') continue;

            if (plugin.owner || plugin.rowner) {
                const normalizarOwner = valor =>
                    String(valor || '')
                        .split(':')[0]
                        .split('@')[0]
                        .replace(/[^0-9]/g, '');

                const idsDelUsuario = [
                    rawM.key.participant,
                    rawM.key.participantAlt,
                    rawM.key.remoteJid,
                    rawM.key.remoteJidAlt
                ]
                    .map(normalizarOwner)
                    .filter(Boolean);

                const ownersOficiales = Array.isArray(global.rowner)
                    ? global.rowner.map(normalizarOwner)
                    : [];

                const esOwnerOficial = idsDelUsuario.some(id =>
                    ownersOficiales.includes(id)
                );

                if (!esOwnerOficial) {
                    await sock.sendMessage(
                        chat,
                        {
                            text: 'Solo el owner oficial puede usar este comando.'
                        },
                        { quoted: rawM }
                    );
                    return;
                }

                const comandosTerminal = [
                    '$',
                    'exec',
                    'shell'
                ];

                const esTerminal = cmdList.some(c =>
                    comandosTerminal.includes(
                        String(c).toLowerCase()
                    )
                );

                if (esTerminal && isGroup) {
                    await sock.sendMessage(
                        chat,
                        {
                            text:
                                'Este comando solo funciona en el chat privado del owner oficial.'
                        },
                        { quoted: rawM }
                    );
                    return;
                }
            }


            if (plugin.group && !isGroup) {
                await sock.sendMessage(chat, { text: "Solo en grupos." }, { quoted: rawM });
                return;
            }

            const normalizarId = valor =>
                String(valor || '').split(':')[0].split('@')[0];

            const tienePermisoAdmin = participante =>
                participante?.admin === 'admin' ||
                participante?.admin === 'superadmin';

            if (plugin.admin && isGroup) {
                const idsDelUsuario = [
                    rawM.key.participant,
                    rawM.key.participantAlt,
                    rawM.key.remoteJid
                ].map(normalizarId).filter(Boolean);

                const senderData = participants.find(participante => {
                    const ids = [
                        participante.id,
                        participante.jid,
                        participante.lid,
                        participante.phoneNumber
                    ].map(normalizarId);

                    return ids.some(id => idsDelUsuario.includes(id));
                });

                if (!tienePermisoAdmin(senderData)) {
                    await sock.sendMessage(chat, { text: "Solo administradores." }, { quoted: rawM });
                    return;
                }
            }

            if (plugin.botAdmin && isGroup) {
                const idsDelBot = [
                    sock.user?.id,
                    sock.user?.jid,
                    sock.user?.lid
                ].map(normalizarId).filter(Boolean);

                const botData = participants.find(participante => {
                    const ids = [
                        participante.id,
                        participante.jid,
                        participante.lid,
                        participante.phoneNumber
                    ].map(normalizarId);

                    return ids.some(id => idsDelBot.includes(id));
                });

                const isBotAdmin = tienePermisoAdmin(botData);
                if (!isBotAdmin) {
                    await sock.sendMessage(chat, { text: "Necesito ser administrador." }, { quoted: rawM });
                    return;
                }
            }

            const extraData = {
                conn: sock,
                sock,
                from: chat,
                chat,
                isGroup,
                senderJid,
                senderNum,
                args,
                text: args.join(' '),
                usedPrefix,
                command,
                participants,
                 groupMetadata, connectBot
            };

            try {
                await executeFn(m, extraData);
                console.log(chalk.bgGreen.black.bold(' ✅ [EXITO]: ' + name));
            } catch (err) {
                console.error(chalk.red('❌ Error ejecutando [' + name + ']:'), err);
                await sock.sendMessage(chat, { text: 'Error en ' + usedPrefix + command }, { quoted: rawM });
            }
            return;
        }


        await sock.sendMessage(
            chat,
            {
                text: '❌ Comando incorrecto. Prueba con .menu para ver la lista de comandos disponibles.'
            },
            { quoted: rawM }
        );

    } catch (e) {
        console.error(chalk.bold.red("❌ Error crítico en el Handler maestro:"), e);
    }
}

export default { handler };
