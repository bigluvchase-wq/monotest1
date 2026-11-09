(function(root){
 'use strict';
 const sections={accounts:'Счета',goals:'Цели',limits:'Лимиты',payments:'Платежи'};
 function explain(text){actionDialog('Уточните команду',`<p class="muted">${esc(text)}</p>`);}
 function confirmAction(title,details,callback){
  actionDialog(title,`<form><p>${esc(details)}</p><button class="primary">Подтвердить</button></form>`,()=>{callback();$('#actionDialog').close();});
 }
 function limitForm(command){
  if(!requireAccess('limits'))return;
  const currency=command.currency||selectedCurrency;
  const {bulk,category,amount}=command;
  const existing=state.limits[currency]||{};
  if(command.action==='remove'){
   if(!bulk&&!category){explain('Назовите категорию лимита.');return;}
   confirmAction(bulk?'Отключить все лимиты?':'Удалить лимит?',bulk?`${Object.keys(existing).length} категорий · ${currency}`:`${category} · ${currency}`,()=>{
    commit(s=>{if(bulk)s.limits[currency]={};else if(s.limits[currency])delete s.limits[currency][category];},'Лимиты обновлены');
   });return;
  }
  actionDialog(bulk?'Лимиты для всех категорий':'Месячный лимит',`<form>${bulk?`<p class="muted">Категорий: ${state.categories.length}. Новый лимит заменит текущие значения в ${currency}.</p>`:`<label class="field">Категория<select name="category" required><option value="">Выберите категорию</option>${categoryOptions('expense',category)}</select></label>`}<label class="field">Лимит, ${currency}<input name="amount" type="number" required min=".01" step=".01" max="10000000000" value="${amount?amount/100:category&&existing[category]?existing[category]/100:''}"></label><button class="primary">Подтвердить</button></form>`,f=>{
   if(commit(s=>{const limits=s.limits[currency]??={};for(const c of bulk?s.categories:[f.get('category')])limits[c]=cents(f.get('amount'));},'Лимиты сохранены'))$('#actionDialog').close();
  });
 }
 const norm=E.normalizeTitle;
 function findRecord(items,subject){
  const query=' '+norm(subject)+' ';
  const matches=items.filter(item=>query.includes(' '+norm(item.name)+' ')).sort((a,b)=>b.name.length-a.name.length);
  return matches.length&&(!matches[1]||matches[0].name.length>matches[1].name.length)?matches[0]:null;
 }
 function execute(c){
  if(c.action==='clarify'){explain('Это месячный лимит или план? Для лимита скажите «Установи лимит на кофе».');return true;}
  navigate(c.kind,{noPageMotion:true});
  if(c.action==='open')return true;
  if(c.kind==='reminders'){MonoFinanceUI.reminderForm(undefined,c);return true;}
  if(c.kind==='limits'){limitForm(c);return true;}
  if(c.action==='create'){
   if(c.kind==='accounts')accountForm(undefined,c);
   if(c.kind==='goals')goalForm(undefined,c);
   if(c.kind==='payments'){
    const match=state.accounts.find(a=>a.currency===c.currency);
    if(c.currency&&!match){explain('Сначала добавьте счёт в '+c.currency+', затем повторите команду.');return true;}
    paymentForm(undefined,{...c,account:match?.id});
   }
   return true;
  }
  const list=state[c.kind];
  if(c.kind==='accounts'&&/валют/u.test(c.phrase)){
   explain('Валюта существующего счёта фиксирована. Можно создать отдельный счёт в нужной валюте.');return true;
  }
  if(c.action==='lead'&&!c.subject){
   if(!list.length){explain('Сначала добавьте обязательный платёж.');return true;}
   actionDialog('Для какого платежа?',`<form><label class="field">Платёж<select name="payment">${list.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><button class="primary">Продолжить</button></form>`,f=>paymentForm(f.get('payment'),c));
   return true;
  }
  const record=findRecord(list,c.subject);
  if(!record){explain('Назовите точное название записи в разделе «'+sections[c.kind]+'».');return true;}
  if(c.action==='remove'){
   if(c.kind==='payments')MonoDeleteUI.remove({kind:'payment',id:record.id});
   else if(c.kind==='goals')MonoDeleteUI.remove({kind:'goal',id:record.id});
   else explain('Откройте счёт, чтобы проверить его операции и остаток.');
  }else if(c.action==='mute'){
   confirmAction('Отключить уведомления?',record.name,()=>commit(s=>{s.payments.find(p=>p.id===record.id).remindersDisabled=true;},'Уведомления отключены'));
  }else if(c.kind==='accounts'){
   const name=c.subject.match(/\s+в\s+(.+)$/u)?.[1]||'';
   accountForm(record.id,{name:name?name[0].toUpperCase()+name.slice(1):''});
  }else if(c.kind==='goals')goalForm(record.id,c);
  else paymentForm(record.id,c);
  return true;
 }
 function handle(text){
  const command=MonoVoiceCommands.parse(text,state);
  if(!command)return false;
  const handled=execute(command);
  const body=$('#actionBody');
  if(handled&&$('#actionDialog').open&&body.querySelector('form')){
   const note=document.createElement('p');
   note.className='muted tiny';
   note.textContent='Распознано · '+text;
   body.prepend(note);
  }
  return handled;
 }
 root.MonoVoiceCommandUI={handle};
})(window);
