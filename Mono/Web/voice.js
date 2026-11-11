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
function create({Recognition,secure=true,onState=()=>{},onResult=()=>{},onProgress=()=>{},onFailure=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
let active=null, held=false, heldParts=[],restartTimer=null,heldText='';
function finishHeld(){clearTimer(restartTimer);restartTimer=null;held=false;const text=heldParts.join(' ').trim();heldParts=[];heldText='';onState('idle');if(text)onResult(text);else report('empty-result');}
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
function resultAndRelease(session){if(!release(session))return;const text=session.finalText||session.text;if(text)onResult(text);else report('empty-result');}
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
session.text=results.map(r=>r[0]?.transcript||'').join(' ').trim();
session.finalText=results.filter(r=>r.isFinal).map(r=>r[0]?.transcript||'').join(' ').trim();
heldText=session.finalText||session.text;onProgress([...heldParts,session.text].filter(Boolean).join(' '));
};
rec.onerror=event=>{if(held&&event.error==='no-speech')return;held=false;clearTimer(restartTimer);restartTimer=null;fail(session,event.error||'unknown-error',String(event.message||''));};
rec.onend=()=>{if(active!==session)return;if(session.failed){heldParts=[];heldText='';release(session);return;}if(held||heldParts.length){const text=session.finalText||session.text;if(text)heldParts.push(text);heldText='';clearTimer(session.timer);active=null;if(held&&!session.stopping){onState('listening');restartTimer=setTimer(()=>{restartTimer=null;if(held)startCycle();},180);}else finishHeld();}else resultAndRelease(session);};
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
session.timer=setTimer(()=>{if(active!==session)return;const text=[...heldParts,session.finalText||session.text].filter(Boolean).join(' ');heldParts=[];heldText='';abortAndRelease(session);if(text)onResult(text);else report('empty-result');},6000);
try{session.rec.stop();}catch(err){fail(session,err.name||'stop-error');}
}
function abort(){held=false;heldParts=[];heldText='';clearTimer(restartTimer);restartTimer=null;if(active)abortAndRelease(active);else onState('idle');}
return {start,stop,abort};
}
const api={create,describe};if(typeof module!=='undefined')module.exports=api;root.MonoVoice=api;
})(typeof window!=='undefined'?window:globalThis);
