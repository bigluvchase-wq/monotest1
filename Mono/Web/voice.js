(function(root){
'use strict';
const messages={
'not-allowed':'iOS не разрешила распознавание речи. Проверьте разрешения моно.',
'service-not-allowed':'Сервис распознавания речи сейчас недоступен. Этот код не позволяет точно определить причину: это может быть настройка системы, ограничение iOS или недоступность сервиса.',
'audio-capture':'Не удалось получить звук с микрофона. Проверьте разрешения моно и закройте другие приложения, использующие микрофон.',
'network':'Не удалось связаться с сервисом распознавания. Проверьте подключение к интернету.',
'no-speech':'Речь не обнаружена. Попробуйте ещё раз и дождитесь надписи «Слушаю вас».',
'language-not-supported':'Системный сервис iOS не поддерживает выбранный русский язык.',
'aborted':'iOS прервала распознавание до завершения.',
'unsupported':'В этом браузере нет интерфейса распознавания речи.',
'insecure-context':'Для голосового ввода нужно открыть сайт по защищённому адресу HTTPS.',
'start-timeout':'Сервис распознавания не запустился. Проверьте разрешения и доступность Siri на iPhone.',
'empty-result':'Сервис завершил работу без распознанного текста. Операции не добавлены.'
};
function describe(code){return messages[code]||'Системный сервис iOS завершил распознавание с ошибкой. Код ниже поможет найти причину.';}
// Merge repeated recognizer responses only at session boundaries, never deduplicate entries.
function joinSpeech(parts){
 let words=[],keys=[];
 const key=w=>w.toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]/gu,'');
 for(const part of parts){const next=String(part).trim().split(/\s+/).filter(Boolean),nk=next.map(key);let overlap=0;
  for(let n=Math.min(keys.length,nk.length);n>=4;n--)if(keys.slice(-n).every((w,i)=>w===nk[i])){overlap=n;break;}
  words.push(...next.slice(overlap));keys.push(...nk.slice(overlap));
 }
 return words.join(' ');
}
const Engine=typeof module==='object'?require('./engine'):root.MonoEngine;
function moneySignature(text){
 const {text:normalized,amounts}=Engine.voiceAmounts(text);
 let result='',cursor=0;
 for(const {amount,start,end} of amounts){
  result+=normalized.slice(cursor,start)+' #'+amount+' ';cursor=end;
 }
 return {key:(result+normalized.slice(cursor)).toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}#]+/gu,' ').trim().split(' '),count:amounts.length};
}
// A recognizer can restart the same hypothesis after emitting an unfinished word.
function repairReplay(text,{short=false}={}){
 const words=String(text).trim().split(/\s+/);
 const keys=words.map(word=>word.toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]/gu,''));
 const label=/^\p{L}+$/u,number=/^\d+(?:[.,]\d{1,2})?$/u;
 if(label.test(words[0])&&number.test(words[1])&&keys[0]){
  if(short&&words.length===4&&keys[0]===keys[2]&&words[1]===words[3])return words.slice(2).join(' ');
  // A decimal amount already contains the kopecks. iOS can replay it around a garbled currency tail.
  const ruble=/^руб(?:ль|ля|лей)?$/;
  if(short&&words.length===6&&ruble.test(keys[2])&&keys[0]===keys[3]&&words[1]===words[4]&&keys[2]===keys[5])return words.slice(3).join(' ');
  const noise=/^ко(?:п(?:е(?:ек|йка|йки)?)?|ек)$/;
  if(words.length>=7&&/[.,]/.test(words[1])&&ruble.test(keys[2])&&noise.test(keys[3])&&
   keys[0]===keys[4]&&words[1]===words[5]&&ruble.test(keys[6])){
   const tail=words.slice(7);
   if(noise.test(keys[7]))tail.shift();
   return [...words.slice(4,7),...tail].join(' ');
  }
 }

 for(let restart=5;restart<=words.length-4;restart++){
  const boundary=words[restart-1];
  if(keys[restart]!==keys[0]||/[.!?;,:]$/u.test(boundary)||/^(?:и|а|потом|затем|снова|еще|плюс|также)$/u.test(keys[restart-1]))continue;
  // The recognizer can repeat the same amount in a different notation: “1999” / “тыща 999”.
  const earlier=moneySignature(words.slice(0,restart).join(' '));
  if(earlier.count>=2){
   const later=moneySignature(words.slice(restart).join(' '));
   if(earlier.key.every((token,index)=>token===later.key[index]))return words.slice(restart).join(' ');
  }
  const first=keys.slice(0,restart),next=keys.slice(restart,restart*2);
  // Require the same amount and sentence prefix. A conjunction is an explicit boundary.
  if(!first.slice(0,-1).some(key=>/\d|тысяч/u.test(key))||!first.slice(0,-1).every((key,i)=>key===next[i]))continue;
  const last=first.at(-1);
  if(!last||/^(?:и|потом|затем)$/u.test(last)||!/\p{L}/u.test(last)&&last!==next.at(-1))continue;
  if(next.length===restart&&next.at(-1).startsWith(last))return words.slice(restart).join(' ');
 }
 return text;
}
// One complete formatted hypothesis per recognition window. Never rebuild from words:
// iOS can represent “650” as multiple segments while formattedString remains correct.
function createTranscript(){
 let prefix='',current='',start=null,end=null;
 const key=s=>s.toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 return {update(text,rawStart,rawEnd){
  if(!text)return joinSpeech([prefix,current]);
  text=repairReplay(text,{short:true});
  const nextStart=rawStart===undefined?NaN:Number(rawStart),nextEnd=rawEnd===undefined?NaN:Number(rawEnd);
  const full=joinSpeech([prefix,current]),incoming=key(text),known=key(full);
  // A cumulative hypothesis supersedes all earlier versions, including shifted timestamps.
  if(known&&known.split(' ').length>=8&&incoming===known+' '+known)return full;
  const separate=start!==null&&end!==null&&nextStart>end+.15&&nextStart>start;
  if(separate&&incoming===known&&known.split(' ').length<4)prefix=full;
  else if((start!==null&&Number.isFinite(nextStart)&&nextStart<start-.15)||(known&&(incoming===known||incoming.startsWith(known+' '))))prefix='';
  else if(separate)prefix=full;
  // Sliding-window revisions replace the current window rather than repeatedly appending it.
  current=text;
  start=Number.isFinite(nextStart)?nextStart:null;end=Number.isFinite(nextEnd)?nextEnd:null;
  return repairReplay(joinSpeech([prefix,current]));
 }};
}
function create({Recognition,secure=true,onState=()=>{},onResult=()=>{},onProgress=()=>{},onFailure=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
let active=null, held=false, heldParts=[],restartTimer=null,heldText='';
function finishHeld(){clearTimer(restartTimer);restartTimer=null;held=false;const text=repairReplay(joinSpeech(heldParts));heldParts=[];heldText='';onState('idle');if(text)onResult(text);else report('empty-result');}
const report=code=>onFailure({code,message:describe(code)});
function release(session){if(active!==session)return false;clearTimer(session.timer);active=null;onState('idle');return true;}
function abortAndRelease(session){if(active!==session)return;release(session);try{session.rec.abort();}catch{}}
function fail(session,code,detail=''){
if(active!==session||session.failed)return;
session.failed=true;clearTimer(session.timer);
// An error is not necessarily the end of WebKit's native session. Wait for onend.
onState('finishing');
session.timer=setTimer(()=>abortAndRelease(session),3000);
onFailure({code,message:describe(code),detail});
}
function resultAndRelease(session){if(!release(session))return;const text=session.text||session.finalText;if(text)onResult(text);else report('empty-result');}
function start(options={}){
if(active||restartTimer)return;
if(options.hold){held=true;heldParts=[];heldText='';}
startCycle();
}
function startCycle(){
if(!secure){report('insecure-context');return;}
if(!Recognition){report('unsupported');return;}
let rec;try{rec=new Recognition();}catch(err){report(err.name||'constructor-error');return;}
const session={rec,text:'',finalText:'',timer:null,failed:false,stopping:false};active=session;
// Restore the configuration used in the first working prototype.
rec.lang='ru-RU';rec.continuous=held;rec.interimResults=true;
rec.onstart=()=>{if(active!==session||session.failed)return;clearTimer(session.timer);session.timer=null;if(session.stopping){try{rec.stop();}catch{}return;}onState('listening');};
rec.onresult=event=>{
if(active!==session||session.failed)return;
const results=Array.from(event.results);
session.text=repairReplay(results.map(r=>repairReplay(r[0]?.transcript||'',{short:true})).join(' ').trim());
session.finalText=repairReplay(results.filter(r=>r.isFinal).map(r=>repairReplay(r[0]?.transcript||'',{short:true})).join(' ').trim());
heldText=session.text||session.finalText;onProgress([...heldParts,session.text].filter(Boolean).join(' '));
};
rec.onerror=event=>{if(held&&event.error==='no-speech')return;held=false;clearTimer(restartTimer);restartTimer=null;fail(session,event.error||'unknown-error',String(event.message||''));};
rec.onend=()=>{if(active!==session)return;if(session.failed){heldParts=[];heldText='';release(session);return;}if(held||heldParts.length){const text=session.text||session.finalText;if(text)heldParts.push(text);heldText='';clearTimer(session.timer);active=null;if(held&&!session.stopping){onState('listening');restartTimer=setTimer(()=>{restartTimer=null;if(held)startCycle();},180);}else finishHeld();}else resultAndRelease(session);};
onState('starting');
session.timer=setTimer(()=>{if(active!==session||session.failed)return;held=false;heldParts=[];abortAndRelease(session);report('start-timeout');},15000);
try{rec.start();}catch(err){held=false;heldParts=[];release(session);const aliases={NotAllowedError:'not-allowed',SecurityError:'not-allowed',NotSupportedError:'unsupported'};report(aliases[err.name]||err.name||'start-error');}
}
function stop(){
const wasHeld=held;held=false;
if(restartTimer){clearTimer(restartTimer);restartTimer=null;finishHeld();return;}
if(!active){if(wasHeld)finishHeld();return;}
if(active.failed||active.stopping)return;
const session=active;session.stopping=true;clearTimer(session.timer);onState('stopping');
session.timer=setTimer(()=>{if(active!==session)return;const text=repairReplay(joinSpeech([...heldParts,session.text||session.finalText].filter(Boolean)));heldParts=[];heldText='';abortAndRelease(session);if(text)onResult(text);else report('empty-result');},6000);
try{session.rec.stop();}catch(err){fail(session,err.name||'stop-error');}
}
function abort(){held=false;heldParts=[];heldText='';clearTimer(restartTimer);restartTimer=null;if(active)abortAndRelease(active);else onState('idle');}
return {start,stop,abort};
}
const api={create,describe,joinSpeech,createTranscript,repairReplay};if(typeof module!=='undefined')module.exports=api;root.MonoVoice=api;
})(typeof window!=='undefined'?window:globalThis);
