(function(){
 'use strict';
 const dialog=document.querySelector('#entryInfoDialog'),body=dialog.querySelector('.entry-info-body');
 function show(id){
  const entry=state.entries.find(e=>e.id===id);if(!entry)return;
  const a=account(entry.account),to=account(entry.toAccount),kind={income:'Доход',expense:'Расход',saving:'Накопления',transfer:'Перевод'}[entry.type];
  const date=new Intl.DateTimeFormat(state.settings.language==='en'?'en-US':'ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(entry.date+'T12:00:00'));
  const refund=state.entries.find(e=>e.id===entry.refundOf&&e.type==='expense'&&e.account===entry.account&&e.amount===entry.amount&&e.date<=entry.date);
  const goal=state.goals.find(g=>g.id===entry.goalId),details=[['Тип',kind],['Счёт',a?.name],...(entry.category?[['Категория',entry.category]]:[]),...(goal?[['Цель',goal.name]]:[]),...(to?[['На счёт',to.name],['Зачислено',money(entry.toAmount,to.currency)]]:[]),...(refund?[['Исходный расход',refund.title]]:[]),['Дата операции',date]];
  dialog.querySelector('#entryInfoTitle').textContent=entry.title;
  body.innerHTML=`<div class="entry-info-total ${entry.type==='income'?'positive':''}">${entry.type==='income'?'+':'−'}${money(entry.amount,a.currency)}</div><dl>${details.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
  if(entry.imported===true&&['expense','income'].includes(entry.type)){
   const form=document.createElement('form');form.innerHTML=`<label class="field">Категория<select name="category">${categoryOptions(entry.type,entry.category)}</select></label><p class="muted tiny">Выбранная категория запомнится для этого магазина или описания.</p><button class="primary" type="submit">Сохранить категорию</button>`;
   form.onsubmit=event=>{event.preventDefault();const category=new FormData(form).get('category');const list=entry.type==='income'?state.incomeCategories:state.categories;if(!list.includes(category))return;if(commit(s=>{const current=s.entries.find(e=>e.id===entry.id);if(current){current.category=category;current.categoryChosen=true;window.MonoBankMerchants?.remember(s,current);}},'Категория сохранена'))dialog.close();};body.append(form);
  }
  if(entry.imported===true&&['expense','income'].includes(entry.type)){
   const others=state.accounts.filter(other=>other.id!==entry.account&&other.currency===a.currency);
   const transfer=document.createElement('form');transfer.innerHTML=`<p class="muted">Если это движение своих денег, укажите второй счёт. Запись станет переводом и перестанет входить в доходы и расходы.</p><label class="field">${entry.type==='income'?'С какого своего счёта':'На какой свой счёт'}<select name="counterpart" required><option value="">Выберите счёт</option>${others.map(other=>`<option value="${esc(other.id)}">${esc(other.name)}</option>`).join('')}</select></label><button class="secondary full" type="submit" ${others.length?'':'disabled'}>Это перевод между моими счетами</button>${others.length?'':'<p class="muted tiny">Сначала добавьте второй счёт в той же валюте.</p>'}`;
   transfer.onsubmit=event=>{event.preventDefault();const other=new FormData(transfer).get('counterpart');if(commit(s=>{const current=s.entries.find(e=>e.id===entry.id);if(!current)return;const next=MonoBankImport.rowToEntry({...current,ownTransfer:true},current.account,other,s.accounts);Object.assign(current,next);for(const field of ['category','categoryChosen','refundOf','paymentId','paymentDate'])delete current[field];},'Запись сохранена как перевод'))dialog.close();};body.append(transfer);
  }
  dialog.showModal();
 }
 dialog.querySelector('.entry-info-close').onclick=()=>dialog.close();
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-entry-open]');if(!button||event.defaultPrevented)return;
  const shell=button.closest('.swipe-shell');if(shell?.classList.contains('swipe-open')){MonoSwipe.close(shell);return;}
  show(button.dataset.entryOpen);
 });
})();
