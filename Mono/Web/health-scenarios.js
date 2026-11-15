(function(root){
'use strict';
const E=typeof module==='object'?require('./engine'):root.MonoEngine,S=typeof module==='object'?require('./schedule'):root.MonoSchedule,H=typeof module==='object'?require('./financial-health'):root.MonoFinancialHealth;
function signature(state,r){const h=state.settings.financialHealth||{};return JSON.stringify([2,r.currency,r.months.length,r.provisional,r.targets,h.historyComplete===true,h.paymentsComplete===true,h.debtConfirmed===true,h.reserveConfirmed===true,...['debtPaymentIds','reserveAccountIds','reserveGoalIds'].map(k=>(h[k]||[]).slice().sort()),r.parts.filter(p=>p.score!==null).map(p=>p.id)]);}
function analyze(state,currency,today=E.dateString(new Date())){
 const r=H.calculate(state,currency,today),h=state.settings.financialHealth||{},next=h.nextIncome?.[currency];
 const cur=id=>state.accounts.find(a=>a.id===id)?.currency;
 const ordinary=state.entries.filter(e=>cur(e.account)===currency&&e.type==='expense'&&!e.paymentId&&r.months.includes(e.date.slice(0,7))).reduce((s,e)=>s+e.amount,0);
 const daily=r.months.length?ordinary/r.months.length/30.4375:0;
 let gap=null;
 if(r.ready&&h.paymentsComplete===true&&next&&next.date>today&&next.date<=S.addDays(today,366)){
  let cash=r.liquid,firstShortfall=null,bills=0,days=0;
  for(let date=today;date<next.date;date=S.addDays(date,1)){
   days++;let due=0;
   for(const p of state.payments.filter(p=>cur(p.account)===currency))if(S.isDue(p,date)&&!state.entries.some(e=>e.type==='expense'&&e.paymentId===p.id&&e.paymentDate===date&&e.date<=today))due+=p.amount;
   bills+=due;cash-=due+daily;if(cash<0&&!firstShortfall)firstShortfall=date;
  }
  gap={date:next.date,amount:next.amount,days,bills,ordinary:Math.round(daily*days),remaining:Math.round(cash),shortfall:Math.max(0,Math.round(-cash)),firstShortfall};
 }
 const stress=r.ready&&h.reserveConfirmed===true&&r.monthlyExpense>0?[.2,.3].map(drop=>{const income=r.monthlyIncome*(1-drop),deficit=Math.max(0,r.monthlyExpense-income);return {drop,income:Math.round(income),deficit:Math.round(deficit),months:deficit>0?r.reserve/deficit:null};}):null;
 const key=signature(state,r),history=(h.snapshots||[]).filter(x=>x.currency===currency&&x.key===key&&x.date<today).sort((a,b)=>a.date.localeCompare(b.date));
 const previous=history.at(-1)||null;
 return {r,gap,stress,key,previous,delta:r.score!==null&&previous?r.score-previous.score:null};
}
function snapshot(state,currency,today){const a=analyze(state,currency,today);if(a.r.score===null)return null;return {date:a.r.today,currency,key:a.key,score:a.r.score,parts:Object.fromEntries(a.r.parts.map(p=>[p.id,p.score===null?null:Math.round(p.score)]))};}
const api={analyze,snapshot};root.MonoHealthScenarios=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
