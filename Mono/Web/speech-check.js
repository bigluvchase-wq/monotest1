'use strict';
const $=s=>document.querySelector(s),lines=[];
let rec=null,timer=null;
const standalone=window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches;
$('#context').textContent=standalone?'Режим: ярлык / отдельное веб-приложение. Для сравнения откройте эту страницу непосредственно в Safari.':'Режим: вкладка браузера.';
function log(text){lines.push(new Date().toLocaleTimeString('ru-RU')+' '+text);$('#trace').textContent=lines.join('\n');}
log('Контекст: '+(standalone?'standalone':'browser')+'; HTTPS: '+window.isSecureContext+'; язык телефона: '+navigator.language);
function finish(){clearTimeout(timer);$('#start').disabled=false;$('#stop').disabled=true;rec=null;}
$('#start').onclick=()=>{
if(rec)return;
$('#heard').textContent='';const C=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!C){$('#status').textContent='В этом браузере нет интерфейса распознавания.';log('API отсутствует');return;}
if(!window.isSecureContext){$('#status').textContent='Откройте опубликованную страницу по HTTPS.';log('insecure-context');return;}
let failed=false;const r=new C();rec=r;if($('#lang').value)r.lang=$('#lang').value;r.continuous=false;r.interimResults=true;
$('#start').disabled=true;$('#stop').disabled=false;$('#status').textContent='Запускаю системное распознавание…';log('Вызов start(); язык: '+($('#lang').value||'по умолчанию'));
r.onstart=()=>{clearTimeout(timer);$('#status').textContent='Слушаю. Скажите «проверка микрофона».';log('start');};
for(const name of ['audiostart','soundstart','speechstart','speechend','soundend','audioend'])r['on'+name]=()=>log(name);
r.onresult=e=>{const text=Array.from(e.results).map(x=>x[0].transcript).join(' ');$('#heard').textContent=text;$('#status').textContent='Текст получен. Системное распознавание сработало.';log('result: получен текст (не включён в диагностику)');};
r.onerror=e=>{if(rec!==r||failed)return;failed=true;clearTimeout(timer);$('#status').textContent='Ошибка системного распознавания: '+e.error;log('error: '+e.error+'; message: '+(e.message||'(пусто)'));timer=setTimeout(()=>{if(rec!==r)return;finish();try{r.abort();}catch{}},2500);};
r.onend=()=>{if(rec!==r)return;log('end');finish();};
timer=setTimeout(()=>{if(rec!==r)return;$('#status').textContent='Нет ответа сервиса в течение 20 секунд.';log('timeout 20s');r.abort();finish();},20000);
try{r.start();}catch(e){log('exception: '+e.name+'; '+e.message);$('#status').textContent='Не удалось запустить проверку.';finish();}
};
$('#stop').onclick=()=>{if(rec){log('Нажато завершение');rec.stop();}};
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(lines.join('\n'));$('#copy').textContent='Диагностика скопирована';}catch{$('#copy').textContent='Не удалось скопировать — можно прислать скриншот журнала';}};
window.addEventListener('pagehide',()=>{clearTimeout(timer);rec?.abort();});
