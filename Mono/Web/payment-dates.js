(function(root){
'use strict';
const S=typeof module==='object'?require('./schedule.js'):root.MonoSchedule;
const dueInMonth=(payment,month)=>S.datesInMonth(payment,month)[0]||null;
function occurrences(state,month){return state.payments.flatMap(payment=>S.datesInMonth(payment,month).map(due=>({payment,due,paid:state.entries.some(e=>e.paymentId===payment.id&&e.paymentDate===due)}))).sort((a,b)=>a.due.localeCompare(b.due)||a.payment.name.localeCompare(b.payment.name));}
const onDate=(state,date)=>occurrences(state,date.slice(0,7)).filter(item=>item.due===date);
function nextUnpaid(state,p,today){const paid=due=>state.entries.some(e=>e.paymentId===p.id&&e.paymentDate===due);if(p.repeat==='once')return paid(p.date)?null:{payment:p,due:p.date,paid:false};let due=S.next(p,today);for(let i=0;i<=state.entries.length;i++){if(!paid(due))return {payment:p,due,paid:false};due=S.next(p,S.addDays(due,1));}return null;}
const upcoming=(state,today)=>state.payments.map(p=>nextUnpaid(state,p,today)).filter(Boolean).sort((a,b)=>a.due.localeCompare(b.due)||a.payment.name.localeCompare(b.payment.name));
const api={dueInMonth,occurrences,onDate,nextUnpaid,upcoming,isDue:S.isDue};root.MonoPaymentDates=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
