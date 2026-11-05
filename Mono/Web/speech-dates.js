(function(root){
'use strict';
const small={один:1,одна:1,одну:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,двадцать:20,тридцать:30,сорок:40,пятьдесят:50,шестьдесят:60,семьдесят:70,восемьдесят:80,девяносто:90,сто:100};
const number='(?:\\d{1,4}|(?:'+Object.keys(small).join('|')+')(?:\\s+(?:'+Object.keys(small).join('|')+'))?)';
const source='(?<![\\p{L}\\d])(?:позавчера|вчера|сегодня|(?:'+number+'\\s+)?(?:день|дня|дней|неделю|недели|недель|месяц|месяца|месяцев)\\s+назад)(?!\\p{L})';
function offset(marker){if(marker==='сегодня')return {days:0};if(marker==='вчера')return {days:1};if(marker==='позавчера')return {days:2};const unit=marker.match(/день|дня|дней|неделю|недели|недель|месяц/)[0],words=marker.slice(0,marker.indexOf(unit)).trim(),n=words?words.split(/\s+/).reduce((sum,w)=>sum+(small[w]??Number(w)),0):1;if(!Number.isInteger(n)||n<1||n>3650)throw Error('Уточните, сколько дней прошло.');return /месяц/.test(unit)?{months:n}:{days:n*(/недел/.test(unit)?7:1)};}
function past(now,marker){const distance=offset(marker),date=new Date(now);date.setHours(12,0,0,0);if(distance.months){const day=date.getDate();date.setDate(1);date.setMonth(date.getMonth()-distance.months);date.setDate(Math.min(day,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));}else date.setDate(date.getDate()-distance.days);return date;}
function clauses(text,now,hasAmount=s=>/\d/.test(s)){
const parts=text.split(/(;|\n|,(?!\d)|\.\s+(?=[\p{L}])|(?<!\d)\.(?!\d)|\s+(?:и(?!\s+(?:белое|белом|точка|дитя)(?!\p{L}))|а)\s+)/iu),records=[];let active=new Date(now);
for(let i=0;i<parts.length;i+=2){const chunk=parts[i].trim();if(chunk){const markers=[...chunk.matchAll(new RegExp(source,'giu'))];try{if(!markers.length)records.push({text:chunk,now:new Date(active)});else if(markers.length===1){const m=markers[0];active=past(now,m[0]);records.push({text:(chunk.slice(0,m.index)+' '+chunk.slice(m.index+m[0].length)).replace(/\s+/g,' ').trim(),now:new Date(active)});}else{const prefix=!hasAmount(chunk.slice(0,markers[0].index));for(let n=0;n<markers.length;n++){const m=markers[n],start=prefix?m.index+m[0].length:n?markers[n-1].index+markers[n-1][0].length:0,end=prefix?markers[n+1]?.index??chunk.length:m.index;let body=chunk.slice(start,end).trim();if(prefix&&n===0)body=chunk.slice(0,m.index)+' '+body;if(!body.trim())throw Error('Назовите одну дату для каждой операции.');active=past(now,m[0]);records.push({text:body,now:new Date(active)});}if(!prefix){const tail=chunk.slice(markers.at(-1).index+markers.at(-1)[0].length).trim();if(tail)records.push({text:tail,now:new Date(active)});}}}catch(e){records.push({error:e.message,text:chunk,now:new Date(now)});}}if(chunk&&records.length)records.at(-1).boundary=parts[i+1];if(/[.;\n]/.test(parts[i+1]||''))active=new Date(now);}
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
