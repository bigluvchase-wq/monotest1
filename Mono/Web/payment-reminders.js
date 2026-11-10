(function(){
'use strict';
let seen={};try{seen=JSON.parse(localStorage.getItem('mono-reminders-seen'))||{};}catch{}
function check(){if(state.settings.notifications?.payments===false||document.hidden||document.body.classList.contains('offscreen-locked')||holding||listening||tourActive||document.querySelector('dialog[open]'))return;const now=new Date(),date=E.dateString(now),time=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),items=MonoSchedule.remindersOn(state,date).filter(item=>item.time<=time&&!seen[item.payment.id+'|'+item.due+'|'+date]);if(!items.length)return;items.forEach(item=>seen[item.payment.id+'|'+item.due+'|'+date]=date);seen=Object.fromEntries(Object.entries(seen).sort((a,b)=>b[1].localeCompare(a[1])).slice(0,250));try{localStorage.setItem('mono-reminders-seen',JSON.stringify(seen));}catch{}notify(items.map(({payment:p,lead})=>(lead?'Через '+lead+' дн.: ':'Сегодня: ')+p.name+' · '+money(p.amount,account(p.account).currency)).join('. '));}
setInterval(check,15000);document.addEventListener('visibilitychange',check);
})();
