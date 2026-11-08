(function(root){
'use strict';
const small={один:1,одна:1,одну:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,двадцать:20,тридцать:30,сорок:40,пятьдесят:50,шестьдесят:60,семьдесят:70,восемьдесят:80,девяносто:90,сто:100};
const number='(?:\\d{1,4}|(?:'+Object.keys(small).join('|')+')(?:\\s+(?:'+Object.keys(small).join('|')+'))?)';
const months={января:0,февраля:1,марта:2,апреля:3,мая:4,июня:5,июля:6,августа:7,сентября:8,октября:9,ноября:10,декабря:11};
const ordUnits={первого:1,второго:2,третьего:3,четвертого:4,пятого:5,шестого:6,седьмого:7,восьмого:8,девятого:9};
const ordSingle={десятого:10,одиннадцатого:11,двенадцатого:12,тринадцатого:13,четырнадцатого:14,пятнадцатого:15,шестнадцатого:16,семнадцатого:17,восемнадцатого:18,девятнадцатого:19,двадцатого:20,тридцатого:30};
const weekdays={понедельник:1,вторник:2,среду:3,четверг:4,пятницу:5,субботу:6,воскресенье:0};
const ordWord='(?:(?:двадцать|тридцать)\\s+)?(?:'+Object.keys(ordUnits).join('|')+'|четвёртого)|'+Object.keys(ordSingle).join('|');
const dayTok='(?:\\d{1,2}(?:\\s?-?\\s?(?:го|е|ое))?|'+ordWord+')',monthTok='(?:'+Object.keys(months).join('|')+')';
const absolute='(?:(?:в|на|за|от)\\s+)?'+dayTok+'\\s+'+monthTok+'(?:\\s+\\d{4}(?:\\s+года)?)?|(?:(?:в|на|за|от)\\s+)?'+dayTok+'\\s+числа|\\d{1,2}[./]\\d{1,2}[./](?:\\d{4}|\\d{2})|(?:в\\s+(?:прошл(?:ую|ый|ое)\\s+)?|прошл(?:ую|ый|ое)\\s+)(?:'+Object.keys(weekdays).join('|')+')';
const source='(?<![\\p{L}\\d])(?:'+absolute+'|позавчера|вчера|сегодня|(?:'+number+'\\s+)?(?:день|дня|дней|неделю|недели|недель|месяц|месяца|месяцев)\\s+назад)(?!\\p{L})';
function offset(marker){if(marker==='сегодня')return {days:0};if(marker==='вчера')return {days:1};if(marker==='позавчера')return {days:2};const unit=marker.match(/день|дня|дней|неделю|недели|недель|месяц/)[0],words=marker.slice(0,marker.indexOf(unit)).trim(),n=words?words.split(/\s+/).reduce((sum,w)=>sum+(small[w]??Number(w)),0):1;if(!Number.isInteger(n)||n<1||n>3650)throw Error('Уточните, сколько дней прошло.');return /месяц/.test(unit)?{months:n}:{days:n*(/недел/.test(unit)?7:1)};}
function dayOf(tok){tok=tok.replace(/ё/g,'е').trim();if(/^\d/.test(tok))return Number(tok.match(/^\d+/)[0]);let n=0;for(const w of tok.split(/\s+/)){if(w==='двадцать')n+=20;else if(w==='тридцать')n+=30;else if(w==='четвертого')n+=4;else n+=ordUnits[w]??ordSingle[w]??0;}return n;}
function build(y,m,d){const x=new Date(y,m,d,12,0,0,0);if(x.getFullYear()!==y||x.getMonth()!==m||x.getDate()!==d)throw Error('Проверьте дату: такой даты нет.');return x;}
function absoluteDate(now,marker){const t=marker.toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim(),today=new Date(now);today.setHours(12,0,0,0);
 let m=t.match(/(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})$/);if(m){const y=m[3].length===2?2000+Number(m[3]):Number(m[3]);return build(y,Number(m[2])-1,Number(m[1]));}
 m=t.match(new RegExp('(?:^|\\s)(?:прошл(?:ую|ый|ое)\\s+)?('+Object.keys(weekdays).join('|')+')$'));if(m&&/(?:^|\s)(?:в|прошл)/.test(t)){const target=weekdays[m[1]];let back=(today.getDay()-target+7)%7;if(back===0)back=7;const x=new Date(today);x.setDate(x.getDate()-back);return x;}
 m=t.match(new RegExp('^(?:(?:в|на|за|от)\\s+)?('+dayTok.replace(/ё/g,'е')+')\\s+('+monthTok+')(?:\\s+(\\d{4}))?'));if(m){const d=dayOf(m[1]),mo=months[m[2]];if(m[3])return build(Number(m[3]),mo,d);let x=build(today.getFullYear(),mo,d);if(x>today)x=build(today.getFullYear()-1,mo,d);return x;}
 m=t.match(new RegExp('^(?:(?:в|на|за|от)\\s+)?('+dayTok.replace(/ё/g,'е')+')\\s+числа'));if(m){const d=dayOf(m[1]);let y=today.getFullYear(),mo=today.getMonth();if(d>today.getDate()){mo--;if(mo<0){mo=11;y--;}}return build(y,mo,d);}
 return null;}
function past(now,marker){const abs=absoluteDate(now,marker);if(abs)return abs;const distance=offset(marker),date=new Date(now);date.setHours(12,0,0,0);if(distance.months){const day=date.getDate();date.setDate(1);date.setMonth(date.getMonth()-distance.months);date.setDate(Math.min(day,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));}else date.setDate(date.getDate()-distance.days);return date;}
function clauses(text,now,hasAmount=s=>/\d/.test(s)){
const parts=text.split(/(;|\n|,(?!\d)|\.\s+(?=[\p{L}])|(?<!\d)\.(?!\d)|\s+(?:и(?!\s+(?:белое|белом|точка|дитя)(?!\p{L}))|а)\s+)/iu),records=[];let active=new Date(now);
for(let i=0;i<parts.length;i+=2){const chunk=parts[i].trim();if(chunk){const markers=[...chunk.matchAll(new RegExp(source,'giu'))];try{if(!markers.length)records.push({text:chunk,now:new Date(active)});else if(markers.length===1){const m=markers[0];const before=chunk.slice(0,m.index).trim(),after=chunk.slice(m.index+m[0].length).trim();
if(hasAmount(before)&&hasAmount(after)&&/^(?:утром|вечером|днем|ещ[её]|купил|заказал|оплатил|потратил|получил|заправил)/u.test(after)){
 records.push({text:before,now:new Date(active)});
 active=past(now,m[0]);records.push({text:after,now:new Date(active)});
}else{
 active=past(now,m[0]);records.push({text:(before+' '+after).trim(),now:new Date(active)});
}}else{const prefix=!hasAmount(chunk.slice(0,markers[0].index));for(let n=0;n<markers.length;n++){const m=markers[n],start=prefix?m.index+m[0].length:n?markers[n-1].index+markers[n-1][0].length:0,end=prefix?markers[n+1]?.index??chunk.length:m.index;let body=chunk.slice(start,end).trim();if(prefix&&n===0)body=chunk.slice(0,m.index)+' '+body;if(!body.trim())throw Error('Назовите одну дату для каждой операции.');active=past(now,m[0]);records.push({text:body,now:new Date(active)});}if(!prefix){const tail=chunk.slice(markers.at(-1).index+markers.at(-1)[0].length).trim();if(tail)records.push({text:tail,now:new Date(active)});}}}catch(e){records.push({error:e.message,text:chunk,now:new Date(now)});}}if(chunk&&records.length)records.at(-1).boundary=parts[i+1];if(/[.;\n]/.test(parts[i+1]||''))active=new Date(now);}
// A label before a comma or a leading verb before “и” can belong to the next amount.
const merged=[];
for(let i=0;i<records.length;i++){
 const current=records[i],next=records[i+1];
 if(next&&!current.error&&!next.error&&current.now.toDateString()===next.now.toDateString()&&!hasAmount(current.text)&&hasAmount(next.text)&&(!current.boundary||/^(?:,|\s+и\s+)$/iu.test(current.boundary))){
  merged.push({...next,text:[current.text,next.text].filter(Boolean).join(' ')});i++;
 }else merged.push(current);
}
return merged;
}
const api={clauses,past};root.MonoSpeechDates=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
