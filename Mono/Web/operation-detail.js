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
  dialog.showModal();
 }
 dialog.querySelector('.entry-info-close').onclick=()=>dialog.close();
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-entry-open]');if(!button||event.defaultPrevented)return;
  const shell=button.closest('.swipe-shell');if(shell?.classList.contains('swipe-open')){MonoSwipe.close(shell);return;}
  show(button.dataset.entryOpen);
 });
})();
