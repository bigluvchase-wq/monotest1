(function(root){
 'use strict';
 const P=typeof module==='object'?require('./period.js'):root.MonoPeriod;
 const timeValid=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 const unique=list=>Array.isArray(list)&&new Set(list.map(x=>x?.id)).size===list.length;
 const validName=(v,max)=>typeof v==='string'&&v.trim()&&v.length<=max;
 function valid(state){
  const deposits=state.deposits===undefined?[]:state.deposits, reminders=state.reminders===undefined?[]:state.reminders;
  return unique(deposits)&&unique(reminders)&&deposits.every(d=>d&&validName(d.id,100)&&validName(d.name,100)
   &&state.accounts.some(a=>a.id===d.account)&&Number.isSafeInteger(d.principal)&&d.principal>0&&d.principal<=1e12
   &&Number.isInteger(d.rate)&&d.rate>0&&d.rate<=100000&&P.validDate(d.start)&&P.validDate(d.end)&&d.start<d.end
   &&P.daysBetween(d.start,d.end)<=36525&&['daily','monthly'].includes(d.frequency)
   &&Number.isInteger(d.posted)&&d.posted>=0&&d.posted<=P.daysBetween(d.start,d.end))
   &&reminders.every(r=>r&&validName(r.id,100)&&validName(r.name,300)&&P.validDate(r.date)&&timeValid(r.time));
 }
 function anniversary(start,months){
  const next=P.month(P.shift(start.slice(0,7),months));
  return next.start.slice(0,8)+(start.slice(8)<next.end.slice(8)?start.slice(8):next.end.slice(8));
 }
 function earned(deposit,date){
  const days=Math.max(0,P.daysBetween(deposit.start,date<deposit.end?date:deposit.end));
  const denominator=3650000n;
  return Number((BigInt(deposit.principal)*BigInt(deposit.rate)*BigInt(days)+denominator/2n)/denominator);
 }
 function due(deposit,index){
  let next;
  try{next=deposit.frequency==='daily'?P.dateAfter(deposit.start,index):anniversary(deposit.start,index);}catch{return deposit.end;}
  return next<deposit.end?next:deposit.end;
 }
 function accrue(state,today){
  if(!state.deposits?.length)return null;
  const next=structuredClone(state),ids=new Set(next.entries.map(e=>e.id));
  let changed=false;
  for(const d of next.deposits||[]){
   let previous=d.posted?due(d,d.posted):d.start;
   while(previous<d.end){
    const index=d.posted+1,date=due(d,index);
    if(date>today)break;
    const id='deposit:'+d.id+':'+date,amount=earned(d,date)-earned(d,previous);
    if(amount>0&&!ids.has(id)){
     const category=next.incomeCategories.includes('Проценты')?'Проценты':'Другое';
     next.entries.push({id,title:'Проценты · '+d.name,amount,type:'income',category,account:d.account,date});
     ids.add(id);
    }
    previous=date;d.posted=index;changed=true;
   }
  }
  return changed?next:null;
 }
 const api={valid,anniversary,earned,accrue,timeValid};
 root.MonoFinanceTools=api;
 if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
