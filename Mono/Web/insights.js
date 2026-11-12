(function(root){
'use strict';
// Расчёты для главной, итогов, умных подсказок и целей. Будущие доходы не прогнозируем:
// считаем только по деньгам, которые уже есть, и по обязательным платежам.
const DAY=864e5;
const iso=d=>E.dateString(d);
const at=s=>new Date(s+'T12:00:00');
const addDays=(s,n)=>iso(new Date(at(s).getTime()+n*DAY));
const daysBetween=(a,b)=>Math.round((at(b)-at(a))/DAY);
const today=()=>iso(new Date());
const inCur=(e,cur)=>entryCurrency(e)===cur;
const sum=(list)=>list.reduce((n,e)=>n+e.amount,0);
const spentIn=(cur,from,to,cat)=>sum(state.entries.filter(e=>e.type==='expense'&&inCur(e,cur)&&e.date>=from&&e.date<=to&&(!cat||e.category===cat)));
const incomeIn=(cur,from,to)=>sum(state.entries.filter(e=>e.type==='income'&&inCur(e,cur)&&e.date>=from&&e.date<=to));
const shiftMonth=(s,n)=>{const d=at(s);const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return iso(d);};
const monthStart=s=>s.slice(0,8)+'01';
const monthEnd=s=>iso(new Date(at(s).getFullYear(),at(s).getMonth()+1,0,12));
const pctText=p=>(p>0?'+':'−')+Math.abs(Math.round(p))+'%';

// Регулярные поступления (зарплата, аванс): числа месяца, в которые доход приходил хотя бы в 2 разных месяца
// за последние 4 месяца. Разовые подработки сюда не попадают, но уже полученные деньги учитываются в балансе.
function incomeDays(cur){
 const from=shiftMonth(today(),-4),incomes=state.entries.filter(e=>e.type==='income'&&inCur(e,cur)&&e.date>=from);
 const monthsTotal={};incomes.forEach(e=>{const m=e.date.slice(0,7);monthsTotal[m]=(monthsTotal[m]||0)+e.amount;});
 const big=incomes.filter(e=>e.amount>=(monthsTotal[e.date.slice(0,7)]||0)*.15);
 const clusters=[];
 for(const e of big.sort((a,b)=>Number(a.date.slice(8))-Number(b.date.slice(8)))){
  const d=Number(e.date.slice(8));const c=clusters.find(c=>Math.abs(c.day-d)<=3);
  if(c){c.days.push(d);c.months.add(e.date.slice(0,7));c.day=Math.round(c.days.reduce((a,b)=>a+b,0)/c.days.length);}
  else clusters.push({day:d,days:[d],months:new Set([e.date.slice(0,7)])});
 }
 return clusters.filter(c=>c.months.size>=2).map(c=>c.day).sort((a,b)=>a-b);
}
function nextIncomeDate(cur){
 const t=today(),days=incomeDays(cur);if(!days.length)return null;
 for(let k=0;k<2;k++){const base=shiftMonth(monthStart(t),k);const last=Number(monthEnd(base).slice(8));
  for(const d of days){const s=base.slice(0,8)+String(Math.min(d,last)).padStart(2,'0');if(s>t)return s;}}
 return null;
}
// Неоплаченные обязательные платежи с from (включительно) по to (не включая)
function paymentsDue(cur,from,to){
 const out=[];const months=new Set([from.slice(0,7),to.slice(0,7)]);for(let m=from.slice(0,7);m<to.slice(0,7);m=shiftMonth(m+'-01',1).slice(0,7))months.add(m);
 for(const m of months)for(const o of MonoPaymentDates.occurrences(state,m)){
  const a=state.accounts.find(x=>x.id===o.payment.account);if(!a||a.currency!==cur||o.paid)continue;
  if(o.due>=from&&o.due<to)out.push({name:o.payment.name,due:o.due,amount:o.payment.amount});
 }
 return out.sort((a,b)=>a.due.localeCompare(b.due));
}

// «Можно потратить сегодня»: (деньги на счетах утром − платежи до следующего поступления) ÷ дни, минус потраченное сегодня
function safeToSpend(cur){
 const t=today(),balance=E.totals(state,cur).available,spentToday=spentIn(cur,t,t);
 const income=nextIncomeDate(cur),horizon=income||addDays(monthEnd(t),1);
 const days=Math.max(1,daysBetween(t,horizon));
 const payments=paymentsDue(cur,t,horizon),paySum=sum(payments);
 const morning=balance+spentToday,free=morning-paySum;
 const norm=Math.max(0,Math.floor(free/days/100)*100),left=norm-spentToday;
 return {balance,morning,spentToday,payments,paySum,days,horizon,byIncome:!!income,norm,left,free};
}

// Прогноз: средние траты в день за последние 30 дней (без обязательных платежей) + платежи впереди. Доходы не добавляем.
function forecast(cur){
 const t=today(),from=addDays(t,-29);
 const first=state.entries.filter(e=>inCur(e,cur)).reduce((m,e)=>e.date<m?e.date:m,t);
 const span=Math.max(7,Math.min(30,daysBetween(first,t)+1));
 const daily=sum(state.entries.filter(e=>e.type==='expense'&&inCur(e,cur)&&e.date>=addDays(t,-(span-1))&&e.date<=t&&!e.paymentId))/span;
 const balance=E.totals(state,cur).available;
 const point=n=>{const to=addDays(t,n+1);return {days:n,date:addDays(t,n),value:Math.round(balance-daily*n-sum(paymentsDue(cur,addDays(t,1),to)))};};
 return {daily:Math.round(daily),span,balance,week:point(7),month:point(30),runsOut:daily>0?Math.floor(balance/daily):null};
}

// Изменение баланса к тому же числу прошлого месяца
function balanceDelta(cur){
 const t=today(),prev=shiftMonth(t,-1),balance=E.totals(state,cur).available;
 const net=incomeIn(cur,addDays(prev,1),t)-spentIn(cur,addDays(prev,1),t);
 const before=balance-net;if(!before)return null;
 return {pct:(balance-before)/Math.abs(before)*100,prev,before};
}

// Умные подсказки: категории, где тратите заметно больше или меньше обычного, и итоги месяца
function insights(cur){
 const t=today(),out=[],day=Number(t.slice(8));
 const cats=[...new Set(state.entries.filter(e=>e.type==='expense'&&inCur(e,cur)).map(e=>e.category))];
 // месяц к «обычному»: среднее за те же дни трёх прошлых месяцев
 for(const c of cats){
  const now=spentIn(cur,monthStart(t),t,c);let usual=0,n=0;
  for(let k=1;k<=3;k++){const s=shiftMonth(monthStart(t),-k);const e=s.slice(0,8)+String(Math.min(day,Number(monthEnd(s).slice(8)))).padStart(2,'0');const v=spentIn(cur,s,e,c);if(state.entries.some(x=>x.date<=e&&x.date>=s)){usual+=v;n++;}}
  if(!n)continue;usual/=n;
  if(usual>=50000&&Math.abs(now-usual)/usual>=.2&&Math.abs(now-usual)>=30000)out.push({kind:now>usual?'up':'down',weight:Math.abs(now-usual),text:`В этом месяце на «${c}» вы потратили на ${Math.round(Math.abs(now-usual)/usual*100)}% ${now>usual?'больше':'меньше'} обычного`});
 }
 // неделя к прошлой неделе
 const w0=addDays(t,-6),p0=addDays(t,-13),p1=addDays(t,-7);
 for(const c of cats){const a=spentIn(cur,w0,t,c),b=spentIn(cur,p0,p1,c);if(b>=30000&&Math.abs(a-b)>=30000&&Math.abs(a-b)/b>=.15)out.push({kind:a>b?'up':'down',weight:Math.abs(a-b)*.8,text:`За эту неделю на «${c}» ушло ${a>b?'больше':'меньше'}, чем на прошлой: ${money(a,cur)} против ${money(b,cur)}`});}
 // доходы и расходы месяца к тем же дням прошлого
 const pm=shiftMonth(monthStart(t),-1),pe=shiftMonth(t,-1);
 const inc=incomeIn(cur,monthStart(t),t),incP=incomeIn(cur,pm,pe),exp=spentIn(cur,monthStart(t),t),expP=spentIn(cur,pm,pe);
 if(incP&&inc!==incP)out.push({kind:inc>incP?'good':'info',weight:Math.abs(inc-incP)*.5,text:`В этом месяце ${pctText((inc-incP)/incP*100)} к доходам по сравнению с прошлым`});
 if(expP&&exp!==expP)out.push({kind:exp>expP?'up':'down',weight:Math.abs(exp-expP)*.5,text:`Расходы ${exp>expP?'выше':'ниже'} прошлого месяца на ${Math.round(Math.abs(exp-expP)/expP*100)}%`});
 const top=cats.map(c=>[c,spentIn(cur,monthStart(t),t,c)]).sort((a,b)=>b[1]-a[1])[0];
 if(top&&top[1]>0&&exp)out.push({kind:'info',weight:1,text:`Больше всего в этом месяце уходит на «${top[0]}» — ${Math.round(top[1]/exp*100)}% расходов`});
 return out.sort((a,b)=>b.weight-a.weight);
}

// Умная цель: после двух недель учёта сравниваем траты за 7 дней с предыдущими 7 днями
function goalTip(goal){
 const cur=goal.currency,t=today();
 const first=state.entries.filter(e=>inCur(e,cur)).reduce((m,e)=>e.date<m?e.date:m,t);
 if(daysBetween(first,t)<14)return {ready:false,text:'Через две недели учёта начну подсказывать, где можно сэкономить на эту цель.'};
 const w0=addDays(t,-6),p0=addDays(t,-13),p1=addDays(t,-7);
 const cats=[...new Set(state.entries.filter(e=>e.type==='expense'&&inCur(e,cur)&&e.date>=p0).map(e=>e.category))];
 let best=null;for(const c of cats){const d=spentIn(cur,w0,t,c)-spentIn(cur,p0,p1,c);if(Math.abs(d)>=30000&&(!best||Math.abs(d)>Math.abs(best.d)))best={c,d};}
 if(!best)return {ready:true,text:'На этой неделе траты ровные — так держать. Подскажу, когда появится, что отложить.'};
 return best.d>0
  ?{ready:true,amount:best.d,text:`На «${best.c}» на этой неделе ушло на ${money(best.d,cur)} больше, чем на прошлой. Эту разницу можно было отложить на «${goal.name}».`}
  :{ready:true,amount:-best.d,text:`На «${best.c}» вы потратили на ${money(-best.d,cur)} меньше, чем на прошлой неделе. Отложите эту разницу на «${goal.name}».`};
}

// План пополнений к сроку: до недели — в день, до двух недель — каждые 5 дней, до месяца — раз в неделю, дальше — в месяц
function goalPlan(target,saved,deadline,cur){
 if(!deadline||!target)return null;
 const t=today(),days=daysBetween(t,deadline),left=Math.max(0,target-saved);
 if(days<=0)return {text:left?'Срок прошёл — можно продлить его в настройках цели':'Цель достигнута'};
 if(!left)return {text:'Цель уже достигнута'};
 let step,label;
 if(days<=7){step=1;label='в день';}else if(days<=14){step=5;label='каждые 5 дней';}else if(days<=31){step=7;label='раз в неделю';}else{step=30.44;label='в месяц';}
 const times=Math.max(1,Math.ceil(days/step)),each=Math.ceil(left/times/100)*100;
 return {each,label,times,text:`Откладывайте ${money(each,cur)} ${label}, чтобы успеть к ${at(deadline).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:at(deadline).getFullYear()===new Date().getFullYear()?undefined:'numeric'})}`};
}

root.MonoInsights={safeToSpend,forecast,balanceDelta,insights,goalTip,goalPlan,nextIncomeDate,incomeDays,paymentsDue};
})(window);
