(function(root){
'use strict';
// Главный экран: общий баланс с «глазом», расходы и доходы месяца.
// Вид и скрытие сумм настраиваются в «Настройки → Главный экран». Классический вид — фраза «Просто скажи, сколько».
const I=()=>root.MonoInsights;
const cfg=()=>({mode:'dash',hideScope:'all',hideOnStart:false,...(state.settings.home||{})});
let hidden=cfg().hideOnStart===true;
const cur=()=>state.accounts.some(a=>a.currency==='RUB')?'RUB':state.accounts[0].currency;
const MASK='••••• ₽';
const ico={
 eye:'<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
 eyeOff:'<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
 down:'<svg viewBox="0 0 24 24"><path d="M17 7 7 17M15 17H7V9"/></svg>',
 up:'<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg>'
};
function hides(part){if(!hidden)return false;const s=cfg().hideScope;return s==='all'||s===part;}

function html(){
 const c=cur(),t=E.dateString(new Date()),ym=t.slice(0,7);
 const balance=E.totals(state,c).available;
 const exp=state.entries.filter(e=>e.type==='expense'&&entryCurrency(e)===c&&e.date.startsWith(ym)).reduce((n,e)=>n+e.amount,0);
 const inc=state.entries.filter(e=>E.isIncomeForStats(e)&&entryCurrency(e)===c&&e.date.startsWith(ym)).reduce((n,e)=>n+e.amount,0);
 const hb=hides('balance'),hf=hides('flows');
 // Под балансом — разница за этот месяц: доходы минус расходы с 1-го числа
 const saved=inc-exp,monthName=['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'][new Date().getMonth()];
 const deltaHTML=(inc||exp)?(hb||hf?`<button type="button" class="hd-delta muted" data-hd-explain="saved">••• ₽<small>доходы − расходы</small></button>`:`<button type="button" class="hd-delta ${saved>=0?'up':'down'}" data-hd-explain="saved">${saved>=0?'+':'−'}${money(Math.abs(saved),c)}<small>${saved>=0?'доходы − расходы':'расходы выше доходов'}</small></button>`):'';
 return `<div class="hd-top"><div class="hd-label">Общий баланс <button type="button" class="hd-eye" data-hd-eye aria-pressed="${hidden}" aria-label="${hidden?'Показать суммы':'Скрыть суммы'}">${hidden?ico.eyeOff:ico.eye}</button></div>
 <div class="hd-balance">${hb?MASK:money(balance,c)}</div>${deltaHTML}</div>
 <div class="hd-row"><button type="button" class="hd-card hd-flow" data-hd-go="expense"><span class="hd-flow-top"><span class="hd-ic out">${ico.down}</span>Расходы</span><b>${hf?MASK:money(exp,c)}</b></button>
 <button type="button" class="hd-card hd-flow" data-hd-go="income"><span class="hd-flow-top"><span class="hd-ic in">${ico.up}</span>Доходы</span><b>${hf?MASK:money(inc,c)}</b></button></div>
`;
}

function render(){
 const home=document.querySelector('#home');if(!home||typeof state!=='object')return;
 const dash=cfg().mode!=='classic';
 home.classList.toggle('home-dash',dash);
 let box=home.querySelector('.hd');
 if(!dash){box?.remove();return;}
 if(!box){box=document.createElement('section');box.className='hd';home.querySelector('.intro').after(box);}
 box.innerHTML=html();
}

function explain(){
 const c=cur();
  const ym=E.dateString(new Date()).slice(0,7),sum=t=>state.entries.filter(e=>e.type===t&&(t!=='income'||E.isIncomeForStats(e))&&entryCurrency(e)===c&&e.date.startsWith(ym)).reduce((n,e)=>n+e.amount,0);
  const inc=sum('income'),exp=sum('expense'),d=inc-exp,mask=hides('balance')||hides('flows'),m=v=>mask?MASK:money(v,c);
  actionDialog(d>=0?'Отложено в этом месяце':'Расходы больше доходов',`<div class="hd-explain"><p class="muted">Доходы минус расходы с 1-го числа этого месяца.</p>
  <ul><li><span>Доходы</span><b>${m(inc)}</b></li><li><span>Расходы</span><b>−${m(exp)}</b></li><li class="sum${d<0?' over':''}"><span>${d>=0?'Отложено':'Не хватило'}</span><b>${d<0?'−':''}${m(Math.abs(d))}</b></li></ul>
  <p class="muted tiny">${d>=0?'Столько осталось от заработанного в этом месяце.':'В этом месяце потрачено больше, чем пришло, — разница взята из денег, которые были раньше.'} Переводы между счетами и пополнения целей не считаются.</p></div>`);
}

document.addEventListener('click',e=>{
 const day=e.target.closest('[data-day-expense]');if(day){const date=new Date(day.dataset.dayExpense+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}).replace(/ г\.$/,'');notify('Сумма расходов за '+date+' года. Доходы и переводы не включены.');return;}
 const eye=e.target.closest('[data-hd-eye]');if(eye){hidden=!hidden;render();return;}
 const go=e.target.closest('[data-hd-go]');if(go){const type=go.dataset.hdGo;navigate('history');setTimeout(()=>document.querySelector(`[data-operation="${type}"]`)?.click(),reducedMotion()?0:520);return;}
 const ex=e.target.closest('[data-hd-explain]');if(ex){explain();return;}
 const smart=e.target.closest('[data-smart-goal]');if(smart){const id=smart.dataset.smartGoal;let name='';
  if(commit(s=>{const g=s.goals.find(g=>g.id===id);if(g){g.smart=!g.smart;name=g.name;if(!g.smart)delete g.smart;}}))
   notify(state.goals.find(g=>g.id===id)?.smart?`Умная цель: буду подсказывать, как накопить на «${name}» быстрее`:'Подсказки для цели выключены',true);
  return;}
});

// Обновляем при любых изменениях данных и при возвращении в приложение (мог смениться день)
const origPersist=root.persist;
if(typeof origPersist==='function'){root.persist=function(...args){const ok=origPersist.apply(this,args);if(ok)queueMicrotask(render);return ok;};}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});

// Итоги для «Операций»: при каждом запуске — другая подсказка
let launchNo=0;try{launchNo=(Number(localStorage.getItem('mono-launch-no'))||0)+1;localStorage.setItem('mono-launch-no',String(launchNo));}catch{}
function summaryHTML(currency){
 const list=I().insights(currency);if(!list.length)return '';
 const item=list[launchNo%Math.min(list.length,5)];
 return `<div class="ops-summary ${item.kind}"><small>Итоги</small><span>${esc(item.text)}</span></div>`;
}

// Умная цель и план к сроку — под карточкой цели
function goalExtras(g){
 const saved=E.goalBalance(state,g.id),plan=I().goalPlan(g.target,saved,g.deadline,g.currency);let out='';
 if(plan)out+=`<p class="goal-plan">${esc(plan.text)}</p>`;
 if(g.smart){const tip=I().goalTip(g);out+=`<p class="goal-tip"><b>✦ Умная цель.</b> Буду подсказывать, как накопить быстрее. ${esc(tip.text)}</p>`;}
 return out;
}

(()=>{const box=document.querySelector('#homeReminders'),home=document.querySelector('#home');if(!box||!home)return;const sync=()=>home.classList.toggle('has-rem',!!box.querySelector('.reminder'));new MutationObserver(sync).observe(box,{childList:true,subtree:true});sync();})();
root.MonoHome={render,summaryHTML,goalExtras,isHidden:()=>hidden};
render();
})(window);
