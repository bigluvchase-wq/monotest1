(function(root){
'use strict';
// Главный экран: общий баланс с «глазом», расходы и доходы месяца, «Можно потратить сегодня» и прогноз (свайп).
// Вид и скрытие сумм настраиваются в «Настройки → Главный экран». Классический вид — фраза «Просто скажи, сколько».
const I=()=>root.MonoInsights;
const cfg=()=>({mode:'dash',hideScope:'all',hideOnStart:false,...(state.settings.home||{})});
let hidden=cfg().hideOnStart===true,slide=0;
const cur=()=>state.accounts.some(a=>a.currency==='RUB')?'RUB':state.accounts[0].currency;
const plural=(n,a,b,c)=>{const m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<10||h>=20)?b:c;};
const dateText=s=>new Date(s+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
const MASK='••••• ₽';
const ico={
 eye:'<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
 eyeOff:'<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
 down:'<svg viewBox="0 0 24 24"><path d="M17 7 7 17M15 17H7V9"/></svg>',
 up:'<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg>',
 info:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
};
function hides(part){if(!hidden)return false;const s=cfg().hideScope;return s==='all'||s===part;}

function html(){
 const c=cur(),t=E.dateString(new Date()),ym=t.slice(0,7);
 const balance=E.totals(state,c).available;
 const exp=state.entries.filter(e=>e.type==='expense'&&entryCurrency(e)===c&&e.date.startsWith(ym)).reduce((n,e)=>n+e.amount,0);
 const inc=state.entries.filter(e=>e.type==='income'&&entryCurrency(e)===c&&e.date.startsWith(ym)).reduce((n,e)=>n+e.amount,0);
 const s=I().safeToSpend(c),f=I().forecast(c),over=s.left<0;
 const hb=hides('balance'),hf=hides('flows');
 // Под балансом — сколько отложено в этом месяце: доходы минус расходы с 1-го числа
 const saved=inc-exp,monthName=['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'][new Date().getMonth()];
 const deltaHTML=(inc||exp)?(hb||hf?`<div class="hd-delta muted">••• ₽<small>отложено в ${monthName}</small></div>`:`<div class="hd-delta ${saved>=0?'up':'down'}">${saved>=0?'+':'−'}${money(Math.abs(saved),c)}<small>${saved>=0?'отложено':'больше, чем заработано'} в ${monthName}</small></div>`):'';
 return `<div class="hd-top"><div class="hd-label">Общий баланс <button type="button" class="hd-eye" data-hd-eye aria-pressed="${hidden}" aria-label="${hidden?'Показать суммы':'Скрыть суммы'}">${hidden?ico.eyeOff:ico.eye}</button></div>
 <div class="hd-balance">${hb?MASK:money(balance,c)}</div>${deltaHTML}</div>
 <div class="hd-row"><button type="button" class="hd-card hd-flow" data-hd-go="expense"><span class="hd-flow-top"><span class="hd-ic out">${ico.down}</span>Расходы</span><b>${hf?MASK:money(exp,c)}</b></button>
 <button type="button" class="hd-card hd-flow" data-hd-go="income"><span class="hd-flow-top"><span class="hd-ic in">${ico.up}</span>Доходы</span><b>${hf?MASK:money(inc,c)}</b></button></div>
 <div class="hd-pager" data-hd-pager><div class="hd-track">
  <button type="button" class="hd-card hd-today${over?' over':''}" data-hd-explain="today"><span class="l">Можно потратить сегодня <i>${ico.info}</i><b>${over?'−'+money(-s.left,c):money(s.left,c)}</b></span><span class="r">до ${dateText(s.horizon)}<br>${s.days} ${plural(s.days,'день','дня','дней')}<span class="hd-bar"><i style="width:${s.norm?Math.max(0,Math.min(100,s.left/s.norm*100)):0}%"></i></span></span></button>
  <button type="button" class="hd-card hd-forecast" data-hd-explain="forecast"><span class="l">Прогноз через месяц <i>${ico.info}</i><b>${money(f.month.value,c)}</b></span><span class="r">через неделю<br><em>${money(f.week.value,c)}</em></span></button>
 </div></div><div class="hd-dots" aria-hidden="true"><i class="${slide===0?'on':''}"></i><i class="${slide===1?'on':''}"></i></div>`;
}

function render(){
 const home=document.querySelector('#home');if(!home||typeof state!=='object')return;
 const dash=cfg().mode!=='classic';
 home.classList.toggle('home-dash',dash);
 let box=home.querySelector('.hd');
 if(!dash){box?.remove();return;}
 if(!box){box=document.createElement('section');box.className='hd';home.querySelector('.intro').after(box);}
 box.innerHTML=html();
 const pager=box.querySelector('[data-hd-pager]');
 const cards=[...pager.querySelectorAll('.hd-track>.hd-card')],stepW=()=>cards[1].offsetLeft-cards[0].offsetLeft||pager.clientWidth;
 const paint=()=>{const x=pager.scrollLeft/Math.max(1,stepW());cards.forEach((c,k)=>{const d=Math.min(1,Math.abs(k-x));c.style.transform=`scale(${(1-.06*d).toFixed(3)})`;c.style.opacity=(1-.38*d).toFixed(3);});const i=Math.round(x);if(i!==slide){slide=i;box.querySelectorAll('.hd-dots i').forEach((dot,k)=>dot.classList.toggle('on',k===i));}};
 pager.scrollLeft=slide*stepW();paint();
 pager.onscroll=()=>requestAnimationFrame(paint);
}

function explain(kind){
 const c=cur();
 if(kind==='today'){
  const s=I().safeToSpend(c);
  const pays=s.payments.length?s.payments.map(p=>`<li><span>${esc(p.name)} · ${dateText(p.due)}</span><b>−${money(p.amount,c)}</b></li>`).join(''):'<li><span>Обязательных платежей до этой даты нет</span><b>0 ₽</b></li>';
  actionDialog('Можно потратить сегодня',`<div class="hd-explain"><p class="muted">Считаем только по деньгам, которые уже есть. Будущие доходы не учитываем, пока они не пришли, — так сумма не обманет.</p>
  <ul><li><span>На счетах на начало дня</span><b>${money(s.morning,c)}</b></li>${pays}<li class="sum"><span>Свободно до ${dateText(s.horizon)}</span><b>${money(s.free,c)}</b></li>
  <li><span>Делим на ${s.days} ${plural(s.days,'день','дня','дней')}</span><b>${money(s.norm,c)} в день</b></li><li><span>Уже потрачено сегодня</span><b>−${money(s.spentToday,c)}</b></li>
  <li class="sum${s.left<0?' over':''}"><span>Можно потратить сегодня</span><b>${s.left<0?'−':''}${money(Math.abs(s.left),c)}</b></li></ul>
  <p class="muted tiny">${s.byIncome?`${dateText(s.horizon)} — следующее поступление: по истории вы обычно получаете деньги в эти числа (зарплата, аванс). Подработки и разовые доходы учитываются, когда вы их внесли.`:'Регулярных поступлений пока не видно, поэтому делим до конца месяца. Когда зарплата или аванс придут хотя бы два месяца подряд, начнём считать до следующего поступления.'}</p>
  <p class="muted tiny">Если потратите меньше — завтра сумма будет больше. Если больше — завтрашняя уменьшится.</p></div>`);
 }else{
  const f=I().forecast(c);
  actionDialog('Прогноз',`<div class="hd-explain"><p class="muted">Если тратить так же, как последние ${f.span} ${plural(f.span,'день','дня','дней')}, — в среднем ${money(f.daily,c)} в день, без обязательных платежей.</p>
  <ul><li><span>Сейчас на счетах</span><b>${money(f.balance,c)}</b></li><li><span>Через неделю, ${dateText(f.week.date)}</span><b>${money(f.week.value,c)}</b></li><li><span>Через месяц, ${dateText(f.month.date)}</span><b>${money(f.month.value,c)}</b></li></ul>
  <p class="muted tiny">Обязательные платежи впереди уже вычтены. Будущие доходы не добавляем — это прогноз «если больше ничего не придёт».${f.runsOut!==null&&f.runsOut<60?` При таком темпе денег хватит примерно на ${f.runsOut} ${plural(f.runsOut,'день','дня','дней')}.`:''}</p></div>`);
 }
}

document.addEventListener('click',e=>{
 const day=e.target.closest('[data-day-toggle]');if(day){day.classList.toggle('show-in');return;}
 const eye=e.target.closest('[data-hd-eye]');if(eye){hidden=!hidden;render();return;}
 const go=e.target.closest('[data-hd-go]');if(go){const type=go.dataset.hdGo;navigate('history');setTimeout(()=>document.querySelector(`[data-operation="${type}"]`)?.click(),reducedMotion()?0:520);return;}
 const ex=e.target.closest('[data-hd-explain]');if(ex){explain(ex.dataset.hdExplain);return;}
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
