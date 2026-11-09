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
 for(const r of state.reminders||[]){
  if(r.date>today||r.date===today&&r.time>minute)items.push({id:'personal:'+r.id,date:r.date,time:r.time,text:r.name});
 }
 const recorded=new Set(state.entries.filter(e=>e.paymentId).map(e=>e.paymentId+'|'+e.paymentDate));
 for(const p of state.payments){
  if(p.remindersDisabled)continue;
  const time=MonoSchedule.time(p);
  let due=MonoSchedule.next(p,today);
  let count=0;
  while(due&&due>=today&&count<60){
   if(!recorded.has(p.id+'|'+due)){
    for(const lead of new Set([p.remindDays||0,0])){
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
 items.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 post('reminders',{items:items.slice(0,60)});
}
root.MonoNative={
 Recognition:NativeRecognition,speechEvent,refreshReminders,
 storeAccess:access=>post('storeAccess',{access}),
 refreshAccess:()=>{root.MonoFinanceUI?.catchUp();return root.MonoAccess?.refresh(true);},
 appReady:()=>post('appReady'),
 openShortcut:kind=>root.MonoShortcut?.(kind),
 share:(name,text)=>post('share',{name,text}),
 invite:()=>post('invite'),
 openURL:url=>post('openURL',{url}),
 openSettings:()=>post('settings'),
 enableReminders:()=>post('enableReminders'),
 reminderPermission(granted){
  if(granted){refreshReminders();notify('Уведомления iPhone включены.');}
  else notify('Проверьте разрешение на уведомления в настройках iPhone.');
 }
};
})(window);
