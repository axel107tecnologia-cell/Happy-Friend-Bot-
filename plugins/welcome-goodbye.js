const fs=require('fs'),path=require('path');
const FILE='welcome-settings.json',DIR=path.join('database','welcome-media');
const read=()=>{try{return JSON.parse(fs.readFileSync(FILE))}catch{return {}}};
const save=x=>fs.writeFileSync(FILE,JSON.stringify(x,null,2));
const jid=x=>String(x||'').replace(/[^0-9]/g,'')+'@s.whatsapp.net';
const men=x=>'@'+String(x||'').split('@')[0].replace(/[^0-9]/g,'');
const cfg=(d,g)=>d[g]??=( {welcome:true,bye:true,welcomeText:'¡Bienvenido/a @user a @subject! 👋',byeText:'Hasta luego @user. 👋'} );
const render=(s,u,g)=>String(s).replace(/@user|@usuario/gi,men(u)).replace(/@subject|@grupo/gi,g||'este grupo');
module.exports={
 command:['setwelcome','setbienvenida','setbye','setdespedida','welcome','bienvenida','bye','despedida'],group:true,admin:true,
 execute:async(m,{sock,from,args,text,command})=>{let d=read(),c=cfg(d,from);if(['welcome','bienvenida','bye','despedida'].includes(command)){let v=String(args[0]||'').toLowerCase();if(!['on','off'].includes(v))return sock.sendMessage(from,{text:`Usa .${command} on o .${command} off`},{quoted:m});let w=['welcome','bienvenida'].includes(command);c[w?'welcome':'bye']=v==='on';save(d);return sock.sendMessage(from,{text:`Función ${command}: ${v==='on'?'activada ✅':'desactivada ❌'}`},{quoted:m})}let w=['setwelcome','setbienvenida'].includes(command),t=w?'welcome':'bye';if(!text&&!m.quoted)return sock.sendMessage(from,{text:`Escribe el mensaje o responde una imagen con .set${t}`},{quoted:m});if(m.quoted?.mimetype?.startsWith('image/')){fs.mkdirSync(DIR,{recursive:true});let f=path.join(DIR,from.replace(/[^0-9]/g,'')+'-'+t+'.jpg');fs.writeFileSync(f,await m.quoted.download());c[t+'Image']=f}if(text){if(/^--sinimagen/i.test(text))delete c[t+'Image'];c[t+'Text']=text.replace(/^--sinimagen\s*/i,'').trim()||c[t+'Text']}save(d);return sock.sendMessage(from,{text:`✅ Mensaje de ${w?'bienvenida':'despedida'} actualizado.`},{quoted:m})},
 onGroupUpdate:async(raw,{sock,chat,groupMetadata,stubType,stubUsers})=>{let d=read(),c=cfg(d,chat),t=stubType===27?'welcome':stubType===28?'bye':null;if(!t||c[t]===false||!stubUsers.length)return;let text=render(c[t+'Text'],stubUsers[0],groupMetadata?.subject),mentions=stubUsers.map(jid),f=c[t+'Image'];if(f&&fs.existsSync(f))return sock.sendMessage(chat,{image:fs.readFileSync(f),caption:text,mentions});return sock.sendMessage(chat,{text,mentions})}
};
