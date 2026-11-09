(function(root){
'use strict';
// Глобальный поиск по Моно: смахивание вниз на главной или значок лупы.
const layer=document.createElement('div');
layer.id='searchLayer';layer.hidden=true;layer.setAttribute('aria-hidden','true');
layer.innerHTML='<div class="search-backdrop" data-search-close></div><div class="search-top"><label class="search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="globalSearch" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Поиск по моно" aria-label="Поиск по Моно"></label><button type="button" class="search-cancel" data-search-close>Отмена</button></div><div class="search-results" id="searchResults" role="region" aria-live="polite"></div>';
document.body.append(layer);
const input=layer.querySelector('#globalSearch'),results=layer.querySelector('#searchResults');
let open=false,timer=0;
const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е');
const sections=[['accounts','Счета','Кошельки и валюты'],['goals','Цели','Копите на мечты'],['deposits','Вклады','Проценты в доход'],['limits','Лимиты','Контроль расходов'],['payments','Платежи','Даты и напоминания'],['categories','Категории','Порядок в операциях'],['settings','Настройки','Тема, язык, копии'],['support','Поддержка','Вопросы и идеи'],['profile','Профиль','Доступ и код']];
const chevron='<svg class="search-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const row=(kind,key,title,meta)=>`<button type="button" class="search-row" data-search-go="${kind}" data-search-key="${esc(key)}"><span class="search-row-text"><b>${esc(title)}</b>${meta?`<small>${esc(meta)}</small>`:''}</span>${chevron}</button>`;
const block=(title,html)=>html?`<section class="search-block"><h3>${esc(title)}</h3>${html}</section>`:'';
function haystack(e){const a=state.accounts.find(x=>x.id===e.account),d=e.date.split('-');return norm([e.title,e.category,a?.name,e.type==='income'?'доход':e.type==='expense'?'расход':e.type,d.reverse().join('.'),String(e.amount/100),String(e.amount/100).replace('.',',')].join(' '));}
function render(){
 const q=norm(input.value).trim(),tokens=q.split(/\s+/).filter(Boolean);
 if(!tokens.length){
  const recent=state.entries.slice().sort((a,b)=>(b.date+(b.createdAt||'')).localeCompare(a.date+(a.createdAt||''))).slice(0,5);
  results.innerHTML=block('Разделы',sections.map(([k,t,m])=>row('page',k,t,m)).join(''))+block('Недавние операции',`<div class="search-entries">${recent.map(e=>entryHTML(e)).join('')}</div>`);
  return;
 }
 const hit=text=>tokens.every(t=>norm(text).includes(t));
 const entries=state.entries.filter(e=>hit(haystack(e))).sort((a,b)=>(b.date+(b.createdAt||'')).localeCompare(a.date+(a.createdAt||'')));
 const found=[
  block('Операции'+(entries.length>20?' · '+entries.length:''),entries.length?`<div class="search-entries">${entries.slice(0,20).map(e=>entryHTML(e)).join('')}</div>`:''),
  block('Разделы',sections.filter(([,t,m])=>hit(t+' '+m)).map(([k,t,m])=>row('page',k,t,m)).join('')),
  block('Цели',state.goals.filter(g=>hit(g.name)).map(g=>row('page','goals',g.name,'Цель')).join('')),
  block('Вклады',(state.deposits||[]).filter(d=>hit(d.name)).map(d=>row('page','deposits',d.name,d.rate+'% годовых')).join('')),
  block('Платежи',state.payments.filter(p=>hit(p.name+' '+(p.bank||'')+' '+p.category)).map(p=>row('page','payments',p.name,[p.bank,money(p.amount,account(p.account)?.currency)].filter(Boolean).join(' · '))).join('')),
  block('Счета',state.accounts.filter(a=>hit(a.name)).map(a=>row('page','accounts',a.name,a.currency)).join('')),
  block('Категории',[...new Set([...state.categories,...state.incomeCategories])].filter(hit).map(c=>row('page','categories',c,'')).join(''))
 ].join('');
 results.innerHTML=found||`<p class="search-empty">Ничего не нашли по «${esc(input.value.trim())}»</p>`;
}
function show(){
 if(open||tourActive||document.querySelector('dialog[open]'))return;
 open=true;clearTimeout(timer);
 if(holding||listening)cancelVoice();
 layer.hidden=false;layer.setAttribute('aria-hidden','false');input.value='';render();
 void layer.offsetWidth;layer.classList.add('on');
 input.focus({preventScroll:true});
}
function hide(){
 if(!open)return;open=false;
 input.blur();layer.classList.remove('on');layer.setAttribute('aria-hidden','true');
 timer=setTimeout(()=>{layer.hidden=true;},reducedMotion()?0:380);
}
layer.addEventListener('click',e=>{
 if(e.target.closest('[data-search-close]')){hide();return;}
 const go=e.target.closest('[data-search-go]');
 if(go){hide();const page=go.dataset.searchKey;setTimeout(()=>navigate(page),reducedMotion()?0:120);return;}
 // нажатие на пустое место ниже результатов закрывает поиск
 if(e.target===layer||e.target===results)hide();
});
layer.addEventListener('click',e=>{if(e.target.closest('[data-entry-open]'))input.blur();},true);
input.addEventListener('input',()=>{render();results.scrollTop=0;});
input.addEventListener('keydown',e=>{if(e.key==='Escape')hide();if(e.key==='Enter')input.blur();});
document.addEventListener('keydown',e=>{if(open&&e.key==='Escape')hide();});
document.addEventListener('click',e=>{if(e.target.closest('#searchButton')){e.preventDefault();show();}});
// Смахивание вниз на главной экране
(()=>{const home=document.querySelector('#home');let g=null;
 home.addEventListener('touchstart',e=>{if(page!=='home'||e.touches.length!==1||holding||listening||tourActive||e.target.closest('#mic,#voiceAccount,.reminder,select,input')){g=null;return;}const t=e.touches[0];g={x:t.clientX,y:t.clientY,t:performance.now()};},{passive:true});
 home.addEventListener('touchend',e=>{if(!g)return;const t=e.changedTouches[0],dx=t.clientX-g.x,dy=t.clientY-g.y,dt=performance.now()-g.t;g=null;if(dy>70&&Math.abs(dx)<dy*.6&&dt<800)show();},{passive:true});
 home.addEventListener('touchcancel',()=>{g=null;},{passive:true});})();
root.MonoSearch={show,hide,isOpen:()=>open};
})(window);
