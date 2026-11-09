(function(){
 'use strict';
 const key='mono-reminders-seen';
 let seen={};
 try{seen=JSON.parse(localStorage.getItem(key))||{};}catch{}
 function check(){
  if(document.hidden||document.body.classList.contains('offscreen-locked')||holding||listening||tourActive||document.querySelector('dialog[open]'))return;
  const now=new Date(),date=E.dateString(now),time=now.toTimeString().slice(0,5);
  const due=MonoSchedule.remindersOn(state,date).map(({payment,lead,due,time})=>({
   id:payment.id+'|'+due+'|'+date,time,
   message:(lead?'Через '+lead+' дн.: ':'Сегодня: ')+payment.name+' · '+money(payment.amount,account(payment.account).currency)
  }));
  for(const r of state.reminders||[]){
   if(r.date===date)due.push({id:'personal:'+r.id+'|'+date+'|'+r.time,time:r.time,message:r.name});
  }
  const unread=due.filter(item=>item.time<=time&&!seen[item.id]);
  if(!unread.length)return;
  for(const item of unread)seen[item.id]=date;
  seen=Object.fromEntries(Object.entries(seen).sort((a,b)=>b[1].localeCompare(a[1])).slice(0,250));
  try{localStorage.setItem(key,JSON.stringify(seen));}catch{}
  notify(unread.map(item=>item.message).join('. '));
 }
 setInterval(check,15000);
 document.addEventListener('visibilitychange',check);
})();
