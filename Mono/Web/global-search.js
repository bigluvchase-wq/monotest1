(function(root){
 'use strict';
 const norm=text=>String(text??'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[’«»"]/g,'').replace(/\s+/g,' ').trim();
 const months=['январ','феврал','март','апрел','ма','июн','июл','август','сентябр','октябр','ноябр','декабр'];
 function parse(query,today,P){
  let text=norm(query),period=null,amount=null,currency=null;
  const relative=text.match(/(?<!\p{L})(позавчера|вчера|сегодня)(?!\p{L})/u);
  const iso=text.match(/(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/);
  const numeric=text.match(/(?<!\d)(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2}))?(?!\d)/);
  const named=text.match(/(?<!\p{L})(?:за\s+)?(?:(\d{1,2})\s+)?(январ[ьяе]|феврал[ьяе]|март[ае]?|апрел[ьяе]|ма[йея]|июн[ьяе]|июл[ьяе]|август[ае]?|сентябр[ьяе]|октябр[ьяе]|ноябр[ьяе]|декабр[ьяе])(?:\s+(\d{4}))?(?!\p{L})/u);
  let date,marker;
  if(relative){date=P.dateAfter(today,{сегодня:0,вчера:-1,позавчера:-2}[relative[0]]);marker=relative[0];}
  else if(iso){date=iso[0];marker=iso[0];}
  else if(numeric){
   const [,day,month,year]=numeric;
   date=(year?.length===2?'20'+year:year||today.slice(0,4))+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0');marker=numeric[0];
  }else if(named){
   const [,day,month,year]=named,number=months.findIndex(prefix=>month.startsWith(prefix))+1;
   const base=(year||today.slice(0,4))+'-'+String(number).padStart(2,'0');
   if(day)date=base+'-'+day.padStart(2,'0');else period=P.month(base);
   marker=named[0];
  }
  if(date){if(!P.validDate(date))return {words:[text],period:null,amount,currency};period={start:date,end:date};}
  if(marker)text=text.replace(marker,' ').trim();
  const price=text.match(/(?<!\d)(\d{1,3}(?: \d{3})+|\d+)(?:[,.](\d{1,2}))?\s*(₽|руб(?:лей|ля|ль)?\.?|rub|usd|eur|byn|kzt|\$|€)(?!\p{L})/u)
   ||text.match(/^(\d{1,3}(?: \d{3})+|\d+)(?:[,.](\d{1,2}))?$/);
  if(price){
   amount=Number(price[1].replaceAll(' ',''))*100+Number((price[2]||'').padEnd(2,'0'));
   currency=price[3]?({'₽':'RUB','$':'USD','€':'EUR'}[price[3]]||(price[3].startsWith('руб')?'RUB':price[3].toUpperCase())):null;
   text=text.replace(price[0],' ').trim();
  }
  return {words:text.split(/\s+/).filter(Boolean),period,amount,currency};
 }
 function matches(entry,query,currency){
  if(!['expense','income'].includes(entry.type))return false;
  if(query.period&&(entry.date<query.period.start||entry.date>query.period.end))return false;
  if(query.amount!==null&&(entry.amount!==query.amount||query.currency&&currency!==query.currency))return false;
  const haystack=norm([entry.title,entry.note,entry.notes,entry.category].filter(Boolean).join(' '));
  return query.words.every(word=>haystack.includes(word));
 }
 const api={norm,parse,matches};root.MonoSearch=api;
 if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
