(function(root){
 'use strict';
 const today=()=>E.dateString(new Date());
 const dateTime=r=>fmtDate(r.date)+' · '+r.time;
 function deposits(){
  const posted=new Map();
  for(const e of state.entries){
   const id=e.id.startsWith('deposit:')?e.id.slice(8,-11):null;
   if(id)posted.set(id,(posted.get(id)||0)+e.amount);
  }
  return '<div class="section-row"><button type="button" class="secondary" data-new-deposit>+ Добавить вклад</button></div>'+
   ((state.deposits||[]).map(d=>`<article class="card finance-card"><h3>${esc(d.name)}</h3><p>${money(d.principal,account(d.account).currency)} · ${d.rate/100}% годовых</p><p class="muted">${fmtDate(d.start)} — ${fmtDate(d.end)} · ${d.frequency==='daily'?'Ежедневно':'Ежемесячно'}</p><p class="muted">Начислено ${money(posted.get(d.id)||0,account(d.account).currency)} из ${money(MonoFinanceTools.earned(d,d.end),account(d.account).currency)}</p><button type="button" class="secondary" data-remove-deposit="${esc(d.id)}">Удалить вклад</button></article>`).join('')||empty('Пока нет вкладов','Добавьте вклад, чтобы учитывать проценты.',false));
 }
 function reminders(){
  return '<div class="section-row"><button type="button" class="secondary" data-reminder-edit>+ Напоминание</button></div>'+
   (root.MonoNative?'<button class="secondary" type="button" data-reminder-permission>Разрешить уведомления</button>':'<p class="muted">Уведомления доступны в приложении для iPhone.</p>')+
   ([...(state.reminders||[])].sort((a,b)=>dateTimeKey(a).localeCompare(dateTimeKey(b))).map(r=>`<article class="card finance-card"><button type="button" class="finance-record" data-reminder-edit="${esc(r.id)}"><strong>${esc(r.name)}</strong><small>${dateTime(r)}</small></button><button type="button" class="secondary" data-reminder-remove="${esc(r.id)}">Удалить</button></article>`).join('')||empty('Пока нет напоминаний','Можно сказать: «Напомни заплатить за VPN через два часа».',false));
 }
 const dateTimeKey=r=>r.date+'T'+r.time;
 function depositForm(){
  actionDialog('Новый вклад',`<form class="payment-form"><label class="field">Название<input name="name" required maxlength="100"></label><label class="field">Счёт для процентов<select name="account">${accountOptions(voiceAccount)}</select></label><div class="form-grid"><label class="field">Сумма вклада<input name="principal" required type="number" min=".01" max="10000000000" step=".01"></label><label class="field">Годовая ставка, %<input name="rate" required type="number" min=".01" max="1000" step=".01"></label></div><label class="field">Начало<input name="start" type="date" required value="${today()}"></label><label class="field">Срок<select name="term"><option value="1">1 месяц</option><option value="6">Полгода</option><option value="12">Год</option><option value="custom">Своя дата</option></select></label><label class="field">Дата окончания<input name="end" type="date" required></label><label class="field">Начислять<select name="frequency"><option value="daily">Каждый день</option><option value="monthly">Раз в месяц</option></select></label><p class="muted tiny">Простые проценты без капитализации. Расчёт по фактическим дням из 365. Начисления добавляются при открытии Моно.</p><p class="form-error" role="alert" hidden></p><button class="primary">Сохранить вклад</button></form>`,f=>{
   const d={id:uid(),name:f.get('name').trim(),account:f.get('account'),principal:cents(f.get('principal')),rate:cents(f.get('rate')),start:f.get('start'),end:f.get('end'),frequency:f.get('frequency'),posted:0};
   if(!MonoFinanceTools.valid({...state,deposits:[d]}))throw Error('Проверьте ставку, сумму и срок вклада.');
   if(commit(s=>{(s.deposits??=[]).push(d);},'Вклад сохранён')){$('#actionDialog').close();catchUp();}
  });
  const fields=$('#actionBody form').elements;
  const update=()=>{fields.end.readOnly=fields.term.value!=='custom';if(fields.end.readOnly&&MonoPeriod.validDate(fields.start.value)){try{fields.end.value=MonoFinanceTools.anniversary(fields.start.value,Number(fields.term.value));}catch{fields.end.value='';}}};
  fields.term.onchange=update;fields.start.onchange=update;update();
 }
 function reminderForm(id,draft={}){
  const old=(state.reminders||[]).find(r=>r.id===id),r=old||draft;
  actionDialog(old?'Напоминание':'Новое напоминание',`<form class="payment-form"><label class="field">О чём напомнить<input name="name" required maxlength="300" value="${esc(r.name||'')}"></label><div class="form-grid"><label class="field">Дата<input name="date" type="date" required value="${esc(r.date||MonoPeriod.dateAfter(today(),1))}"></label><label class="field">Время<input name="time" type="time" value="${esc(r.time||'00:00')}"></label></div><p class="form-error" role="alert" hidden></p><button class="primary">Сохранить</button></form>`,f=>{
   const value={id:old?.id||uid(),name:f.get('name').trim(),date:f.get('date'),time:f.get('time')||'00:00'};
   if(!MonoFinanceTools.valid({...state,reminders:[value]}))throw Error('Проверьте название, дату и время.');
   if(!old&&new Date(dateTimeKey(value))<=new Date())throw Error('Выберите время в будущем.');
   if(commit(s=>{const all=s.reminders??=[];if(old)all[all.findIndex(x=>x.id===id)]=value;else all.push(value);},'Напоминание сохранено')){
    $('#actionDialog').close();
    if(!old&&root.MonoNative&&!state.settings.reminderPermissionAsked){
     if(persist({...state,settings:{...state.settings,reminderPermissionAsked:true}}))root.MonoNative.enableReminders();
    }
   }
  });
 }
 function catchUp(){
  const next=MonoFinanceTools.accrue(state,today());
  if(next&&persist(next)){
   if(page!=='home')render();
   root.MonoCharts?.refresh();
  }
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-new-deposit'))depositForm();
  if(b.hasAttribute('data-reminder-permission'))root.MonoNative?.enableReminders();
  if(b.hasAttribute('data-reminder-edit'))reminderForm(b.dataset.reminderEdit);
  if(b.dataset.removeDeposit&&confirm('Удалить вклад и остановить будущие начисления? Уже записанные проценты сохранятся.')){
   commit(s=>{s.deposits=s.deposits.filter(d=>d.id!==b.dataset.removeDeposit);},'Вклад удалён');
  }
  if(b.dataset.reminderRemove&&confirm('Удалить напоминание?')){
   commit(s=>{s.reminders=s.reminders.filter(r=>r.id!==b.dataset.reminderRemove);},'Напоминание удалено');
  }
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)catchUp();});
 root.MonoFinanceUI={deposits,reminders,reminderForm,catchUp};
 catchUp();
})(window);
