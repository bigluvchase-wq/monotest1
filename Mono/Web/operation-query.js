(function(root){
'use strict';
const Dates=typeof module==='object'?require('./speech-dates'):root.MonoSpeechDates;
const Period=typeof module==='object'?require('./period'):root.MonoPeriod;
const normalize=text=>text.toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
const iso=date=>[String(date.getFullYear()).padStart(4,'0'),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
const shifted=(date,days)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+days,12);
function searchDay(text,now=new Date()){
 const query=normalize(text);
 if(!query)return null;
 try{
  if(/^\d{4}-\d{2}-\d{2}$/.test(query))return Period.validDate(query)?query:null;
  return Dates.queryDay(query,now);
 }catch{return null;}
}
function spokenPeriod(text,now){
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
function report(text,state,now=new Date()){
 const query=normalize(text);
 if(!/^(?:моно[, ]+)?(?:покажи(?:те)?|выведи(?:те)?|открой(?:те)?)(?!\p{L})/u.test(query))return null;
 const expense=/(?<!\p{L})(?:расход[а-я]*|трат[а-я]*)(?!\p{L})/u.test(query);
 const income=/(?<!\p{L})доход[а-я]*(?!\p{L})/u.test(query);
 if(!expense&&!income&&!/(?<!\p{L})(?:операци[а-я]+|истори[а-я]+)(?!\p{L})/u.test(query))return null;
 const type=expense&&income?'flows':expense?'expense':income?'income':null;
 const categories=[...new Set([...(type==='income'?[]:state.categories),...(type==='expense'?[]:state.incomeCategories)])];
 const categoryText=query.match(/(?<!\p{L})(?:по\s+категории|в\s+категории|категория)\s+([^,]+?)(?=\s+(?:за|сегодня|вчера|позавчера)(?:\s|$)|[.!?]*$)/u)?.[1];
 try{
  const period=spokenPeriod(query,now);
  const category=categoryText&&categories.find(name=>normalize(name)===categoryText.replace(/[«»"'.!?]/g,'').trim());
  if(categoryText&&!category)throw Error('Категория не найдена. Назовите её как в списке категорий.');
  return {type,period,category};
 }catch(error){return {error:error.message};}
}
const api={searchDay,report};root.MonoOperationQuery=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
