(function(root){
 'use strict';
 let month=currentMonth(),selectedDay=E.dateString(new Date()),expanded=false,allExpanded=false;
 const shortDate=date=>new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
 const fullDate=date=>new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
 const info=document.querySelector('#paymentInfoDialog');
 function paymentButton(item){const p=item.payment;return `<button type="button" class="agenda-payment" data-payment-info="${esc(p.id)}" data-payment-due="${item.due}"><span>${esc(p.name)}${p.bank?`<em class="bank-tag">${esc(p.bank)}</em>`:''}<small>${item.paid?'Оплачено':esc(account(p.account)?.name||'')}</small></span><strong>${money(p.amount,account(p.account).currency)}</strong><span aria-hidden="true">›</span></button>`;}
 function calendar(){
  const items=MonoPaymentDates.occurrences(state,month),period=MonoPeriod.month(month),count=Number(period.end.slice(8)),offset=(new Date(period.start+'T12:00:00').getDay()+6)%7;
  const days=Array.from({length:offset},()=>'<span class="agenda-day-space"></span>');
  for(let n=1;n<=count;n++){
   const date=month+'-'+String(n).padStart(2,'0'),dues=items.filter(item=>item.due===date),today=date===E.dateString(new Date());
   days.push(`<button type="button" class="agenda-day ${date===selectedDay?'selected':''} ${today?'today':''}" data-payment-day="${date}" aria-pressed="${date===selectedDay}" aria-label="${esc(fullDate(date))}${dues.length?', платежей: '+dues.length:''}"><span>${n}</span><i class="agenda-dots">${dues.slice(0,3).map(v=>`<b class="${v.paid?'paid':''}"></b>`).join('')}</i></button>`);
  }
  // платежи на сегодня уже показаны над календарём — под ним их не повторяем
  const isToday=selectedDay===E.dateString(new Date()),dayItems=selectedDay?.startsWith(month)&&!isToday?items.filter(item=>item.due===selectedDay):[];
  return `<div class="agenda-calendar-head"><button class="icon-btn" type="button" data-payment-month="-1" aria-label="Предыдущий месяц календаря">‹</button><strong>${esc(new Date(period.start+'T12:00:00').toLocaleDateString('ru-RU',{month:'long',year:'numeric'}))}</strong><button class="icon-btn" type="button" data-payment-month="1" aria-label="Следующий месяц календаря">›</button></div><div class="agenda-weekdays">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<span>${d}</span>`).join('')}</div><div class="agenda-grid">${days.join('')}</div><div class="agenda-day-details" ${isToday?'hidden':''}>${selectedDay?.startsWith(month)&&!isToday?`<p class="agenda-selected-date">${esc(shortDate(selectedDay))}</p>${dayItems.map(paymentButton).join('')||'<p class="muted tiny">Нет платежей</p>'}`:''}</div>`;
 }
 function agenda(){
  const today=E.dateString(new Date()),items=MonoPaymentDates.onDate(state,today),pending=items.filter(v=>!v.paid).length;
  const status=!items.length?'Нет платежей':!pending?'Все платежи оплачены':pending===1?'Есть обязательный платёж':'Есть обязательные платежи';
  return `<section class="card payments-agenda ${expanded?'is-open':''}"><button type="button" class="agenda-toggle" aria-expanded="${expanded}" aria-controls="paymentCalendar"><span><strong>${esc(shortDate(today))}</strong><small>${status}</small></span><span class="agenda-chevron agenda-cal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M8 3v4m8-4v4M3.5 10h17M8 14h2m4 0h2M8 17.2h2"/></svg></span></button>${items.length?`<div class="agenda-today">${items.map(paymentButton).join('')}</div>`:''}<div class="agenda-calendar-reveal" id="paymentCalendar" ${expanded?'':'inert'} aria-hidden="${!expanded}"><div class="agenda-calendar-inner">${calendar()}</div></div></section>`;
 }
 function refreshCalendar(){const inner=document.querySelector('.agenda-calendar-inner');if(inner)inner.innerHTML=calendar();}
 function toggle(){
  expanded=!expanded;const card=document.querySelector('.payments-agenda'),reveal=card.querySelector('.agenda-calendar-reveal');
  card.classList.toggle('is-open',expanded);card.querySelector('.agenda-toggle').setAttribute('aria-expanded',String(expanded));reveal.inert=!expanded;reveal.setAttribute('aria-hidden',String(!expanded));
 }
 function list(){
  const today=E.dateString(new Date()),upcoming=MonoPaymentDates.upcoming(state,today),items=allExpanded?state.payments.map(p=>{const next=MonoPaymentDates.nextUnpaid(state,p,today);return next||{payment:p,due:E.nextPayment(p),paid:true};}).sort((a,b)=>a.due.localeCompare(b.due)):upcoming.slice(0,3);
  const html=items.map(({payment:p,due,paid})=>`<div class="card payment-summary-card" data-payment-record="${esc(p.id)}"><button type="button" class="payment-summary" data-payment-info="${esc(p.id)}" data-payment-due="${due}"><span>${esc(p.name)}${p.bank?`<em class="bank-tag">${esc(p.bank)}</em>`:''}</span><span>${money(p.amount,account(p.account).currency)}</span><small>${shortDate(due)}${paid?' · Оплачено':''}</small><small>${esc(account(p.account).name)}</small></button></div>`).join('')||'<p class="muted">Нет ближайших платежей</p>';
  return html+(state.payments.length>items.length||allExpanded?`<button class="secondary full" type="button" data-payments-all>${allExpanded?'Свернуть':'Показать все платежи'}</button>`:'');
 }
 function show(id,due,options={}){
  const p=state.payments.find(p=>p.id===id);if(!p)return;due=due||E.nextPayment(p);const paid=paymentPaid(p,due);
  info.querySelector('#paymentInfoTitle').textContent=p.name;if(p.bank){const t=document.createElement('em');t.className='bank-tag';t.textContent=p.bank;info.querySelector('#paymentInfoTitle').append(t);}
  info.querySelector('.payment-info-body').innerHTML=`<div class="entry-info-total">${money(p.amount,account(p.account).currency)}</div><dl><div><dt>Дата</dt><dd>${esc(fullDate(due))}</dd></div><div><dt>Счёт</dt><dd>${esc(account(p.account).name)}</dd></div><div><dt>Категория</dt><dd>${esc(p.category)}</dd></div><div><dt>Повтор</dt><dd>${MonoSchedule.label[p.repeat]}</dd></div><div><dt>Напоминание</dt><dd>${MonoSchedule.time(p)}${p.remindDays?' · за '+p.remindDays+' дн.':''}</dd></div></dl><div class="action-row"><button type="button" class="secondary ${paid?'payment-is-paid':''}" ${paid?'disabled':''} ${options.home?`data-info-paid="${esc(p.id)}"`:`data-info-pay="${esc(p.id)}"`} data-info-due="${due}">${paid?'Оплачено':options.home?'Оплатил':'Записать расход'}</button>${options.home?'':`<button type="button" class="secondary" data-info-edit="${esc(p.id)}">Изменить</button><button type="button" class="secondary" data-info-delete="${esc(p.id)}">Удалить</button>`}</div>`;
  if(!info.open)info.showModal();
 }
 document.addEventListener('click',event=>{
  if(page!=='payments')return;const target=event.target;
  const p=target.closest('[data-payment-info]');if(p){show(p.dataset.paymentInfo,p.dataset.paymentDue);return;}
  if(target.closest('[data-payments-all]')){allExpanded=!allExpanded;render();return;}
  const day=target.closest('[data-payment-day]');if(day){selectedDay=day.dataset.paymentDay;refreshCalendar();return;}
  const nav=target.closest('[data-payment-month]');if(nav){try{month=MonoPeriod.shift(month,Number(nav.dataset.paymentMonth));selectedDay=null;refreshCalendar();}catch(e){notify(e.message);}return;}
  if(target.closest('.agenda-toggle')||(target.closest('.payments-agenda')&&!target.closest('button,.agenda-calendar-reveal')))toggle();
 });
 info.querySelector('.payment-info-close').onclick=()=>info.close();
 info.addEventListener('click',event=>{
  const edit=event.target.closest('[data-info-edit]'),pay=event.target.closest('[data-info-pay]'),paid=event.target.closest('[data-info-paid]'),remove=event.target.closest('[data-info-delete]');
  if(edit){info.close();paymentForm(edit.dataset.infoEdit);}
  if(pay){info.close();payForm(pay.dataset.infoPay,pay.dataset.infoDue);}
  if(remove){info.close();MonoDeleteUI.remove({kind:'payment',id:remove.dataset.infoDelete});}
  if(paid){const p=state.payments.find(p=>p.id===paid.dataset.infoPaid),due=paid.dataset.infoDue;if(!p||paymentPaid(p,due))return;paid.disabled=true;const today=E.dateString(new Date());if(due!==today||!MonoPaymentDates.isDue(p,due)){paid.disabled=false;notify('Дата платежа изменилась.');return;}if(commit(s=>s.entries.push({id:uid(),title:p.name,type:'expense',category:p.category,amount:p.amount,account:p.account,date:today,paymentId:p.id,paymentDate:due,createdAt:new Date().toISOString()}),'Платёж записан'))show(p.id,due,{home:true});else paid.disabled=false;}
 });
 root.MonoPayments={agenda,list,show,selectedDate:()=>selectedDay||E.dateString(new Date())};
})(window);
