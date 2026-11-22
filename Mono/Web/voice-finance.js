(function(root){
'use strict';
const E=typeof module==='object'?require('./engine'):root.MonoEngine;
const Period=typeof module==='object'?require('./period'):root.MonoPeriod;
const Query=typeof module==='object'?require('./operation-query'):root.MonoOperationQuery;
const Payments=typeof module==='object'?require('./payment-dates'):root.MonoPaymentDates;
const S=typeof module==='object'?require('./schedule'):root.MonoSchedule;
const Voice=typeof module==='object'?require('./voice'):root.MonoVoice;
const allocationMarker=/[,; ]*\s+(?:из ни[хз]|из эт(?:ой суммы|их денег)|в том числе)\s+/u;
const clean=text=>text.toLowerCase().replace(/ё/g,'е').replace(/[«»"]/g,'').replace(/[.!?;]+$/,'').trim();
const stem=text=>clean(text).replace(/(?:ов|ев|ам|ям|ах|ях|[аеиоуыюяьй]+)(?=\s|$)/gu,'');
function named(text,items){
 const key=clean(text);
 const exact=items.filter(item=>clean(item.name)===key);
 if(exact.length)return exact.length===1?exact[0]:null;
 const matches=items.filter(item=>stem(item.name)===stem(key));
 return matches.length===1?matches[0]:null;
}
function titleAfter(text,pattern){return clean(text.match(pattern)?.[1]||'');}
function catchError(run){try{return run();}catch(error){return {error:error.message};}}
function read(raw,state,account,now=new Date()){
 const text=clean(raw),today=E.dateString(now),currency=state.accounts.find(a=>a.id===account)?.currency||'RUB';
 const comparison=/^(?:моно[, ]+)?(?:сравни|на сколько (?:больше|меньше)|сколько\s+.+\sпо сравнению с)(?:\s|$)/u.test(text);
 if(comparison&&/(?:расход|потрат|трат)/u.test(text)){
  return catchError(()=>{
   const phrase=Query.calendarPhrase(text.replace(/\s+по сравнению с.+$/u,''));
   const filter=Query.spokenCategories(phrase,state.categories);
   const categories=filter.categories||(filter.category?[filter.category]:[]);
   const selected=Query.spokenPeriod(phrase,now);
   const period={...selected,end:selected.end>today?today:selected.end};
   if(period.end<period.start)throw Error('Выберите прошедший период для сравнения.');
   const days=Math.round((Date.parse(period.end)-Date.parse(period.start))/86400000)+1;
   const month=Period.month(period.start.slice(0,7));
   let previous;
   if(period.start===month.start&&selected.end===month.end){
    const prior=Period.month(Period.shift(period.start.slice(0,7),-1));
    previous={start:prior.start,end:period.end===month.end?prior.end:S.addDays(prior.start,Math.min(days-1,Number(prior.end.slice(8))-1))};
   }else if(/(?:эту|текущую|прошлую|предыдущую) неделю/u.test(phrase)){
    previous={start:S.addDays(period.start,-7),end:S.addDays(period.end,-7)};
   }else previous={start:S.addDays(period.start,-days),end:S.addDays(period.start,-1)};
   const predicate=e=>e.type==='expense'&&(!categories.length||categories.includes(e.category));
   return {kind:'compare',period,previous,...filter,rows:Period.filter(state.entries,period,predicate),priorRows:Period.filter(state.entries,previous,predicate)};
  });
 }
 if(/^(?:моно[, ]+)?покажи\s+(?:(?:мои|наши)\s+)?(?:расход|трат|доход|операци|истори)/u.test(text))return null;
 if(/^(?:моно[, ]+)?(?:сколько|покажи|проверь|какой)/u.test(text)&&/(?:лимит|бюджет)/u.test(text)){
  const category=titleAfter(text,/(?:лимит[а-я]*|бюджет[а-я]*)(?:\s+на|\s+по категории)\s+(.+)$/u);
  const categories=Object.keys(state.limits[currency]||{}).filter(name=>state.limits[currency][name]>0);
  const match=category?named(category,categories.map(name=>({name}))):null;
  if(category&&!match)return {error:'Для этой категории на счёте записи лимит не задан.'};
  const month=Period.month(today.slice(0,7));
  const rows=Period.filter(state.entries,month,e=>e.type==='expense'&&state.accounts.some(a=>a.id===e.account&&a.currency===currency));
  return {kind:'budget',currency,items:(match?[match.name]:categories).map(name=>({name,limit:state.limits[currency][name],spent:rows.filter(e=>e.category===name).reduce((sum,e)=>sum+e.amount,0)}))};
 }
 if(/^(?:моно[, ]+)?(?:сколько|покажи|проверь|как идет)/u.test(text)&&/(?:цел[ьи]|накопил|накоплено|накопить|копить|собрано)/u.test(text)){
  const name=titleAfter(text,/(?:по цели|до цели|на цель|на)\s+(.+)$/u);
  const goal=name?named(name,state.goals):null;
  if(name&&!goal)return {error:'Не нашёл эту цель. Назовите её как в списке целей.'};
  return {kind:'goals',items:(goal?[goal]:state.goals).map(g=>({...g,saved:E.goalBalance(state,g.id)}))};
 }
 if(/^(?:моно[, ]+)?(?:какие|что|покажи|проверь)/u.test(text)&&/(?:платеж[а-я]*|оплатить|оплат[аые])/u.test(text)){
  return catchError(()=>{
   const deadline=titleAfter(text,/\sдо\s+(.+)$/u),untilSalary=/^зарплат[а-я]*$/u.test(deadline);
   const configured=state.settings.financialHealth?.nextIncome?.[currency]?.date;
   if(untilSalary&&(!configured||configured<today))throw Error('Уточните дату зарплаты. Например: «Какие платежи до 5 декабря?»');
   const end=untilSalary?configured:deadline?Query.searchDay(deadline,now,{future:true}):S.addDays(today,30);
   if(!end||end<today)throw Error('Назовите будущую дату для платежей.');
   if(end>S.addDays(today,366))throw Error('Назовите период платежей в пределах года.');
   const overdue=Payments.upcoming(state,today).filter(item=>item.due<today);
   const items=[...overdue];
   for(let month=today.slice(0,7);month<=end.slice(0,7);month=Period.shift(month,1))
    items.push(...Payments.occurrences(state,month).filter(item=>!item.paid&&item.due>=today&&(untilSalary?item.due<end:item.due<=end)));
   return {kind:'payments',end,untilSalary,items};
  });
 }
 return null;
}
function review(raw,state,account,now=new Date()){
 const text=clean(Voice.repairReplay(raw)).replace(/(?<!\p{L})зп(?!\p{L})/gu,'зарплата')
  .replace(/(?<=\d)\s*р(?:уб(?:лей|ля|ль)?)?\.?(?![\p{L}])/gu,' рублей');
 const marker=text.match(allocationMarker);
 if(!marker)return null;
 const header=text.slice(0,marker.index).replace(/^(?:разбей|раздели)\s+(?:покупку|расход|трату)\s*/u,'');
 const rest=text.slice(marker.index+marker[0].length),segments=rest.split(/\s+и\s+|\s*[,;]\s*(?=\p{L})/u).filter(Boolean);
 const shorthand=E.slang(header).match(/^(.*тысяч[аиу]?)[, ]+([^,]+)$/u);
 const tail=shorthand&&E.voiceAmounts(shorthand[2]);
 const relayedAmount=tail?.amounts[0];
 const canCarryThousands=relayedAmount&&tail.amounts.length===1&&relayedAmount.end===tail.text.length&&relayedAmount.start===0&&
  relayedAmount.amount>=100&&relayedAmount.amount<100000&&relayedAmount.amount%100===0;
 let main;
 if(canCarryThousands&&segments.length&&!E.voiceAmounts(segments[0]).amounts.length){
  const income=E.parse(shorthand[1],now,state.entries,state,account);
  if(income.entries.length===1&&income.entries[0].type==='income'&&!income.errors.length){
   main=income;
   segments[0]=relayedAmount.amount/100+' тысяч '+segments[0];
  }
 }
 main??=E.parse(header,now,state.entries,state,account);
 const original=main.entries[0];
 const result={entries:[],errors:[],reminders:[]};
 if(!original||main.entries.length!==1||main.errors.length||!['income','expense'].includes(original.type)){
  result.errors.push('Назовите одну общую сумму перед «из них».');return result;
 }
 const rows=[],currency=state.accounts.find(a=>a.id===original.account)?.currency;
 let remainder=null;
 try{
  for(const segment of segments){
   const {text:part,amounts}=E.voiceAmounts(segment);
   const money=amounts[0],isRest=/(?<!\p{L})(?:остальное|остаток)(?!\p{L})/u.test(part);
   if(!money&&!isRest&&original.type==='income')throw Error('Укажите сумму пополнения отдельно. Например, «из них 10 тысяч на отпуск».');
   if(isRest?amounts.length>0:amounts.length!==1||money.amount<=0)throw Error('Назовите сумму для каждой части или скажите «остальное».');
   if(isRest&&remainder)throw Error('Укажите только одну часть «остальное».');
   const words=clean(money?part.slice(0,money.start)+' '+part.slice(money.end):part)
    .replace(/(?<!\p{L})(?:руб(?:лей|ля|ль)?|остальное|остаток)(?!\p{L})|₽/gu,'')
    .replace(/(?<!\p{L})(?:отложил[аи]?|закинул[аи]?|пополнил[аи]?|положил[аи]?|перевел[аи]?|внес(?:ла)?|добавил[аи]?|отправил[аи]?|направил[аи]?)(?!\p{L})/gu,'')
    .replace(/\s+/gu,' ').trim();
   const target=words.replace(/^(?:(?:на|в|во|по)\s+)+/u,'').replace(/^(?:свой|мой|свою|мою)\s+/u,'')
    .replace(/\s+(?:на|в|во)$/u,'').replace(/^депозит(?=\s|$)/u,'вклад');
   const row={title:original.title,amount:money?.amount||0,date:original.date,account:original.account};
   if(original.type==='expense'){
    const category=named(target.replace(/^категори[юи]\s+/u,''),state.categories.map(name=>({name})));
    if(!category)throw Error('Не нашёл категорию «'+target+'». Назовите её как в списке категорий.');
    Object.assign(row,{type:'expense',category:category.name,categoryChosen:true});
   }else{
    if(isRest)throw Error('Для пополнений назовите конкретные суммы.');
    const depositRequest=/^вклад(?:\s|$)/u.test(target);
    const depositName=target.replace(/^вклад\s*/u,'');
    const deposits=(state.deposits||[]).filter(d=>state.accounts.some(a=>a.id===d.account&&a.currency===currency)&&d.start<=original.date&&d.end>original.date);
    const deposit=depositName?named(depositName,deposits):deposits.length===1?deposits[0]:null;
    const goal=!depositRequest&&named(target.replace(/^цел[ьи]\s+/u,''),state.goals.filter(g=>g.currency===currency));
    if(goal)Object.assign(row,{type:'saving',title:'На '+goal.name,goalId:goal.id});
    else if(depositRequest||deposit){
     if(!deposits.length)throw Error('Нет действующих вкладов в валюте счёта.');
     if(depositName&&!deposit)throw Error('Не нашёл вклад «'+depositName+'».');
     Object.assign(row,{type:'saving',title:deposit?'Пополнение вклада · '+deposit.name:'Выберите вклад',depositTopUp:true,depositTopUpId:deposit?.id||''});
    }else throw Error('Не нашёл цель «'+target+'».');
   }
   if(isRest)remainder=row;
   rows.push(row);
  }
  const assigned=rows.reduce((sum,row)=>sum+row.amount,0);
  if(assigned>original.amount)throw Error('Сумма частей больше общей суммы.');
  if(original.type==='expense'){
   if(remainder){remainder.amount=original.amount-assigned;if(!remainder.amount)throw Error('На «остальное» ничего не осталось.');}
   else if(assigned!==original.amount)throw Error('Части не дают общую сумму. Укажите, куда отнести остаток.');
  }
  result.entries=original.type==='income'?[original,...rows]:rows;
  result.plan={type:original.type,total:original.amount};
 }catch(error){result.errors.push(error.message);}
 return result;
}
const api={read,review,isAllocation:text=>allocationMarker.test(clean(text))};root.MonoVoiceFinance=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
