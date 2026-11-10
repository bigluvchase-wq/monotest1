(function(root){
'use strict';
const intervals={daily:1,weekly:7,fortnightly:14};
const label={once:'Один раз',daily:'Каждый день',weekly:'Каждую неделю',fortnightly:'Каждые две недели',monthly:'Каждый месяц'};
const dayNumber=s=>{const [y,m,d]=s.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000);};
const fromNumber=n=>new Date(n*86400000).toISOString().slice(0,10);
const addDays=(date,n)=>fromNumber(dayNumber(date)+n);
function monthly(p,month){if(month<p.date.slice(0,7))return null;const [y,m]=month.split('-').map(Number),day=Math.min(Number(p.date.slice(8)),new Date(Date.UTC(y,m,0)).getUTCDate()),due=month+'-'+String(day).padStart(2,'0');return due>=p.date?due:null;}
function datesInMonth(p,month){const [y,m]=month.split('-').map(Number),start=month+'-01',end=month+'-'+new Date(Date.UTC(y,m,0)).getUTCDate();if(p.repeat==='once')return p.date>=start&&p.date<=end?[p.date]:[];if(p.repeat==='monthly'){const due=monthly(p,month);return due?[due]:[];}const interval=intervals[p.repeat];if(!interval)return [];const origin=dayNumber(p.date),first=Math.max(origin,origin+Math.ceil((dayNumber(start)-origin)/interval)*interval),last=dayNumber(end),dates=[];for(let d=first;d<=last;d+=interval)dates.push(fromNumber(d));return dates;}
function isDue(p,date){if(date<p.date)return false;if(p.repeat==='once')return date===p.date;if(p.repeat==='monthly')return monthly(p,date.slice(0,7))===date;const interval=intervals[p.repeat];return !!interval&&(dayNumber(date)-dayNumber(p.date))%interval===0;}
function next(p,today){if(p.repeat==='once'||p.date>=today)return p.date;const interval=intervals[p.repeat];if(interval)return addDays(p.date,Math.ceil((dayNumber(today)-dayNumber(p.date))/interval)*interval);let month=today.slice(0,7),due=monthly(p,month);if(due<today){const [y,m]=month.split('-').map(Number);month=new Date(Date.UTC(y,m,1)).toISOString().slice(0,7);due=monthly(p,month);}return due;}
function time(p){return /^([01]\d|2[0-3]):[0-5]\d$/.test(p.reminderTime||'')?p.reminderTime:'09:00';}
// За сколько дней до платежа напоминать: зависит от режима повтора напоминаний
const remindModes={sameday:'Только в день платежа',daybefore:'За день до и в день платежа',daily:'Каждый день',alternate:'Через день'};
function leads(p){const n=Math.max(0,Math.min(30,Number(p.remindDays)||0));if(p.remindMode==='sameday')return [0];if(p.remindMode==='daybefore')return [1,0];if(p.remindMode==='daily')return Array.from({length:n+1},(_,i)=>n-i);if(p.remindMode==='alternate'){const r=[];for(let d=n;d>0;d-=2)r.push(d);r.push(0);return r;}return [...new Set([n,0])];}
function remindersOn(state,date){const result=[];for(const payment of state.payments)for(const lead of leads(payment)){const due=addDays(date,lead);if(isDue(payment,due)&&!state.entries.some(e=>e.paymentId===payment.id&&e.paymentDate===due))result.push({payment,due,lead,time:time(payment)});}return result;}
const api={intervals,label,datesInMonth,isDue,next,addDays,time,remindersOn,leads,remindModes};root.MonoSchedule=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
