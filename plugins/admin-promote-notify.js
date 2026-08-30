const jid=x=>String(x||'').replace(/[^0-9]/g,'')+'@s.whatsapp.net';
const men=x=>'@'+String(x||'').split('@')[0].replace(/[^0-9]/g,'');
module.exports={command:[],onGroupUpdate:async(raw,{sock,chat,stubType,stubUsers})=>{if(![29,30].includes(stubType)||!stubUsers.length)return;let a=raw.key.participantAlt||raw.key.participant||raw.participant,u=stubUsers[0];return sock.sendMessage(chat,{text:stubType===29?`${men(a)} le ha dado administrador a ${men(u)} 👑`:`${men(a)} le ha quitado el administrador a ${men(u)} ⚠️`,mentions:[jid(a),jid(u)]})}};
