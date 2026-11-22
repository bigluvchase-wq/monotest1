(function(root){
'use strict';
const Dates=typeof module==='object'?require('./speech-dates'):root.MonoSpeechDates;
const Period=typeof module==='object'?require('./period'):root.MonoPeriod;
const NLP=typeof module==='object'?require('./local-nlp'):root.MonoLocalNLP;
const normalize=text=>text.toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
const iso=date=>[String(date.getFullYear()).padStart(4,'0'),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
const shifted=(date,days)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+days,12);
function searchDay(text,now=new Date(),{future=false}={}){
 const query=normalize(text);
 if(!query)return null;
 try{
  if(/^\d{4}-\d{2}-\d{2}$/.test(query))return Period.validDate(query)?query:null;
  const day=Dates.queryDay(query,now);
  if(!day||!future||day>=iso(now)||/\d{4}|вчера|сегодня|прошл/u.test(query))return day;
  const next=String(Number(day.slice(0,4))+1)+day.slice(4);
  return Period.validDate(next)?next:null;
 }catch{return null;}
}
function calendarPhrase(text){
 return text.replace(/(?<!\p{L})(?:на|в)\s+(эт(?:ой|ом)|текущ(?:ей|ем)|прошл(?:ой|ом)|предыдущ(?:ей|ем))\s+(неделе|месяце|году)(?!\p{L})/gu,(_,which,unit)=>{
  const week=unit==='неделе';
  const qualifier=/^(?:прошл|предыдущ)/u.test(which)?(week?'прошлую':'прошлый'):(week?'эту':'этот');
  return 'за '+qualifier+' '+(week?'неделю':unit==='месяце'?'месяц':'год');
 });
}
function spokenPeriod(text,now){
 text=calendarPhrase(text);
 const calendar=text.match(/(?<!\p{L})(?:прошл(?:ую|ый)|предыдущ(?:ую|ий|ее)|(?:эту|этот)|текущ(?:ую|ий))\s+(неделю|месяц|год)(?!\p{L})/u);
 if(calendar){
  const previous=/^(?:прошл|предыдущ)/u.test(calendar[0]),today=iso(now),unit=calendar[1];
  if(unit==='месяц')return Period.month(Period.shift(today.slice(0,7),previous?-1:0));
  if(unit==='год'){const year=now.getFullYear()-(previous?1:0);return Period.range(year+'-01-01',year+'-12-31');}
  const monday=shifted(now,-((now.getDay()+6)%7)-(previous?7:0));
  return Period.range(iso(monday),iso(shifted(monday,6)));
 }
 const trailing=text.match(/(?<!\p{L})последни(?:е|х)\s+(\d{1,3})\s+(день|дня|дней|недел[юиь])(?!\p{L})/u);
 if(trailing){
  const count=Number(trailing[1])*(trailing[2].startsWith('недел')?7:1);
  if(!count)throw Error('Укажите длительность периода.');
  return Period.range(iso(shifted(now,1-count)),iso(now));
 }
 const interval=text.match(/(?<!\p{L})с\s+(.+?)\s+по\s+(.+)/u);
 if(interval){
  const end=Dates.queryDay(interval[2],now,{embedded:true});
  if(!end)throw Error('Уточните дату окончания периода.');
  const start=Dates.queryDay(interval[1],now,{embedded:true})||
   (/^\d{1,2}$/u.test(interval[1])?end.slice(0,7)+'-'+interval[1].padStart(2,'0'):null);
  if(!start)throw Error('Уточните дату начала периода.');
  return Period.range(start,end);
 }
 const explicit=text.match(/(?<![\d-])\d{4}-\d{2}-\d{2}(?![\d-])/u)?.[0];
 if(explicit)return Period.range(explicit,explicit);
 const day=Dates.queryDay(text,now,{embedded:true});
 if(day)return Period.range(day,day);
 if(/(?<!\p{L})за\s+/u.test(text))throw Error('Уточните дату или период.');
 return Period.month(iso(now).slice(0,7));
}
const categoryKey=text=>normalize(text).replace(/[«»"'.!?]/gu,'').trim();
const categoryStem=text=>categoryKey(text).split(' ').map(NLP.stem).join(' ');
function spokenCategories(text,names){
 text=calendarPhrase(text);
 const date=Dates.queryDayPhrase(text,true);
 if(date)text=text.replace(date,' ');
 const qualifier=text.match(/(?<!\p{L})(?:по\s+категори(?:и|ям)|в\s+категори(?:и|ях)|категория|на(?!\s+сколько(?:\s|$)))\s+(.+)/u);
 if(!qualifier)return {};
 const phrase=qualifier[1].replace(/\s*[,;.!?]+$/u,'').split(/\s+(?:за|сегодня|вчера|позавчера)(?=[\s.!?]|$)|\s+с\s+(?=\d)|\s+по сравнению\s/u)[0].replace(/\s*[,;]+$/u,'');
 const match=part=>{
  const key=categoryKey(part);
  const exact=names.find(name=>categoryKey(name)===key);
  if(exact)return exact;
  const matches=names.filter(name=>categoryStem(name)===categoryStem(key));
  return matches.length===1?matches[0]:null;
 };
 const whole=match(phrase);
 if(whole)return {category:whole};
 const categories=new Set();
 for(const group of phrase.split(/,\s*(?:и\s+)?(?:на\s+)?|\s+и\s+на\s+/u)){
  const parts=group.split(/\s+и\s+/u);
  for(let start=0;start<parts.length;){
   let end=parts.length,name=null;
   while(end>start&&!name){name=match(parts.slice(start,end).join(' и '));if(!name)end--;}
   if(!name)throw Error('Категория не найдена. Назовите её как в списке категорий.');
   categories.add(name);start=end;
  }
 }
 const selected=[...categories];
 return selected.length===1?{category:selected[0]}:{categories:selected};
}
function hasSpokenDate(text,now){
 try{return !!Dates.queryDay(text,now,{embedded:true});}catch{return true;}
}
function report(text,state,now=new Date()){
 const query=calendarPhrase(normalize(text));
 const command=/^(?:моно[, ]+)?(?:покажи(?:те)?|выведи(?:те)?|открой(?:те)?)(?!\p{L})/u.test(query);
 const terse=/^(?:расходы|доходы|траты|операции)\s+(?:на|за|по|в категории|сегодня|вчера|позавчера)(?:\s|$)/u.test(query);
 if(!command&&(!terse||/\d/u.test(query)&&!hasSpokenDate(query,now)&&!/за последние\s+\d+\s+(?:д|недел)/u.test(query)))return null;
 const expense=/(?<!\p{L})(?:расход[а-я]*|трат[а-я]*)(?!\p{L})/u.test(query);
 const income=/(?<!\p{L})доход[а-я]*(?!\p{L})/u.test(query);
 if(!expense&&!income&&!/(?<!\p{L})(?:операци[а-я]+|истори[а-я]+)(?!\p{L})/u.test(query))return null;
 const type=expense&&income?'flows':expense?'expense':income?'income':null;
 const categories=[...new Set([...(type==='income'?[]:state.categories),...(type==='expense'?[]:state.incomeCategories)])];
 try{
  const period=spokenPeriod(query,now);
  return {type,period,category:undefined,...spokenCategories(query,categories)};
 }catch(error){return {error:error.message};}
}
const api={searchDay,report,spokenPeriod,spokenCategories,calendarPhrase};root.MonoOperationQuery=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
