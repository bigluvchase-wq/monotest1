(function(root){
'use strict';
const handler=root.webkit?.messageHandlers?.mono;
if(!handler)return;
const post=(action,data={})=>handler.postMessage({action,...data});
const sessions=new Map();
let sequence=0;
class NativeRecognition {
 constructor(){this.id=String(++sequence);}
 start(){sessions.set(this.id,this);post('speechStart',{id:this.id});}
 stop(){post('speechStop',{id:this.id});}
 abort(){sessions.delete(this.id);post('speechAbort',{id:this.id});}
}
function speechEvent(id,event,info){
 const session=sessions.get(id);
 if(!session)return;
 if(event==='start')session.onstart?.();
 if(event==='result')session.onresult?.({results:[{0:{transcript:info.text},isFinal:false}]});
 if(event==='error')session.onerror?.({error:info.code,message:info.detail});
 if(event==='end'){sessions.delete(id);session.onend?.();}
}
function refreshReminders(){
 if(typeof state!=='object')return;
 const now=new Date(),today=E.dateString(now),minute=now.toTimeString().slice(0,5),items=[];
 const recorded=new Set(state.entries.filter(e=>e.paymentId).map(e=>e.paymentId+'|'+e.paymentDate));
 const want=kind=>state.settings.notifications?.[kind]!==false;
 for(const p of want('payments')?state.payments:[]){
  const time=MonoSchedule.time(p);
  let due=MonoSchedule.next(p,today);
  let count=0;
  while(due&&due>=today&&count<60){
   if(!recorded.has(p.id+'|'+due)){
    for(const lead of MonoSchedule.leads(p)){
     const date=MonoSchedule.addDays(due,-lead);
     if(date<today||date===today&&time<=minute)continue;
     items.push({id:p.id+'|'+due+'|'+date,date,time,
      text:(lead?'Через '+lead+' дн.: ':'Сегодня: ')+p.name+' · '+money(p.amount,account(p.account).currency)});
    }
    count++;
   }
   if(p.repeat==='once')break;
   due=MonoSchedule.next(p,MonoSchedule.addDays(due,1));
  }
 }
 if(want('reminders'))try{items.push(...(root.MonoReminders?.nativeItems()||[]));}catch{}
 if(want('subscription'))try{items.push(...(root.MonoAccess?.nativeItems?.()||[]));}catch{}
 // Ежедневно в 20:00 — только в дни, когда не внесено ни одной операции
 if(want('daily')){
  const days=new Set(state.entries.map(e=>e.date));
  for(let d=0;d<7;d++){const date=MonoSchedule.addDays(today,d);if(d===0&&(minute>='20:00'||days.has(today)))continue;items.push({id:'daily|'+date,date,time:'20:00',text:'Как прошёл день? Внесите траты и доходы в моно — это займёт пару секунд.'});}
 }
 items.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 // Ежедневные напоминания не вытесняют платежи и личные напоминания
 const main=items.filter(i=>!i.id.startsWith('daily|')),daily=items.filter(i=>i.id.startsWith('daily|'));
 post('reminders',{items:[...main.slice(0,60-Math.min(daily.length,7)),...daily].slice(0,60)});
}
let widgetTimer=0,quiet=false;
// Запоминаем разрешение на уведомления: в настройках кнопка меняется на «Разрешённые уведомления»
function savePermission(granted){
 if(typeof state!=='object'||state.settings.notifyGranted===Boolean(granted))return;
 const next=structuredClone(state);next.settings.notifyGranted=Boolean(granted);
 if(persist(next,{remote:true})&&page==='settings')render();
}
function pushWidget(){
 if(typeof state!=='object')return;
 clearTimeout(widgetTimer);
 widgetTimer=setTimeout(()=>{try{
  const today=E.dateString(new Date()),month=today.slice(0,7),currency=state.accounts[0]?.currency||'RUB',accounts=state.accounts.filter(a=>a.currency===currency);
  const balance=accounts.reduce((sum,a)=>sum+E.balance(state,a.id),0);
  const spent=test=>state.entries.filter(e=>e.type==='expense'&&accounts.some(a=>a.id===e.account)&&test(e.date)).reduce((sum,e)=>sum+e.amount,0);
  post('widget',{data:{balance:money(balance,currency),spentToday:money(spent(d=>d===today),currency),spentMonth:money(spent(d=>d.startsWith(month)),currency),updated:Date.now()/1000}});
 }catch{}},500);
}
// Быстрые действия с виджетов: mono://record и mono://text
function deepLink(kind){
 const run=()=>{
  if(typeof navigate!=='function')return;
  if(document.querySelector('dialog[open]'))document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  navigate('home',{noAnimation:true,noPageMotion:true});
  if(kind==='text')openEntry();
  else if(kind==='record'){
   startHold();
   document.addEventListener('pointerup',()=>endHold(),{once:true,capture:true});
  }
 };
 if(document.querySelector('.launch-intro'))setTimeout(run,2000);else setTimeout(run,150);
}
root.MonoNative={
 pushWidget,deepLink,
 Recognition:NativeRecognition,speechEvent,refreshReminders,
 storeAccess:access=>post('storeAccess',{access}),
 refreshAccess:()=>root.MonoAccess?.refresh(true),
 share:(name,text)=>post('share',{name,text}),
 invite:()=>post('invite'),
 openURL:url=>post('openURL',{url}),
 openSettings:()=>post('settings'),
 enableReminders(silent=false){quiet=silent;post('enableReminders');},
 checkPermission:()=>post('notificationStatus'),
 setTheme:dark=>post('theme',{dark:Boolean(dark)}),
 reminderPermission(granted){
  savePermission(granted);
  if(granted){refreshReminders();if(!quiet)notify('Уведомления iPhone включены.');}
  else if(!quiet)notify('Уведомления выключены. Включите их в настройках iPhone.');
  quiet=false;
 },
 notificationStatus(granted){savePermission(granted);if(granted)refreshReminders();}
};
})(window);
