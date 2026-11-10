(function(root){
'use strict';
function endpoint(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Укажите HTTPS-адрес без пароля, параметров и фрагмента.');return url.href.replace(/\/$/,'');}
function wav(input,rate){
const step=rate/16000,frames=Math.floor(input.length/step),buffer=new ArrayBuffer(44+frames*2),view=new DataView(buffer);
const text=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
text(0,'RIFF');view.setUint32(4,36+frames*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,frames*2,true);
for(let i=0;i<frames;i++){const start=i*step,end=Math.min((i+1)*step,input.length);let sum=0,weight=0;for(let j=Math.floor(start);j<end;j++){const w=Math.min(j+1,end)-Math.max(j,start);sum+=input[j]*w;weight+=w;}const n=Math.max(-1,Math.min(1,weight?sum/weight:0));view.setInt16(44+i*2,n<0?n*32768:n*32767,true);}
return new Blob([buffer],{type:'audio/wav'});
}
function create({onState=()=>{},onResult=()=>{},onFailure=()=>{},fetcher=(...args)=>fetch(...args)}){
let config=null,session=null,controller=null,busy=false,generation=0;
const fail=(code,message)=>onFailure({code,message});
async function configure(url,key){
const next={url:endpoint(url),key:key.trim()};if(next.key.length<24)throw Error('Нужен токен сервера длиной не менее 24 символов.');
const check=new AbortController(),timer=setTimeout(()=>check.abort(),12000);
try{const response=await fetcher(next.url+'/health',{headers:{Authorization:'Bearer '+next.key},signal:check.signal,cache:'no-store',credentials:'omit'});const result=await response.json();if(!response.ok||result.engine!=='pisets'||result.status!=='ready'){if(response.status===401)throw Error('Сервер отклонил токен.');if(result.status==='loading')throw Error('Сервер ещё загружает модели. Повторите проверку позже.');if(result.status==='failed')throw Error('Сервер не смог загрузить модели Pisets.');throw Error('Сервер не готов или не поддерживает интеграцию моно.');}config=next;}finally{clearTimeout(timer);}
}
function cleanup(s){clearTimeout(s.timer);s.processor?.disconnect();s.source?.disconnect();s.mute?.disconnect();s.stream?.getTracks().forEach(t=>t.stop());s.context?.close().catch(()=>{});}
async function start(){
if(session||busy)return;if(!config){fail('pisets-not-configured','Сначала подключите готовый сервер Pisets в настройках.');return;}if(!navigator.mediaDevices?.getUserMedia){fail('audio-capture','Браузер не предоставляет доступ к микрофону.');return;}
const s={id:++generation,blocks:[],samples:0};session=s;onState('starting');
try{const AC=window.AudioContext||window.webkitAudioContext;s.context=new AC();await s.context.resume();s.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});if(session!==s){cleanup(s);return;}s.source=s.context.createMediaStreamSource(s.stream);s.processor=s.context.createScriptProcessor(4096,1,1);s.mute=s.context.createGain();s.mute.gain.value=0;s.processor.onaudioprocess=e=>{if(session!==s)return;const block=new Float32Array(e.inputBuffer.getChannelData(0));s.blocks.push(block);s.samples+=block.length;};s.source.connect(s.processor);s.processor.connect(s.mute);s.mute.connect(s.context.destination);onState('listening');s.timer=setTimeout(stop,30000);}catch(error){if(session!==s)return;session=null;cleanup(s);onState('idle');fail(error.name==='NotAllowedError'?'not-allowed':'audio-capture','Не удалось начать запись. Проверьте доступ сайта к микрофону.');}}
async function stop(){
const s=session;if(!s)return;session=null;cleanup(s);
if(!s.samples){onState('idle');fail('no-speech','Запись пуста. Ничего не добавлено.');return;}
const raw=new Float32Array(s.samples);let at=0,energy=0;for(const block of s.blocks){raw.set(block,at);at+=block.length;for(const x of block)energy+=x*x;}s.blocks=[];
if(raw.length/s.context.sampleRate<.35||Math.sqrt(energy/raw.length)<.003){onState('idle');fail('no-speech','Запись слишком короткая или тихая. Ничего не добавлено.');return;}
busy=true;controller=new AbortController();const requestController=controller,token=generation;onState('processing');const timer=setTimeout(()=>requestController.abort(),120000);
try{const body=new FormData();body.append('audio',wav(raw,s.context.sampleRate),'dictation.wav');const response=await fetcher(config.url+'/recognize',{method:'POST',headers:{Authorization:'Bearer '+config.key},body,signal:requestController.signal,credentials:'omit',cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(({401:'Токен сервера недействителен. Подключите сервер заново.',429:'Сервер занят другой записью. Повторите позже.',503:'Модели на сервере ещё не готовы.'})[response.status]||'Сервер не смог распознать запись.');if(data.engine!=='pisets'||typeof data.text!=='string')throw Error('Сервер вернул неподходящий ответ.');if(token!==generation)return;const text=data.text.trim();onState('idle');if(text)onResult(text);else fail('no-speech','Pisets не обнаружил речь. Ничего не добавлено.');}
catch(error){if(token!==generation)return;onState('idle');fail('pisets-request',error.name==='AbortError'?'Сервер не ответил за две минуты. Попробуйте более короткую запись.':error.message||'Не удалось связаться с сервером Pisets.');}
finally{clearTimeout(timer);if(controller===requestController){controller=null;busy=false;}}}
function abort(){generation++;const s=session;session=null;if(s)cleanup(s);controller?.abort();controller=null;busy=false;onState('idle');}
function disconnect(){abort();config=null;}
return {configure,start,stop,abort,disconnect,get configured(){return !!config;}};
}
const api={create,endpoint,wav};if(typeof module!=='undefined')module.exports=api;root.MonoPisets=api;
})(typeof window!=='undefined'?window:globalThis);
