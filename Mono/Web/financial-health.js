(function(root){
'use strict';
const E=typeof module==='object'?require('./engine.js'):root.MonoEngine;
const S=typeof module==='object'?require('./schedule.js'):root.MonoSchedule;
const clamp=n=>Math.max(0,Math.min(100,n));
const monthShift=(month,n)=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7);};
function calculate(state,currency,today=E.dateString(new Date())){
 const config=state.settings.financialHealth||{},currencyOf=id=>state.accounts.find(a=>a.id===id)?.currency;
 const relevant=state.entries.filter(e=>currencyOf(e.account)===currency&&e.date<=today);
 const firstDate=relevant.reduce((min,e)=>e.date<min?e.date:min,today);
 const coverageStart=config.coverageStartByCurrency?.[currency];
 const earliest=coverageStart&&firstDate>=coverageStart&&coverageStart.slice(-2)!=='01'?monthShift(coverageStart.slice(0,7),1):firstDate.slice(0,7);
 const months=[-3,-2,-1].map(n=>monthShift(today.slice(0,7),n)).filter(m=>m>=earliest);
 const entries=relevant.filter(e=>months.includes(e.date.slice(0,7)));
 const targets={reserveMonths:[3,6,9,12].includes(config.reserveMonths)?config.reserveMonths:3,savingRate:[.05,.1,.15,.2,.25,.3].includes(config.savingRate)?config.savingRate:.1,freeRate:[.1,.2,.3].includes(config.freeRate)?config.freeRate:.2};
 const n=months.length,ready=n>0&&config.historyComplete===true;
 const income=entries.filter(e=>E.isIncomeForStats(e)&&!e.refundOf&&!['Возврат долга','Возвраты'].includes(e.category)).reduce((s,e)=>s+e.amount,0);
 const expense=entries.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0);
 const refunds=entries.filter(e=>e.type==='income'&&e.refundOf&&entries.some(x=>x.id===e.refundOf&&x.type==='expense'&&x.amount===e.amount&&x.account===e.account)).reduce((s,e)=>s+e.amount,0);
 const monthlyIncome=n?income/n:0,monthlyExpense=n?Math.max(0,expense-refunds)/n:0;
 const savingMonths=new Set(entries.filter(e=>e.type==='saving').map(e=>e.date.slice(0,7))).size;
 const savingsTracked=state.goals.some(g=>g.currency===currency&&(g.target===null||E.goalBalance(state,g.id)<g.target))||entries.some(e=>e.type==='saving');
 const saving=n?entries.filter(e=>e.type==='saving').reduce((s,e)=>s+e.amount,0)/n:0;
 const activeDeposits=(state.deposits||[]).filter(d=>d.start<=today&&d.end>today&&currencyOf(d.account)===currency);
 // Deposit principals are already included in account balances; subtract locked funds once.
 const liquidAccount=a=>Math.max(0,E.balance(state,a.id)-activeDeposits.filter(d=>d.account===a.id).reduce((s,d)=>s+d.principal,0));
 const accounts=state.accounts.filter(a=>a.currency===currency);
 const liquid=Math.max(0,accounts.reduce((s,a)=>s+E.balance(state,a.id),0)-activeDeposits.reduce((s,d)=>s+d.principal,0));
 const reserveAccounts=accounts.filter(a=>(config.reserveAccountIds||[]).includes(a.id));
 const reserveGoals=state.goals.filter(g=>g.currency===currency&&(config.reserveGoalIds||[]).includes(g.id));
 const reserve=reserveAccounts.reduce((s,a)=>s+liquidAccount(a),0)+reserveGoals.reduce((s,g)=>s+E.goalBalance(state,g.id),0);
 const end=S.addDays(today,29),dates=[];
 for(let d=today;d<=end;d=S.addDays(d,1))dates.push(d);
 let upcoming=0,debt=0,unpaid=0;const commitments={7:0,14:0,30:0};
 for(const p of state.payments.filter(p=>currencyOf(p.account)===currency)){
  for(const d of dates){if(!S.isDue(p,d))continue;upcoming+=p.amount;
   if((config.debtPaymentIds||[]).includes(p.id))debt+=p.amount;
   if(!state.entries.some(e=>e.type==='expense'&&e.paymentId===p.id&&e.paymentDate===d&&e.date<=today)){unpaid+=p.amount;for(const days of [7,14,30])if(d<=S.addDays(today,days-1))commitments[days]+=p.amount;}
  }
 }
 const reserveMonths=monthlyExpense>0?reserve/monthlyExpense:null;
 const expenseRatio=monthlyIncome>0?monthlyExpense/monthlyIncome:null;
 const debtRatio=monthlyIncome>0?debt/monthlyIncome:null;
 const savingRatio=monthlyIncome>0?saving/monthlyIncome:null;
 const coverage=unpaid>0?liquid/unpaid:null;
 const parts=[
  {id:'flow',name:'Расходы и доходы',weight:25,score:ready?(expenseRatio!==null?clamp((1-expenseRatio)/targets.freeRate*100):monthlyExpense>0?0:null):null,metric:expenseRatio,value:monthlyExpense,base:monthlyIncome,formula:`(1 − расходы / доходы) / ${targets.freeRate*100}% × 100, от 0 до 100. Свободная часть — ваш ориентир; доходы и расходы усреднены по полным месяцам.`,advice:'Сначала найдите повторяющиеся траты, которые можно сократить без потери важного. Ориентир — оставлять часть дохода свободной.'},
  {id:'reserve',name:'Финансовая подушка',weight:25,score:ready&&config.reserveConfirmed===true&&reserveMonths!==null?clamp(reserveMonths/targets.reserveMonths*100):null,metric:reserveMonths,value:reserve,base:monthlyExpense,formula:`Доступный резерв / средние месячные расходы / ${targets.reserveMonths} × 100. Ваш ориентир — ${targets.reserveMonths} месяцев; для нестабильного дохода рассмотрите 6 месяцев и более.`,advice:'Отделите резерв от денег на отпуск и покупки. Срочные вклады не включаются в доступный резерв до окончания срока.'},
  {id:'debt',name:'Долговая нагрузка',weight:15,score:ready&&config.debtConfirmed===true?(debtRatio!==null?clamp((.5-debtRatio)/.3*100):debt>0?0:null):null,metric:debtRatio,value:debt,base:monthlyIncome,formula:'Платежи по выбранным кредитам за следующие 30 дней / средний записанный доход. До 20% — 100 баллов, от 50% — 0; между ними линейная шкала. Это нагрузка на поступления, не банковский DTI по доходу до налогов.',advice:'Проверьте, что внесены все кредитные платежи. Сравнивайте снижение долга с сохранением доступного резерва.'},
  {id:'bills',name:'Обязательные платежи',weight:15,score:config.paymentsComplete===true&&upcoming>0?clamp((coverage??1)*100):null,metric:coverage,value:unpaid,base:liquid,formula:'Доступные деньги / ещё не отмеченные оплаченными обязательства следующих 30 дней × 100, максимум 100. Уже записанная оплата второй раз не учитывается.',advice:'Проверьте ближайшие платежи и держите нужную сумму доступной. Отсутствие записи об оплате само по себе не означает просрочку.'},
  {id:'saving',name:'Накопления и цели',weight:20,score:ready&&savingsTracked&&savingRatio!==null?clamp(savingRatio/targets.savingRate*100):null,metric:savingRatio,value:saving,base:monthlyIncome,formula:`Записанные пополнения целей / записанный доход / ${targets.savingRate*100}% × 100. Это ваш ориентир для целей, не общая норма инвестиций. Переводы и остаток вклада не считаются новыми накоплениями.`,advice:'Небольшие регулярные пополнения помогают продвигаться к целям. Деньги на счетах без записи пополнения цели здесь не видны.'}
 ];
 const known=parts.filter(p=>p.score!==null),knownWeight=known.reduce((s,p)=>s+p.weight,0);
 const score=ready&&known.length>=3&&knownWeight>=60?Math.round(known.reduce((s,p)=>s+p.score*p.weight,0)/knownWeight):null;
 const goals=state.goals.filter(g=>g.currency===currency).map(g=>({id:g.id,name:g.name,saved:E.goalBalance(state,g.id),target:g.target}));
 return {currency,today,months,ready,score,knownWeight,targets,savingMonths,commitments,provisional:n<3||knownWeight<100,parts,monthlyIncome,monthlyExpense,income,expense:Math.max(0,expense-refunds),reserve,liquid,upcoming,unpaid,debt,saving,goals,depositPrincipal:activeDeposits.reduce((s,d)=>s+d.principal,0)};
}
const excluded=/продукт|транспорт|кафе|авто|дом|здоров|связь|коммун|кредит|ипотек|подписк|финансов|перевод/iu;
function reviewCandidate(state,currency,today=E.dateString(new Date())){
 const last=state.settings.financialHealth?.lastReviewDate;
 if(last&&S.addDays(last,14)>today)return null;
 return state.entries.filter(e=>e.type==='expense'&&e.amount>=500000&&e.date<=S.addDays(today,-14)&&e.date>=S.addDays(today,-180)&&!e.purchaseReview&&!e.paymentId&&!e.installmentTotal&&!excluded.test(e.category||'')&&state.accounts.find(a=>a.id===e.account)?.currency===currency).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
}
const api={calculate,reviewCandidate};root.MonoFinancialHealth=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
