(function(root){
'use strict';
const Engine=typeof module!=='undefined'?require('./engine.js'):root.MonoEngine;
function plan(state,{kind,id,type='expense',currency='RUB'}){
 const next=structuredClone(state);let warning='',label='Запись удалена';
 if(kind==='entry'){
  const entry=next.entries.find(e=>e.id===id);if(!entry)throw Error('Запись уже удалена.');
  warning=`Удалить «${entry.title}»? Остатки и накопления будут пересчитаны.`;
  next.entries=next.entries.filter(e=>e.id!==id);
 }else if(kind==='payment'){
  const p=next.payments.find(p=>p.id===id);if(!p)throw Error('Платёж уже удалён.');
  warning=`Удалить напоминание «${p.name}»? Записанные расходы сохранятся.`;next.payments=next.payments.filter(p=>p.id!==id);label='Платёж удалён';
 }else if(kind==='goal'){
  const g=next.goals.find(g=>g.id===id);if(!g)throw Error('Цель уже удалена.');
  const count=next.entries.filter(e=>e.type==='saving'&&e.goalId===id).length;
  warning=count?`Удалить цель «${g.name}» и ${count} записей пополнения? Все накопления вернутся на исходные счета, без доходов и расходов.`:`Удалить цель «${g.name}»?`;
  next.goals=next.goals.filter(g=>g.id!==id);next.entries=next.entries.filter(e=>!(e.type==='saving'&&e.goalId===id));label='Цель удалена';
 }else if(kind==='category'){
  if(id==='Другое')throw Error('«Другое» — базовая категория для записей без категории.');
  const key=type==='income'?'incomeCategories':'categories';if(!next[key].includes(id))throw Error('Категория уже удалена.');
  warning=`Удалить категорию «${id}»? Её операции${type==='expense'?' и платежи':''} перейдут в «Другое».${type==='expense'?' Лимиты этой категории будут сняты.':''}`;
  next[key]=next[key].filter(c=>c!==id);next.entries.forEach(e=>{if(e.type===type&&e.category===id){e.category='Другое';e.categoryChosen=false;}});
  if(type==='expense'){next.payments.forEach(p=>{if(p.category===id)p.category='Другое';});for(const limits of Object.values(next.limits))delete limits[id];}label='Категория удалена';
 }else if(kind==='limit'){
  if(!next.limits[currency]?.[id])throw Error('Лимит уже снят.');warning=`Снять лимит «${id}» в ${currency}? Категория и операции сохранятся.`;delete next.limits[currency][id];label='Лимит снят';
 }else if(kind==='account'){
  const a=next.accounts.find(a=>a.id===id);if(!a)throw Error('Счёт уже удалён.');if(next.accounts.length===1)throw Error('Оставьте хотя бы один счёт. Сначала добавьте другой.');
  const linked=next.entries.some(e=>e.account===id||e.toAccount===id)||next.payments.some(p=>p.account===id),target=next.accounts.find(x=>x.id!==id&&x.currency===a.currency);
  if(linked&&!target)throw Error(`Для сохранения истории нужен другой счёт в ${a.currency}. Добавьте его, затем удалите этот счёт.`);
  if(target){warning=`Удалить счёт «${a.name}»? Его остаток, операции и платежи перейдут на «${target.name}». Переводы между этими двумя счетами будут объединены.`;target.initial+=a.initial;
   next.entries.forEach(e=>{if(e.account===id)e.account=target.id;if(e.toAccount===id)e.toAccount=target.id;});next.entries=next.entries.filter(e=>!(e.type==='transfer'&&e.account===e.toAccount));next.payments.forEach(p=>{if(p.account===id)p.account=target.id;});
  }else warning=`Удалить пустой счёт «${a.name}» вместе с его начальным остатком?`;
  next.accounts=next.accounts.filter(a=>a.id!==id);label='Счёт удалён';
 }else if(kind==='ticket'){
  const t=next.tickets.find(t=>t.id===id);if(!t)throw Error('Черновик уже удалён.');warning='Удалить черновик обращения с этого устройства?';next.tickets=next.tickets.filter(t=>t.id!==id);label='Черновик удалён';
 }else throw Error('Неизвестный тип записи.');
 if(!Engine.validateState(next))throw Error('Не удалось безопасно удалить запись. Данные не изменены.');
 return {next,warning,label};
}
const api={plan};if(typeof module!=='undefined')module.exports=api;root.MonoDeletion=api;
})(typeof window!=='undefined'?window:globalThis);
