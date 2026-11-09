(function(root){
'use strict';
// Голосовые команды Моно: вклад, цель, пополнение цели, перевод между счетами, лимит,
// обязательный платёж, напоминание, новый счёт, новая категория.
// parse(text,ctx) только разбирает фразу и ничего не меняет; формы открывает run() внизу файла.

// ---------- числа ----------
const U={ноль:0,один:1,одна:1,одну:1,одного:1,одной:1,два:2,две:2,двух:2,три:3,трех:3,четыре:4,четырех:4,пять:5,пяти:5,шесть:6,шести:6,семь:7,семи:7,восемь:8,восьми:8,девять:9,девяти:9,десять:10,десяти:10,одиннадцать:11,одиннадцати:11,двенадцать:12,двенадцати:12,тринадцать:13,тринадцати:13,четырнадцать:14,четырнадцати:14,пятнадцать:15,пятнадцати:15,шестнадцать:16,шестнадцати:16,семнадцать:17,семнадцати:17,восемнадцать:18,восемнадцати:18,девятнадцать:19,девятнадцати:19,двадцать:20,двадцати:20,тридцать:30,тридцати:30,сорок:40,сорока:40,пятьдесят:50,пятидесяти:50,шестьдесят:60,шестидесяти:60,семьдесят:70,семидесяти:70,восемьдесят:80,восьмидесяти:80,девяносто:90,девяноста:90,сто:100,ста:100,двести:200,двухсот:200,триста:300,трехсот:300,четыреста:400,четырехсот:400,пятьсот:500,пятисот:500,шестьсот:600,шестисот:600,семьсот:700,семисот:700,восемьсот:800,восьмисот:800,девятьсот:900,девятисот:900,полтора:1.5,полторы:1.5,полтораста:150,полмиллиона:5e5,полтысячи:500,полтыщи:500,полтинник:50,полтинника:50,сотка:100,сотку:100,сотню:100,стольник:100,стольника:100,пятихатка:500,пятихатку:500,пятихатки:500};
const M={тысяча:1e3,тысячи:1e3,тысяч:1e3,тысячу:1e3,тысячам:1e3,тыс:1e3,тыща:1e3,тыщи:1e3,тыщ:1e3,тыщу:1e3,штука:1e3,штуки:1e3,штук:1e3,штуку:1e3,косарь:1e3,косаря:1e3,косарей:1e3,миллион:1e6,миллиона:1e6,миллионов:1e6,млн:1e6,лимон:1e6,лимона:1e6,лимонов:1e6,лям:1e6,ляма:1e6,лямов:1e6,миллиард:1e9,миллиарда:1e9,млрд:1e9};
const TOKEN=/\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?[кk](?![а-яa-z\d])|\d+(?:[.,]\d+)?|[а-я]+/g;
const AFTER_UNIT=/^\s*(?:%|процент|мес(?![а-яa-z0-9])|месяц|год|лет(?![а-яa-z0-9])|недел|дн|день|числ|раз(?![а-яa-z0-9])|-?го(?![а-яa-z0-9]))/;
function tokens(n){const out=[];let m;TOKEN.lastIndex=0;while((m=TOKEN.exec(n))){const w=m[0];let t=null;
 if(/^\d/.test(w)){const k=/[кk]$/.test(w);const v=Number(w.replace(/[кk]$/,'').replace(/[ \u00a0]/g,'').replace(',','.'));t={type:'digit',v:k?v*1000:v};}
 else if(w in U)t={type:'num',v:U[w]};else if(w in M)t={type:'mult',v:M[w]};else if(w==='половиной'||w==='половиною')t={type:'half'};else if(w==='с')t={type:'with'};
 out.push({w,s:m.index,e:m.index+w.length,t});}return out;}
// все числовые выражения: [{start,end,value}]
function numbers(n){
 const tk=tokens(n),res=[];let run=null;
 const close=()=>{if(!run)return;
  let toks=run.toks;
  // «сто тысяч шесть процентов»: хвост после тысяч принадлежит следующему слову
  const tail=n.slice(toks[toks.length-1].e);
  if(AFTER_UNIT.test(tail)){let k=-1;for(let i=toks.length-1;i>=0;i--)if(toks[i].t.type==='mult'){k=i;break;}if(k>=0&&k<toks.length-1){const rest=toks.slice(k+1);toks=toks.slice(0,k+1);push(toks);push(rest);run=null;return;}}
  push(toks);run=null;};
 const push=toks=>{let total=0,cur=0;for(const x of toks){if(x.t.type==='num'||x.t.type==='digit')cur+=x.t.v;else if(x.t.type==='mult'){total+=(cur||1)*x.t.v;cur=0;}else if(x.t.type==='half')cur+=.5;}
  res.push({start:toks[0].s,end:toks[toks.length-1].e,value:Math.round((total+cur)*1000)/1000});};
 for(let i=0;i<tk.length;i++){const x=tk[i],t=x.t;
  if(!t){close();continue;}
  if(t.type==='with'){const nx=tk[i+1];if(run&&nx&&nx.t?.type==='half'&&/^\s+$/.test(n.slice(x.e,nx.s))){run.toks.push(nx);run.last=nx.e;i++;continue;}close();continue;}
  if(t.type==='half'){close();continue;}
  const gapOk=run&&/^[\s\-]*$/.test(n.slice(run.last,x.s));
  if(run&&gapOk&&!(t.type==='digit')&&!(run.toks[run.toks.length-1].t.type==='digit'&&t.type==='num')){run.toks.push(x);run.last=x.e;continue;}
  if(run&&gapOk&&t.type==='mult'){run.toks.push(x);run.last=x.e;continue;}
  close();run={toks:[x],last:x.e};
 }
 close();
 // одиночные множители без числа («тысяча») оставляем; «к» отдельно не бывает
 return res;
}
const overlaps=(a,b)=>a.start<b.end&&b.start<a.end;
const CUR=[[/доллар|usd|\$/,'USD'],[/евро|eur|€/,'EUR'],[/юан|cny/,'CNY'],[/тенге|kzt/,'KZT'],[/фунт|gbp/,'GBP'],[/дирхам|aed/,'AED'],[/лир[аыу]|try/,'TRY'],[/лари|gel/,'GEL'],[/драм|amd/,'AMD'],[/руб|₽|рубл/,'RUB']];
const currencyIn=n=>{for(const [re,c] of CUR)if(re.test(n))return c;return null;};

// ---------- даты и время ----------
const pad=x=>String(x).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const day0=d=>{const x=new Date(d);x.setHours(12,0,0,0);return x;};
const addDays=(d,k)=>{const x=day0(d);x.setDate(x.getDate()+k);return x;};
function addMonths(d,k){const x=day0(d),day=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+k);x.setDate(Math.min(day,new Date(x.getFullYear(),x.getMonth()+1,0).getDate()));return x;}
const MONTHS={января:0,февраля:1,марта:2,апреля:3,мая:4,июня:5,июля:6,августа:7,сентября:8,октября:9,ноября:10,декабря:11};
const WEEKDAYS={понедельник:1,вторник:2,среду:3,четверг:4,пятницу:5,субботу:6,воскресенье:0,понедельника:1,вторника:2,среды:3,четверга:4,пятницы:5,субботы:6,воскресенья:0};
const ORD=(()=>{const o={};const ones=['перв','втор','трет','четверт','пят','шест','седьм','восьм','девят'];ones.forEach((b,i)=>{const ends=b==='трет'?['ий','ья','ье','ьего','ьей','ьем']:['ый','ой','ая','ое','ого','ом','ую'];ends.forEach(e=>o[b+e]=i+1);});
 [['десят',10],['одиннадцат',11],['двенадцат',12],['тринадцат',13],['четырнадцат',14],['пятнадцат',15],['шестнадцат',16],['семнадцат',17],['восемнадцат',18],['девятнадцат',19],['двадцат',20],['тридцат',30]].forEach(([b,v])=>['ый','ой','ая','ое','ого','ом','ую','ое'].forEach(e=>o[b+e]=v));
 return o;})();
const ORD_RE='(?:(?:двадцать|тридцать)\\s+)?(?:'+Object.keys(ORD).sort((a,b)=>b.length-a.length).join('|')+')';
const DAY_RE='(?:\\d{1,2}(?:\\s?-?\\s?(?:го|е|ое|ого|ым)?)(?![\\d:])|'+ORD_RE+')';
function dayOf(tok){tok=tok.trim();if(/^\d/.test(tok))return Number(tok.match(/^\d+/)[0]);let v=0;for(const w of tok.split(/\s+/)){if(w==='двадцать')v+=20;else if(w==='тридцать')v+=30;else v+=ORD[w]||0;}return v;}
const MONTH_RE='(?:'+Object.keys(MONTHS).join('|')+')';
const WD_RE='(?:'+Object.keys(WEEKDAYS).sort((a,b)=>b.length-a.length).join('|')+')';
const HOURW={час:1,один:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,двадцать:20,ноль:0};
const HOUR_RE='(?:двадцать\\s+(?:один|два|три|четыре)|'+Object.keys(HOURW).sort((a,b)=>b.length-a.length).join('|')+')';
const hourVal=w=>{w=w.trim();const m=w.match(/^двадцать\s+(один|два|три|четыре)$/);return m?20+HOURW[m[1]]:HOURW[w];};
const MINW={ноль:0,пять:5,десять:10,пятнадцать:15,двадцать:20,тридцать:30,сорок:40,пятьдесят:50,одну:1,две:2,три:3,четыре:4,шесть:6,семь:7,восемь:8,девять:9,один:1,два:2};
const MIN_RE='(?:ноль\\s+(?:ноль|пять|[1-9])|(?:двадцать|тридцать|сорок|пятьдесят|десять|пятнадцать)(?:\\s+(?:один|два|три|четыре|пять|шесть|семь|восемь|девять))?|одиннадцать|двенадцать|тринадцать|четырнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|[0-5]?\\d)';
function minVal(w){w=w.trim();if(/^\d+$/.test(w))return Number(w);const t={пяти:5,десяти:10,пятнадцати:15,двадцати:20,'двадцати пяти':25,двух:2,трех:3,четырех:4,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19};if(w in t)return t[w];let v=0;for(const x of w.split(/\s+/))v+=(x in MINW?MINW[x]:0);return v;}
const ORD_HOUR={первого:1,второго:2,третьего:3,четвертого:4,пятого:5,шестого:6,седьмого:7,восьмого:8,девятого:9,десятого:10,одиннадцатого:11,двенадцатого:12};
const ORD_HOUR_RE='(?:'+Object.keys(ORD_HOUR).join('|')+')';
function dayPart(h,part,ref){ // ref: сегодня ли дата
 if(part==='утра'){return h===12?0:h;}
 if(part==='дня'){return h>=1&&h<=6?h+12:h;}
 if(part==='вечера'){return h<12?h+12:h===12?0:h;}
 if(part==='ночи'){return h===12?0:h>=6?h+12:h;}
 return h;}
// возвращает {date,time,spans,rel} — spans относятся к строке n
function parseWhen(n,now=new Date()){
 const spans=[],out={date:null,time:null,spans,rel:false,partial:false};
 const taken=(s,e)=>spans.some(x=>s<x.end&&x.start<e);
 const mark=(s,e)=>spans.push({start:s,end:e});
 const nums=numbers(n);
 const base=day0(now);
 // --- «через …»
 for(const m of n.matchAll(/(?<![а-я])через\s+/g)){
  const p=m.index+m[0].length,rest=n.slice(p);let mm,k=null,end=p;
  if((mm=rest.match(/^(?:полчаса|пол\s?часа)(?![а-я])/)))k={min:30};
  else if((mm=rest.match(/^(?:полтора|полторы)\s+час[а-яa-z0-9_]*/)))k={min:90};
  else if((mm=rest.match(/^пару\s+(минут|часов|дней|недель|месяцев)(?![а-я])/)))k=unitShift(mm[1],2);
  else if((mm=rest.match(/^(минуту|час|день|неделю|месяц|год|полгода)(?![а-я])/)))k=unitShift(mm[1],1);
  else{const num=nums.find(x=>x.start===p);if(num){const after=n.slice(num.end),um=after.match(/^\s*(минут[а-яa-z0-9_]*|мин(?![а-яa-z0-9])\.?|часа|часов|час(?![а-я])|ч(?![а-яa-z0-9])|дн[а-яa-z0-9_]*|день|недел[а-яa-z0-9_]*|месяц[а-яa-z0-9_]*|год[а-яa-z0-9_]*|лет(?![а-яa-z0-9]))/);if(um){k=unitShift(um[1],num.value);mm=[n.slice(p,num.end+um[0].length)];}}}
  if(k){end=p+mm[0].length;if(!taken(m.index,end)){mark(m.index,end);if(k.min){const d=new Date(now.getTime()+k.min*60000);out.date=iso(d);out.time=pad(d.getHours())+':'+pad(d.getMinutes());out.rel=true;}else if(k.days!==undefined){out.date=iso(addDays(base,k.days));}else if(k.months!==undefined){out.date=iso(addMonths(base,k.months));}}}
 }
 function unitShift(u,v){if(/^мин/.test(u))return{min:v};if(/^(час|ч$)/.test(u))return{min:v*60};if(/^дн|^день/.test(u))return{days:v};if(/^недел/.test(u))return{days:v*7};if(/^месяц/.test(u))return{months:v};if(/^полгода/.test(u))return{months:6};if(/^год|^лет/.test(u))return{months:12*v};return null;}
 // --- время суток
 if(!out.rel||out.time===null){
  let t=null,m;
  const re=[
   [new RegExp('(?<![а-я\\d:.])(?:в|к|на|около|ровно)?\\s*([01]?\\d|2[0-3]):([0-5]\\d)(?!\\d)(?:\\s*(утра|дня|вечера|ночи))?','g'),mm=>({h:+mm[1],m:+mm[2],p:mm[3]})],
   [new RegExp('(?<![а-я\\d])(?:в|к)\\s+([01]?\\d|2[0-3])[.\\-]([0-5]\\d)(?![\\d.])(?:\\s*(утра|дня|вечера|ночи))?','g'),mm=>({h:+mm[1],m:+mm[2],p:mm[3]})],
   [new RegExp('(?<![а-я])(?:в|к)\\s+(?:половине|половину|пол)\\s*('+ORD_HOUR_RE+')(?:\\s+(утра|дня|вечера|ночи))?','g'),mm=>({h:(ORD_HOUR[mm[1]]+11)%12||12,m:30,p:mm[2],ordinal:ORD_HOUR[mm[1]]})],
   [new RegExp('(?<![а-я])(?:в|к)\\s+четверть\\s+('+ORD_HOUR_RE+')(?:\\s+(утра|дня|вечера|ночи))?','g'),mm=>({h:(ORD_HOUR[mm[1]]+11)%12||12,m:15,p:mm[2]})],
   [new RegExp('(?<![а-я])без\\s+('+MIN_RE+'|пяти|десяти|пятнадцати|двадцати|двадцати\\s+пяти|двух|трех|четырех)\\s*(?:минут[а-яa-z0-9_]*\\s+)?('+HOUR_RE+'|\\d{1,2})(?:\\s+(утра|дня|вечера|ночи))?','g'),mm=>{const h=/^\d/.test(mm[2])?+mm[2]:hourVal(mm[2]);return{h:(h+23)%24,m:60-minVal(mm[1]),p:mm[3]};}],
   [new RegExp('(?<![а-я\\d])(?:в|к)\\s+('+HOUR_RE+'|\\d{1,2})(?![\\d:.,]|\\s*(?:%|процент|руб|₽|тыс|раз|месяц|год|лет|дней|недел|числ|-?го))(?:\\s+час(?:а|ов)?(?![а-я]))?(?:\\s+('+MIN_RE+')(?![а-я\\d])(?:\\s+минут[а-яa-z0-9_]*)?)?(?:\\s+(утра|дня|вечера|ночи))?','g'),mm=>{const h=/^\d/.test(mm[1])?+mm[1]:hourVal(mm[1]);return{h,m:mm[2]?minVal(mm[2]):0,p:mm[3]};}]
  ];
  for(const [r,f] of re){for(const mm of n.matchAll(r)){if(taken(mm.index,mm.index+mm[0].length))continue;const v=f(mm);if(v.h>24||v.h<0||v.m>59)continue;if(v.h===24)v.h=0;t=v;mark(mm.index,mm.index+mm[0].length);break;}if(t)break;}
  if(t){const h=t.ordinal?t.h:t.h;let hh=h;
   if(t.p)hh=dayPart(h,t.p);
   else if(h>=1&&h<=12&&!/:/.test('')){t.ambiguous=true;}
   out.time=pad(hh)+':'+pad(t.m);out.ambiguous=!t.p&&t.h<=12&&t.h>=1&&!t.ordinal?t.h:(t.ordinal&&!t.p?t.h:null);}
  else{
   const named=[[/(?<![а-я])(?:в\s+)?полдень(?![а-я])/,'12:00'],[/(?<![а-я])(?:в\s+)?полночь(?![а-я])/,'00:00'],[/(?<![а-я])(?:в\s+)?обед(?![а-я])/,'13:00'],[/(?<![а-я])после\s+обеда/,'15:00'],[/(?<![а-я])рано\s+утром/,'07:00'],[/(?<![а-я])(?:с\s+)?утра(?![а-я])|(?<![а-я])утром(?![а-я])/,'09:00'],[/(?<![а-я])(?:днем|днём)(?![а-я])/,'14:00'],[/(?<![а-я])вечером(?![а-я])/,'19:00'],[/(?<![а-я])ночью(?![а-я])/,'23:00']];
   for(const [r,v] of named){m=r.exec(n);if(m&&!taken(m.index,m.index+m[0].length)){mark(m.index,m.index+m[0].length);out.time=v;out.named=true;break;}}
  }
 }
 // --- дата
 if(out.date===null||out.rel){
  let m,d=null;const free=(mm)=>!taken(mm.index,mm.index+mm[0].length);
  const find=(re,f)=>{if(d)return;for(const mm of n.matchAll(re)){if(!free(mm))continue;const v=f(mm);if(v){d=v;mark(mm.index,mm.index+mm[0].length);return;}}};
  find(/(?<![а-я])послезавтра(?![а-я])/g,()=>addDays(base,2));
  find(/(?<![а-я])завтра(?![а-я])/g,()=>addDays(base,1));
  find(/(?<![а-я])сегодня(?![а-я])/g,()=>base);
  find(/(?<![а-я])(?:на\s+)?следующей\s+неделе(?![а-я])/g,()=>addDays(base,7));
  find(/(?<![а-я])(?:в\s+)?следующем\s+месяце(?![а-я])/g,()=>addMonths(base,1));
  find(/(?<![а-я])(?:в\s+|на\s+)?(?:конце|конец)\s+месяца(?![а-я])/g,()=>new Date(base.getFullYear(),base.getMonth()+1,0,12));
  find(/(?<![а-я])до\s+конца\s+года(?![а-я])|(?<![а-я])(?:в\s+)?конце\s+года(?![а-я])/g,()=>new Date(base.getFullYear(),11,31,12));
  find(/(?<![а-я])(?:в|на)\s+выходные(?![а-я])/g,()=>{const k=(6-base.getDay()+7)%7||7;return addDays(base,k);});
  find(new RegExp('(?<![а-я])(?:(?:в|на|во)\\s+)?(?:(следующ[а-яa-z0-9_]+|эт[а-яa-z0-9_]+|ближайш[а-яa-z0-9_]+)\\s+)?('+WD_RE+')(?![а-я])','g'),mm=>{const target=WEEKDAYS[mm[2]];let k=(target-base.getDay()+7)%7;if(k===0)k=7;if(/следующ/.test(mm[1]||'')&&k<=7-base.getDay()%7&&false)k+=7;return addDays(base,k);});
  find(new RegExp('(?<![\\d.])(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{4}|\\d{2}))?(?![\\d.]\\d)','g'),mm=>{const dd=+mm[1],mo=+mm[2]-1;if(dd<1||dd>31||mo<0||mo>11)return null;let y=mm[3]?(mm[3].length===2?2000+ +mm[3]:+mm[3]):base.getFullYear();let x=new Date(y,mo,dd,12);if(x.getMonth()!==mo)return null;if(!mm[3]&&x<base)x=new Date(y+1,mo,dd,12);return x;});
  find(new RegExp('(?<![а-я\\d])(?:(?:в|на|до|от|с)\\s+)?('+DAY_RE+')\\s+('+MONTH_RE+')(?:\\s+(\\d{4}))?','g'),mm=>{const dd=dayOf(mm[1]),mo=MONTHS[mm[2]];if(!dd)return null;let y=mm[3]?+mm[3]:base.getFullYear();let x=new Date(y,mo,dd,12);if(x.getMonth()!==mo)return null;if(!mm[3]&&x<base)x=new Date(y+1,mo,dd,12);return x;});
  find(new RegExp('(?<![а-я\\d])(?:(?:в|на|до|каждого|каждое|каждый)\\s+)?('+DAY_RE+')\\s+числа|(?<![а-я])(?:(?:каждого|каждое|каждый)\\s+)('+ORD_RE+')(?![а-я])(?:\\s+числ[а-яa-z0-9_]+)?|(?<![а-я])('+ORD_RE+')\\s+число(?![а-я])','g'),mm=>{const dd=dayOf(mm[1]||mm[2]||mm[3]);if(!dd||dd>31)return null;let x=new Date(base.getFullYear(),base.getMonth(),Math.min(dd,new Date(base.getFullYear(),base.getMonth()+1,0).getDate()),12);if(x<base)x=new Date(base.getFullYear(),base.getMonth()+1,Math.min(dd,new Date(base.getFullYear(),base.getMonth()+2,0).getDate()),12);return x;});
  if(d){out.date=iso(d);out.dateExplicit=true;}
 }
 // --- согласование времени и даты
 if(out.time&&!out.rel){
  const h=Number(out.time.slice(0,2)),mi=out.time.slice(3);
  const today=iso(base);
  if(out.date===null){
   // только время: сегодня, если ещё не прошло, иначе завтра
   let cand=new Date(now);cand.setHours(h,Number(mi),0,0);
   if(out.ambiguous&&cand<=now&&h<12){const pm=new Date(now);pm.setHours(h+12,Number(mi),0,0);if(pm>now){cand=pm;out.time=pad(h+12)+':'+mi;}}
   out.date=cand>now?today:iso(addDays(base,1));
  }else if(out.date===today&&out.ambiguous&&h<12){const c=new Date(now);c.setHours(h,Number(mi),0,0);if(c<=now&&h+12<24){const pm=new Date(now);pm.setHours(h+12,Number(mi),0,0);if(pm>now)out.time=pad(h+12)+':'+mi;}}
 }
 spans.sort((a,b)=>a.start-b.start);
 return out;
}

// ---------- общие помощники ----------
const BANKS={сбере:'Сбер',сбер:'Сбер',сбербанке:'Сбербанк',втб:'ВТБ',альфе:'Альфа-Банк','альфа-банке':'Альфа-Банк',альфабанке:'Альфа-Банк',тинькофф:'Т-Банк',тинькоффе:'Т-Банк',тинькофе:'Т-Банк',т:'Т-Банк','т-банке':'Т-Банк',газпромбанке:'Газпромбанк',райффайзене:'Райффайзен',райффайзен:'Райффайзен',почте:'Почта Банк',мтс:'МТС Банк',озоне:'Озон Банк',яндексе:'Яндекс Банк',совкомбанке:'Совкомбанк',открытии:'Банк Открытие',россельхозбанке:'Россельхозбанк',пСБ:'ПСБ',псб:'ПСБ',хоум:'Хоум Банк',русском:'Русский стандарт',уралсибе:'Уралсиб'};
function bankName(raw){const t=String(raw||'').trim().replace(/\s+банк\w*$/i,'').trim();const k=t.toLowerCase().replace(/ё/g,'е');if(BANKS[k])return BANKS[k];if(/^[тp]\s*банк/i.test(raw))return 'Т-Банк';const full=String(raw).trim();return cap(full.replace(/(?<=[а-я]{3})(банке)$/i,'банк'));}
const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е');
function removeSpans(src,spans){const list=spans.slice().sort((a,b)=>a.start-b.start);let out='',pos=0;for(const s of list){if(s.start<pos){if(s.end>pos)pos=s.end;continue;}out+=src.slice(pos,s.start)+' ';pos=s.end;}return out+src.slice(pos);}
const tidy=s=>s.replace(/[«»"“”„]/g,' ').replace(/\s+([,.;:!?])/g,'$1').replace(/^[\s,.;:!?\-–—]+|[\s,.;:!?\-–—]+$/g,'').replace(/\s{2,}/g,' ').trim();
const nom=w=>w&&w.length>5?w.replace(/ую$/,'ая').replace(/([бвгджзклмнпрстфхцчшщ])у$/,'$1а'):w;
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
const words=s=>s.split(/\s+/).filter(Boolean);
const stem=w=>norm(w).replace(/[^а-яa-z0-9]/g,'').slice(0,5);
const GENERIC=new Set(['счет','счета','карта','карты','карту','мой','мое','свой','банк']);
function findAccounts(n,accounts=[]){
 const found=[];
 const tk=[...n.matchAll(/[а-яa-z0-9]+/g)];
 for(const a of accounts){
  const ws=words(norm(a.name).replace(/[^а-яa-z0-9\s]/g,' ')).filter(w=>w.length>=3&&!GENERIC.has(w));
  if(!ws.length)continue;
  let best=null;
  for(const w of ws){const st=w.slice(0,5);for(const t of tk){if(t[0].length>=Math.min(w.length,4)&&t[0].startsWith(st.slice(0,Math.min(st.length,w.length<5?w.length:5)))){best=t;break;}}if(best)break;}
  if(!best)continue;
  found.push({id:a.id,name:a.name,index:best.index,end:best.index+best[0].length,currency:a.currency});
 }
 found.splice(0,found.length,...found.filter(f=>!/^\s+вклад/.test(n.slice(f.end))));
 // псевдонимы
 const alias=[[/налич|кэш|кеш|кошел/,/налич|кэш|кеш|кошел/],[/накопит|накоплен/,/накоп/]];
 for(const [re,nameRe] of alias){const m=re.exec(n);if(!m)continue;const a=accounts.find(x=>nameRe.test(norm(x.name)));const e=n.slice(m.index).search(/[\s,.;!?]|$/),wEnd=m.index+(e<0?n.length-m.index:e);if(a&&!found.some(f=>f.id===a.id)&&!/^\s+вклад/.test(n.slice(wEnd))){found.push({id:a.id,name:a.name,index:m.index,end:wEnd,currency:a.currency});}}
 return found.sort((a,b)=>a.index-b.index);
}
const SYN=[['Кафе',/кафе|ресторан|кофе|кофейн|фастфуд|фаст фуд|общепит|доставк[а-яa-z0-9_]* еды/],['Продукты',/продукт|супермаркет|магазин[а-яa-z0-9_]* у дома|еда(?![а-яa-z0-9])|еду(?![а-яa-z0-9])|еде(?![а-яa-z0-9])|пятерочк|магнит(?![а-яa-z0-9])|ашан|перекресток|вкусвилл/],['Транспорт',/транспорт|такси|метро|автобус|проезд|электричк/],['Авто',/(?<![а-яa-z0-9])авто(?![а-яa-z0-9])|автомобил|машин|бензин|заправк|парковк|шиномонтаж|мойк/],['Покупки',/покупк|шопинг/],['Дом',/(?<![а-яa-z0-9])дом(?![а-яa-z0-9])|жкх|коммунал|аренд|квартир|ремонт|мебел/],['Здоровье',/здоровь|аптек|врач|лекарств|медицин|стоматолог|анализ/],['Развлечения',/развлечен|кино|игр[а-яa-z0-9_]+(?![а-яa-z0-9])|досуг|концерт|театр|бар(?![а-яa-z0-9])|клуб/],['Красота',/красот|салон|барбер|маникюр|косметик|парикмахер|стрижк/],['Маркетплейсы',/маркетплейс|вайлдберриз|(?<![а-яa-z0-9])вб(?![а-яa-z0-9])|озон|ozon|wildberries|яндекс маркет|алиэкспресс|aliexpress/],['Связь',/связь|интернет|телефон|мобильн|сотов/],['Одежда и обувь',/одежд|обув|вещи|кроссовк/],['Путешествия',/путешеств|отпуск|поездк|отел|гостиниц|авиабилет|авиа(?![а-яa-z0-9])/],['Подписки',/подписк|нетфликс|netflix|spotify|youtube|ютуб|яндекс плюс|иви(?![а-яa-z0-9])/],['Ставки',/ставк[а-яa-z0-9_]+ на спорт|букмекер|казино|ставки(?![а-яa-z0-9])/],['Питомцы',/питомц|собак|кошк|корм|ветеринар/],['Образование',/образован|курс[а-яa-z0-9_]*(?![а-яa-z0-9])|учеб|школ|универ|репетитор|обучен/],['Спорт',/спорт|фитнес|тренировк|тренажерн/],['Подарки',/подарк|цветы|цветов/],['Работа',/работ[а-яa-z0-9_]+|офис/],['Другое',/другое|прочее|разное/]];
function findCategory(n,list=[]){
 const t=' '+n+' ';
 // сначала названия пользовательских и стандартных категорий целиком или по основе
 let best=null;
 for(const c of list){const cn=norm(c);if(t.includes(' '+cn+' ')||t.includes(' '+cn)){if(!best||cn.length>norm(best).length)best=c;}}
 if(best)return best;
 for(const c of list){const ws=words(norm(c)).filter(w=>w.length>=4);if(ws.length&&ws.every(w=>t.includes(' '+w.slice(0,Math.max(4,w.length-2)))))return c;}
 for(const [c,re] of SYN)if(re.test(n)&&list.includes(c))return c;
 return null;
}
const INCOME_SYN=[['Зарплата',/зарплат|оклад/],['Подработка',/подработ|фриланс/],['Подарки',/подарк/]];
const GOAL_ICON=[['palm',/отпуск|море|курорт|каникул/],['plane',/путешеств|поездк|самолет|билет|тур(?![а-яa-z0-9])|тур\s|заграниц/],['car',/машин|авто|тачк|автомобил/],['home',/квартир|дом(?![а-яa-z0-9])|дача|дачу|ипотек|первоначальн/],['renovation',/ремонт/],['gift',/подарк/],['laptop',/ноутбук|компьютер|макбук|macbook|пк(?![а-яa-z0-9])/],['phone',/телефон|айфон|iphone|смартфон|samsung|самсунг/],['camera',/камер|фотоаппарат/],['ring',/свадьб|кольц/],['study',/учеб|образован|курс|универ|институт/],['bike',/велосипед|мотоцикл|мото(?![а-яa-z0-9])|самокат/],['pet',/питомец|собак|кошк|кот(?![а-яa-z0-9])|щенок|котенок/],['fitness',/спорт|зал(?![а-яa-z0-9])|фитнес/],['safety',/подушк|резерв|запас|на черный день/],['business',/бизнес|своё дело|свое дело|стартап/],['boat',/лодк|яхт|катер/],['appliance',/техник|холодильник|стиральн|телевизор|пылесос/],['heart',/здоровь|лечени|операци/],['music',/музык|гитар|пианино|синтезатор/]];
const iconFor=n=>{for(const [k,re] of GOAL_ICON)if(re.test(n))return k;return null;};

const CREATE='(?:нов(?:ый|ая|ую|ое)|созда[а-яa-z0-9_]*|сдела[а-яa-z0-9_]*|добав[а-яa-z0-9_]*|завед[а-яa-z0-9_]*|заведи[а-яa-z0-9_]*|постав[а-яa-z0-9_]*|откро[а-яa-z0-9_]*|открыть|оформ[а-яa-z0-9_]*|запиш[а-яa-z0-9_]*|внес[а-яa-z0-9_]*|подключ[а-яa-z0-9_]*|хочу|хотел[а-яa-z0-9_]*|давай|надо|нужн[а-яa-z0-9_]*|нужен|нужна|можешь|мне)';
const hasCreate=n=>new RegExp('(?<![а-я])'+CREATE+'(?![а-я])').test(n);
const FILL='(?<![а-я])(?:пожалуйста|плиз|мне|мой|мою|моё|мое|меня|нам|быстро|срочно|давай|ну|а|и|ещё|еще|новый|новую|новое|новая|созда[а-яa-z0-9_]*|сдела[а-яa-z0-9_]*|добав[а-яa-z0-9_]*|завед[а-яa-z0-9_]*|постав[а-яa-z0-9_]*|откро[а-яa-z0-9_]*|открыть|оформ[а-яa-z0-9_]*|запиш[а-яa-z0-9_]*|хочу|хотел[а-яa-z0-9_]*|надо|нужн[а-яa-z0-9_]*|можешь|можно|пожелай)(?![а-я])';

// ---------- команды ----------
function reminder(c){
 const {n,src,now}=c;
 const trig=/(?<![а-я])(?:напомни(?:те)?|напоминани[а-яa-z0-9_]*|напоминалк[а-яa-z0-9_]*|не\s+забуд[а-яa-z0-9_]*|не\s+дай\s+(?:мне\s+)?забыть|будильник[а-яa-z0-9_]*|оповести|уведоми|(?:можешь|прошу|хочу|нужно|надо|поставь)\s+напомнить)(?![а-я])/;
 if(!trig.test(n))return null;
 // «платёж … каждый месяц» — это обязательный платёж, а не напоминание
 if(/(?<![а-я])платеж/.test(n)&&hasCreate(n)&&!/(?<![а-я])(?:напомни(?:те)?|напоминани[ея]|напоминалк[а-я]*|не\s+забудь)(?![а-я])/.test(n))return null;
 const w=parseWhen(n,now);
 const rest=removeSpans(src,w.spans.map(s=>{const m=/(?:^|\s)(?:на|в|во|к|до|около|ровно|с|со)\s+$/.exec(n.slice(0,s.start));return {start:m?s.start-m[0].replace(/^\s/,'').length:s.start,end:s.end};}));
 let text=rest;
 text=text.replace(/(?<![а-я])(?:пожалуйста|плиз|мне|меня|нам|нас|мой|ну|давай|быстро|срочно|добавь|добавить|создай|создать|сделай|сделать|поставь|поставить|запиши|записать|оформи|заведи|завести|новое|новую|новый|напомни(?:те)?|напомнить|напоминани[еяюе]|напоминалк[а-яa-z0-9_]*|не\s+забудь(?:те)?|не\s+дай\s+забыть|будильник|оповести|уведоми|о\s+том,?\s+что|о\s+том,?\s+чтобы|о\s+том|что\s+(?:надо|нужно|необходимо|мне\s+надо)|чтобы|что)(?![а-я])/giu,' ');
 text=text.replace(/^\s*(?:про|об|о|насчет|насчёт|по\s+поводу)\s+/iu,' ').replace(/(?:\s|^)(?:в|на|к|через)(?=\s*[,.;]|\s*$)/giu,' ').replace(/(?:^|\s)(?:в|на|к|до)\s*$/iu,' ');
 text=tidy(text).replace(/\s*[,;]\s*(?=[,;])/g,'');
 const title=cap(text);
 return {kind:'reminder',title:cut(title,60),text:title.length>60?title:'',date:w.date,time:w.time,missingTime:!w.time,missingDate:!w.date,empty:!title};
}
function cut(s,k){return s.length>k?s.slice(0,k-1).replace(/\s+\S*$/,'')+'…':s;}

function deposit(c){
 const {n,src,now,accounts}=c;
 if(!/(?<![а-я])(?:вклад[а-яa-z0-9_]*|депозит[а-яa-z0-9_]*)/.test(n))return null;
 if(/(?<![а-я])(?:пришл[а-яa-z0-9_]*|получил[а-яa-z0-9_]*|начисл[а-яa-z0-9_]*|закры[а-яa-z0-9_]*|снял[а-яa-z0-9_]*|сними|вывел[а-яa-z0-9_]*|вывод[а-яa-z0-9_]*|проценты\s+по)/.test(n)&&!/созда|откро|оформ|нов/.test(n))return null;
 const w=parseWhen(n,now),nums=numbers(n);
 const rateRe=/^\s*(?:%|процент[а-яa-z0-9_]*|годовых|в\s+год)/;
 let rate=null,rateNum=null;
 for(const x of nums){const before=n.slice(Math.max(0,x.start-22),x.start),after=n.slice(x.end);if(rateRe.test(after)||/(?:под|ставк[а-яa-z0-9_]*|ставке|ставкой|доходност[а-яa-z0-9_]*|процент[а-яa-z0-9_]*)\s*(?:в\s+размере\s+)?(?:около\s+)?$/.test(before)){if(x.value>0&&x.value<=1000){rate=x.value;rateNum=x;break;}}}
 // срок
 let months=null,termNum=null,termSpan=null;
 for(const x of nums){const after=n.slice(x.end),um=after.match(/^\s*(месяц[а-яa-z0-9_]*|мес(?![а-яa-z0-9])\.?|год[а-яa-z0-9_]*|лет(?![а-яa-z0-9])|недел[а-яa-z0-9_]*|дн[а-яa-z0-9_]*|день)/);if(um&&x!==rateNum){const u=um[1];const v=x.value;months=/^(год|лет)/.test(u)?v*12:/^(мес)/.test(u)?v:/^недел/.test(u)?v*7/30:v/30;termNum=x;termSpan={start:x.start,end:x.end+um[0].length,days:/^недел/.test(u)?v*7:/^(дн|день)/.test(u)?v:null};break;}}
 let m;
 if(months===null&&(m=/(?<![а-я])(?:на|сроком\s+на|срок)\s+(полгода|пол\s?года|полтора\s+года|год(?![а-я])|годик|года(?![а-я])|месяц(?![а-я])|пару\s+лет|два\s+года|три\s+года)/.exec(n))){const t=m[1];months=/полгода|пол\s?года/.test(t)?6:/полтора/.test(t)?18:/пару\s+лет|два/.test(t)?24:/три/.test(t)?36:/месяц/.test(t)?1:12;termSpan={start:m.index,end:m.index+m[0].length};}
 // дата окончания «до …»
 let end=null;
 if(months===null&&w.date&&w.dateExplicit&&/(?<![а-я])до\s+(?:конца\s+)?[\dа-я]/.test(n))end=w.date;
 if(!/(?<![а-я])(?:созда[а-яa-z0-9_]*|сдела[а-яa-z0-9_]*|откро[а-яa-z0-9_]*|открыть|оформ[а-яa-z0-9_]*|завед[а-яa-z0-9_]*|нов(?:ый|ую|ое)|добав[а-яa-z0-9_]*|хочу|постав[а-яa-z0-9_]*)(?![а-я])/.test(n)&&rate===null&&months===null&&!end)return null;
 const used=[rateNum,termNum].filter(Boolean);
 const cand=nums.filter(x=>!used.includes(x)&&!w.spans.some(s=>overlaps(x,s))&&!(termSpan&&overlaps(x,termSpan))&&x.value>0);
 const principalNum=cand.sort((a,b)=>b.value-a.value)[0]||null;
 // название: «вклад в Сбере»
 let name='';
 if((m=/(?<![а-я])вклад[а-яa-z0-9_]*\s+(?:в|во|от|у)\s+([a-zа-я0-9\-]+(?:\s+банк[а-яa-z0-9_]*)?)/.exec(n))&&!/^(?:месяц|год|сумм|размер|рубл|тысяч|миллион|процент|ставк|эт|сво|нов)/.test(m[1])){name='Вклад · '+bankName(src.slice(m.index+m[0].length-m[1].length,m.index+m[0].length));}
 const acc=findAccounts(n,accounts).filter(a=>!name||!name.toLowerCase().includes(a.name.toLowerCase()));
 const payout=/каждый\s+день|ежедневн|каждодневн|кажд[а-яa-z0-9_]+\s+суток|по\s+дням/.test(n)?'daily':/раз\s+в\s+месяц|ежемесячн|каждый\s+месяц|помесячн|в\s+конце\s+месяца|по\s+месяцам/.test(n)?'monthly':null;
 const cur=currencyIn(n);
 return {kind:'deposit',name:name||'',principal:principalNum?principalNum.value:null,rate,months,end,payout,accountId:acc[0]?.id||null,currency:cur};
}

function limit(c){
 const {n,src,categories}=c;
 const remove=/(?<![а-я])(?:убер[а-яa-z0-9_]+|убрать|сним[а-яa-z0-9_]+|снять|удал[а-яa-z0-9_]+|отмен[а-яa-z0-9_]+|сброс[а-яa-z0-9_]+|отключ[а-яa-z0-9_]+)\s+(?:мне\s+)?(?:весь\s+)?лимит[а-яa-z0-9_]*/.test(n);
 const trig=/(?<![а-я])лимит[а-яa-z0-9_]*|(?<![а-я])ограничени[а-яa-z0-9_]*|(?<![а-я])ограничь|(?<![а-я])ограничить|(?<![а-я])бюджет\s+на|(?<![а-я])не\s+(?:тратить|тратить|тратить)\s+(?:больше|более)|(?<![а-я])не\s+больше\s+.{0,40}\s+в\s+месяц|(?<![а-я])потолок/;
 if(!trig.test(n))return null;
 if(/(?<![а-я])(?:потратил|купил|заплатил|оплатил)/.test(n)&&!hasCreate(n))return null;
 const nums=numbers(n).filter(x=>x.value>0);
 const w=parseWhen(n,c.now);
 const num=nums.filter(x=>!w.spans.some(s=>overlaps(x,s)))[0];
 const category=findCategory(n,categories)||null;
 return {kind:'limit',category,amount:num?num.value:null,remove,currency:currencyIn(n)};
}

function transfer(c){
 const {n,accounts}=c;
 const verb=/(?<![а-я])(?:перевед[а-яa-z0-9_]*|перевод[а-яa-z0-9_]*|перекин[а-яa-z0-9_]+|переброс[а-яa-z0-9_]+|перекид[а-яa-z0-9_]+|скин[а-яa-z0-9_]+|закин[а-яa-z0-9_]+|отправ[а-яa-z0-9_]+|пополни[а-яa-z0-9_]*|сним[а-яa-z0-9_]+|снят[а-яa-z0-9_]+|снял[а-яa-z0-9_]*|переложи[а-яa-z0-9_]*|перелож[а-яa-z0-9_]+|перекладыва[а-яa-z0-9_]+|вывед[а-яa-z0-9_]+)(?![а-я])/;
 const between=/между\s+(?:своими|счетами|картами|моими)/.test(n);
 if(!verb.test(n)&&!between)return null;
 const accs=findAccounts(n,accounts);
 if(!accs.length&&!between)return null;
 if(accs.length<2&&!between){ // один счёт: «переведи 5000 на накопительный»
  const a=accs[0];const before=n.slice(Math.max(0,a.index-14),a.index);if(!/(?:на|в|с|со|из)\s+(?:мой\s+|свой\s+|счет\s+|счёт\s+|карту\s+|карты\s+|карта\s+)?$/.test(before))return null;
  if(/(?<![а-я])(?:маме|папе|другу|подруге|брату|сестре|жене|мужу|сыну|дочке|коллеге)(?![а-я])/.test(n))return null;
 }
 if(/(?<![а-я])(?:цел[а-яa-z0-9_]+|вклад[а-яa-z0-9_]*|копилк[а-яa-z0-9_]*)/.test(n)&&accs.length<2)return null;
 const dir=a=>{const before=n.slice(Math.max(0,a.index-16),a.index);if(/(?:^|\s)(?:с|со|из|от)\s+(?:мо[а-яa-z0-9_]+\s+|свое[а-яa-z0-9_]+\s+|счета\s+|счет\s+|карты\s+|карта\s+|карточки\s+)?$/.test(before))return 'from';if(/(?:^|\s)(?:на|в|к)\s+(?:мо[а-яa-z0-9_]+\s+|свой\s+|счет\s+|карту\s+|карта\s+|счёт\s+)?$/.test(before))return 'to';return null;};
 let from=null,to=null;
 for(const a of accs){const d=dir(a);if(d==='from'&&!from)from=a;else if(d==='to'&&!to)to=a;}
 const rest=accs.filter(a=>a!==from&&a!==to);
 for(const a of rest){if(!from&&to&&a.id!==to.id)from=a;else if(!to&&from&&a.id!==from.id)to=a;else if(!from&&!to){from=a;}else if(from&&!to)to=a;}
 if(!from&&!to&&!between)return null;
 // «сними 5000 с карты» без второго счёта: на наличные
 const nums=numbers(n).filter(x=>x.value>0&&!accs.some(a=>overlaps(x,{start:a.index,end:a.end})));
 const w=parseWhen(n,c.now);
 const num=nums.filter(x=>!w.spans.some(s=>overlaps(x,s)))[0];
 return {kind:'transfer',fromId:from?.id||null,toId:to?.id||null,amount:num?num.value:null,currency:currencyIn(n)};
}

function contribute(c){
 const {n,goals,accounts,now}=c;
 if(!goals.length)return null;
 const g=goals.find(x=>{const ws=words(norm(x.name)).filter(w=>w.length>=3);return ws.length&&ws.every(w=>n.includes(w.slice(0,Math.max(3,Math.min(w.length-1,5)))));});
 if(!g)return null;
 const verb=/(?<![а-я])(?:пополни[а-яa-z0-9_]*|добав[а-яa-z0-9_]*|закин[а-яa-z0-9_]+|полож[а-яa-z0-9_]+|отлож[а-яa-z0-9_]+|внес[а-яa-z0-9_]*|вноси[а-яa-z0-9_]*|переве[а-яa-z0-9_]+|скин[а-яa-z0-9_]+|отправ[а-яa-z0-9_]+|вложи[а-яa-z0-9_]*|докин[а-яa-z0-9_]+|накид[а-яa-z0-9_]+)(?![а-я])/.test(n);
 const noun=/(?<![а-я])(?:цел[а-яa-z0-9_]+|копилк[а-яa-z0-9_]*)(?![а-я])/.test(n);
 if(!verb&&!noun)return null;
 if(/(?<![а-я])(?:созда[а-яa-z0-9_]*|нов[а-яa-z0-9_]+\s+цел|завед[а-яa-z0-9_]*)/.test(n)&&!verb)return null;
 if(/(?<![а-я])(?:созда[а-яa-z0-9_]*|добав[а-яa-z0-9_]*|завед[а-яa-z0-9_]*|постав[а-яa-z0-9_]*|откро[а-яa-z0-9_]*|открыть|нов[а-яa-z0-9_]+)\s+(?:мне\s+)?(?:нов[а-яa-z0-9_]+\s+)?цел[ьию](?![а-я])/.test(n))return null;
 const w=parseWhen(n,now),nums=numbers(n).filter(x=>x.value>0&&!w.spans.some(s=>overlaps(x,s)));
 const accs=findAccounts(n,accounts);
 return {kind:'contribute',goalId:g.id,goalName:g.name,amount:nums[0]?nums[0].value:null,accountId:accs[0]?.id||null};
}

function goalCreate(c){
 const {n,src,now}=c;
 const noun=/(?<![а-я])цел[ьиюе](?![а-я])/.test(n);
 const save=/(?<![а-я])(?:накопить|копить|коплю|накоплю|накопи|собрать|собираю|откладывать|откладываю|скопить)\s+на\s+/.test(n);
 if(!(noun&&(hasCreate(n)||/нов(?:ая|ую)\s+цел/.test(n)))&&!(noun&&/цель\s*[:\-–—]/.test(n))&&!save&&!(/мечт/.test(n)&&hasCreate(n)))return null;
 if(/(?<![а-я])(?:вклад[а-яa-z0-9_]*|депозит[а-яa-z0-9_]*|лимит[а-яa-z0-9_]*|платеж[а-яa-z0-9_]*)/.test(n))return null;
 const w=parseWhen(n,now),nums=numbers(n).filter(x=>x.value>0&&!w.spans.some(s=>overlaps(x,s)));
 const num=nums.sort((a,b)=>b.value-a.value)[0];
 let rest=removeSpans(src,[...(num?[{start:num.start,end:num.end}]:[])]);
 // убираем валюту сразу после суммы
 rest=rest.replace(/(?<![а-я])(?:рублей|рубля|рубль|руб|р\.?|₽|долларов|доллара|евро|тысяч[а-яa-z0-9_]*|тыс\.?|млн|миллион[а-яa-z0-9_]*)(?![а-я])/giu,' ');
 rest=rest.replace(/нов(?:ую|ая|ый)\s+(?=цел)/giu,' ').replace(new RegExp(FILL.replace('новый|новую|новое|новая|',''),'giu'),' ');
 rest=rest.replace(/(?<![а-я])(?:цел[ьиюе]|накопить|копить|коплю|накоплю|накопи|собрать|собираю|откладывать|откладываю|скопить|мечту|мечта|мечты)(?![а-я])/giu,' ');
 rest=rest.replace(/(?<![а-я])(?:на\s+сумму|в\s+размере|размером|около|примерно|порядка|сумму|сумма|цель\s+на|называется|под\s+названием|с\s+названием|которая|чтобы|я|к|до\s+[а-я0-9.]+(?:\s+(?:года|месяца))?|за\s+(?:год|месяц|полгода))(?![а-я])/giu,' ');
 rest=rest.replace(/^\s*(?:на|для|под|—|-|:)\s+/iu,' ').replace(/^\s*(?:на|для)\s+/iu,' ');
 let name=tidy(rest);
 name=words(name).slice(0,5).join(' ');
 if(save&&!noun){const ws=words(name);if(ws[0]&&ws[0].length>4){ws[0]=ws[0].replace(/ую$/,'ая').replace(/([а-я])у$/,(m0,k)=>k+'а').replace(/ью$/,'ь');name=ws.join(' ');}}
 return {kind:'goal',name:cap(name),target:num?num.value:null,icon:iconFor(n),currency:currencyIn(n)};
}

function account(c){
 const {n,src}=c;
 const m=/(?<![а-я])(?:созда[а-яa-z0-9_]*|добав[а-яa-z0-9_]*|завед[а-яa-z0-9_]*|откро[а-яa-z0-9_]*|открыть|оформ[а-яa-z0-9_]*|нов(?:ый|ую|ое))\s+(?:мне\s+)?(?:нов(?:ый|ую|ое)\s+)?(счет[а-яa-z0-9_]*|карт[ауые]|кошел[а-яa-z0-9_]*)(?![а-я])/.exec(n);
 if(!m)return null;
 if(/(?<![а-я])(?:вклад[а-яa-z0-9_]*|депозит[а-яa-z0-9_]*|цел[ьию])/.test(n))return null;
 const nums=numbers(n).filter(x=>x.value>=0);
 let init=null;const bal=/(?:остатк[а-яa-z0-9_]*|баланс[а-яa-z0-9_]*|на\s+счету|на\s+нем|на\s+ней|там|стартов[а-яa-z0-9_]+|начальн[а-яa-z0-9_]+|с\s+суммой|сумм[а-яa-z0-9_]+|положи[а-яa-z0-9_]*|внес[а-яa-z0-9_]*)\s*(?:на\s+нем\s+|в\s+размере\s+)?$/;
 for(const x of nums){if(bal.test(n.slice(Math.max(0,x.start-24),x.start))){init=x.value;break;}}
 if(init===null&&nums.length===1)init=nums[0].value;
 const cur=currencyIn(n)||'RUB';
 let tail=src.slice(m.index+m[0].length);
 const cutAt=tail.search(/(?:\s|^)(?:с\s+(?:остатк|баланс|суммой)|остатк|баланс|на\s+(?:нем|ней|счету)|в\s+(?:рублях|долларах|евро|юанях)|валют[а-яa-z0-9_]+)|\s\d/i);
 if(cutAt>=0)tail=tail.slice(0,cutAt);
 let name=tidy(tail.replace(/(?<![а-я])(?:с\s+названием|под\s+названием|называется|под\s+именем|название|имя|в|во|на|от|для|который|которая|пожалуйста)(?![а-я])/giu,' '));
 name=words(name).slice(0,4).join(' ');
 if(!name)name=/карт/.test(m[1])?'Карта':/кошел/.test(m[1])?'Кошелёк':cur==='RUB'?'':cur==='USD'?'Доллары':cur==='EUR'?'Евро':'';
 return {kind:'account',name:cap(name),currency:cur,initial:init||0};
}

function category(c){
 const {n,src}=c;
 const m=/(?<![а-я])(?:созда[а-яa-z0-9_]*|добав[а-яa-z0-9_]*|завед[а-яa-z0-9_]*|нов(?:ую|ая))\s+(?:мне\s+)?(?:нов(?:ую|ая)\s+)?категори[а-яa-z0-9_]*\s*(?:(?:для\s+)?(доход[а-яa-z0-9_]*|расход[а-яa-z0-9_]*|трат[а-яa-z0-9_]*)\s*)?/.exec(n);
 if(!m)return null;
 let tail=src.slice(m.index+m[0].length);
 tail=tail.replace(/^\s*(?:под\s+названием|с\s+названием|называется|под\s+именем|название|имя|[:\-–—])\s*/iu,'');
 const type=/доход/.test(m[1]||'')||/(?:категори[а-яa-z0-9_]*\s+доход[а-яa-z0-9_]*|доходов)/.test(n)?'income':'expense';
 const name=tidy(tail).split(/\s+/).slice(0,4).join(' ');
 return {kind:'category',name:cap(name),type};
}

const LOAN=[[/кредит[а-яa-z0-9_]*/,'Кредит'],[/ипотек[а-яa-z0-9_]*/,'Ипотека'],[/рассрочк[а-яa-z0-9_]*/,'Рассрочка'],[/займ[а-яa-z0-9_]*|микрозайм[а-яa-z0-9_]*/,'Займ'],[/лизинг[а-яa-z0-9_]*/,'Лизинг']];
const NOT_BANK=/^(?:месяц|месяца|день|год|года|числа|число|кажд|рубл|тысяч|миллион|процент|ставк|сумм|размер|ежемесячн|плат|остат|на(?![а-яa-z0-9])|за(?![а-яa-z0-9])|по(?![а-яa-z0-9])|до(?![а-яa-z0-9])|от(?![а-яa-z0-9])|нов|сво|мой|мое)/;
function payment(c){
 const {n,src,now,categories}=c;
 const noun=/(?<![а-я])платеж[а-яa-z0-9_]*|(?<![а-я])платёж[а-яa-z0-9_]*/.test(n);
 const loan=LOAN.find(([re])=>re.test(n));
 const recurring=/каждый\s+месяц|ежемесячн|каждого\s+месяца|раз\s+в\s+месяц|числа|каждую\s+неделю|еженедельн|каждый\s+день|ежедневн|раз\s+в\s+неделю|раз\s+в\s+две\s+недели|каждые\s+две\s+недели|регулярн/.test(n);
 const mandatory=/обязательн[а-яa-z0-9_]+/.test(n);
 if(!(hasCreate(n)&&(noun||loan||mandatory||recurring)&&(noun||loan||mandatory)))return null;
 if(/(?<![а-я])(?:вклад[а-яa-z0-9_]*|депозит[а-яa-z0-9_]*|цел[ьию]|лимит[а-яa-z0-9_]*|категори[а-яa-z0-9_]*|счет\s+[а-яa-z0-9_]+|напомни(?:те)?(?![а-я]))/.test(n)&&!noun&&!mandatory)return null;
 if(/(?<![а-я])(?:заплатил[а-яa-z0-9_]*|оплатил[а-яa-z0-9_]*|погасил[а-яa-z0-9_]*|купил[а-яa-z0-9_]*|потратил[а-яa-z0-9_]*)/.test(n)&&!noun)return null;
 const w=parseWhen(n,now),nums=numbers(n).filter(x=>x.value>0);
 const remind=/(?:напомни[а-яa-z0-9_]*\s+)?за\s+(\S+)\s+(?:дн[а-яa-z0-9_]*|день)/.exec(n);
 let remindDays=null;if(remind){const v=numbers(remind[1])[0];remindDays=v?v.value:(/^\d+$/.test(remind[1])?+remind[1]:null);}
 const remindSpan=remind?{start:remind.index,end:remind.index+remind[0].length}:null;
 const amountNum=nums.filter(x=>!w.spans.some(s=>overlaps(x,s))&&!(remindSpan&&overlaps(x,remindSpan)))[0];
 let repeat=/один\s+раз|разово|однократн|единоразов/.test(n)?'once':/каждые\s+две\s+недели|раз\s+в\s+две\s+недели/.test(n)?'fortnightly':/каждую\s+неделю|еженедельн|раз\s+в\s+неделю/.test(n)?'weekly':/каждый\s+день|ежедневн/.test(n)?'daily':null;
 if(!repeat&&(recurring||loan||noun))repeat='monthly';
 // банк
 let bank='';
 const bm=/(?<![а-я])(?:в|во|от|из|банк[а-яa-z0-9_]*|у)\s+((?:т|п)\s+банк[а-яa-z0-9_]*|[a-zа-я0-9\-]+(?:\s+банк[а-яa-z0-9_]*)?)/.exec(n);
 if(bm&&!NOT_BANK.test(bm[1])&&!ORD[bm[1].split(/\s+/)[0]]&&!/^\d/.test(bm[1])&&!MONTHS[bm[1]]){bank=bankName(src.slice(bm.index+bm[0].length-bm[1].length,bm.index+bm[0].length));}
 // название
 const bankSpan=bm&&bank?{start:bm.index,end:bm.index+bm[0].length}:null;
 let rest=removeSpans(src,[...(amountNum?[{start:amountNum.start,end:amountNum.end}]:[]),...w.spans,...(bankSpan?[bankSpan]:[]),...(remindSpan?[remindSpan]:[])]);
 rest=rest.replace(/(?<![а-я])(?:рублей|рубля|рубль|руб|р\.?|₽|долларов|евро|тысяч[а-яa-z0-9_]*|тыс\.?|млн|миллион[а-яa-z0-9_]*)(?![а-я])/giu,' ');
 rest=rest.replace(new RegExp(FILL,'giu'),' ');
 rest=rest.replace(/(?<![а-я])(?:обязательн[а-яa-z0-9_]+|платеж[а-яa-z0-9_]*|платёж[а-яa-z0-9_]*|ежемесячн[а-яa-z0-9_]+|еженедельн[а-яa-z0-9_]+|ежедневн[а-яa-z0-9_]+|регулярн[а-яa-z0-9_]+|кажд[а-яa-z0-9_]+|раз\s+в\s+(?:месяц|неделю)|числа|число|месяц|месяца|неделю|день|один\s+раз|разово|по|за|на|для|в|во|с|со|из|от|к|до|и|напомни[а-яa-z0-9_]*)(?![а-я])/giu,' ');
 let name=tidy(rest);
 const ln=loan?loan[1]:'';
 if(ln){const extra=words(name).filter(x=>!loan[0].test(norm(x)));name=ln+(extra.length?' '+extra.slice(0,3).join(' ').toLowerCase():'');}
 else{const ws=words(name).slice(0,4);if(ws.length)ws[0]=nom(ws[0]);name=cap(ws.join(' '));}
 // дата: ближайшее такое число / явная дата
 const date=w.date||null;
 let cat=null;const nameN=norm(name);
 cat=findCategory(nameN+' '+n,categories);
 if(!cat&&ln&&categories.includes('Финансовые операции'))cat='Финансовые операции';
 return {kind:'payment',name,amount:amountNum?amountNum.value:null,bank,date,repeat,remindDays,category:cat,time:w.time||null};
}

function parse(text,ctx={}){
 const src=String(text||'').replace(/[\u00a0]/g,' ').trim();
 if(!src||src.length>600)return null;
 const n=norm(src);
 const c={src,n,now:ctx.now||new Date(),accounts:ctx.accounts||[],goals:ctx.goals||[],categories:ctx.categories||[],incomeCategories:ctx.incomeCategories||[]};
 for(const f of [reminder,deposit,limit,contribute,transfer,goalCreate,account,category,payment]){const r=f(c);if(r)return r;}
 return null;
}

// ---------- применение в приложении ----------
function setField(name,value){const el=document.querySelector('#actionBody [name="'+name+'"]');if(!el||value===null||value===undefined||value==='')return;el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
const rub=v=>v===null||v===undefined?null:String(Math.round(v*100)/100);
function limitForm(c){
 const cats=state.categories,cur=c.currency&&[...new Set(state.accounts.map(a=>a.currency))].includes(c.currency)?c.currency:selectedCurrency;
 const lim=(state.limits[cur]||{})[c.category]||0;
 actionDialog(c.remove?'Убрать лимит':'Лимит на месяц',`<form><label class="field">Категория<select name="category">${cats.map(x=>`<option ${x===c.category?'selected':''}>${esc(x)}</option>`).join('')}</select></label><div class="form-grid"><label class="field">Лимит, ${cur}<input name="amount" type="number" step="0.01" min="0" max="10000000000" value="${c.remove?'':(c.amount??(lim?lim/100:''))}" placeholder="Без лимита"></label><label class="field">Валюта<select name="currency">${[...new Set(state.accounts.map(a=>a.currency))].map(x=>`<option ${x===cur?'selected':''}>${x}</option>`).join('')}</select></label></div><p class="tiny muted">Лимит считается на календарный месяц. Пустое поле или ноль — убрать лимит. Предупредим при 80% и превышении.</p><button class="primary">Сохранить лимит</button></form>`,f=>{
  if(!requireAccess('limits'))return;const category=f.get('category'),currency=f.get('currency'),amount=cents(f.get('amount')||0);
  if(commit(s=>{s.limits[currency]=s.limits[currency]||{};if(amount>0)s.limits[currency][category]=amount;else delete s.limits[currency][category];},amount>0?'Лимит сохранён':'Лимит убран'))$('#actionDialog').close();
 });
}
function apply(c){
 const entry=document.querySelector('#entryDialog');if(entry?.open)entry.close();
 const say=t=>notify(t);
 switch(c.kind){
  case 'deposit':{
   const start=iso(new Date());let end=c.end;if(!end&&c.months){const m=c.months;end=iso(Number.isInteger(m)?addMonths(new Date(),m):addDays(new Date(),Math.round(m*30)));}
   MonoDeposits.form(null,{name:c.name||'Вклад',principal:c.principal,rate:c.rate,end,start,payout:c.payout,account:c.accountId});
   say('Понял: новый вклад. Проверьте данные и сохраните.');break;}
  case 'goal':{
   if(!requireAccess('goals'))return;goalForm();setField('name',c.name);setField('target',rub(c.target));if(c.icon){const i=document.querySelector('#actionBody [name=icon]');const b=document.querySelector('#actionBody [data-goal-icon="'+c.icon+'"]');if(b)b.click();else if(i)i.value=c.icon;}
   if(c.currency&&[...new Set(state.accounts.map(a=>a.currency))].includes(c.currency))setField('currency',c.currency);
   say('Понял: новая цель. Проверьте и сохраните.');break;}
  case 'contribute':{
   contributeForm(c.goalId);setField('amount',rub(c.amount));if(c.accountId)setField('account',c.accountId);say('Пополнение цели «'+c.goalName+'». Проверьте и сохраните.');break;}
  case 'transfer':{
   if(state.accounts.length<2){say('Для перевода между своими нужно два счёта. Добавьте счёт.');return;}
   transferForm();if(c.fromId)setField('from',c.fromId);if(c.toId)setField('to',c.toId);setField('amount',rub(c.amount));say('Понял: перевод между своими. Проверьте и сохраните.');break;}
  case 'limit':limitForm(c);say(c.remove?'Выберите категорию и сохраните — лимит уберётся.':'Понял: лимит на месяц. Проверьте и сохраните.');break;
  case 'payment':{
   if(!requireAccess('payments'))return;paymentForm();setField('name',c.name);setField('amount',rub(c.amount));if(c.bank)setField('bank',c.bank);if(c.date)setField('date',c.date);if(c.repeat)setField('repeat',c.repeat);if(c.category&&state.categories.includes(c.category))setField('category',c.category);if(c.remindDays!==null)setField('remindDays',c.remindDays);if(c.time)setField('reminderTime',c.time);say('Понял: обязательный платёж. Проверьте и сохраните.');break;}
  case 'reminder':{
   window.MonoReminders.form(null,{title:c.title,text:c.text,date:c.date,time:c.time});
   say(c.date&&c.time?'Напоминание на '+c.date.split('-').reverse().join('.')+' в '+c.time+'. Проверьте и сохраните.':'Понял: напоминание. Уточните дату и время.');break;}
  case 'account':{accountForm();setField('name',c.name);setField('currency',c.currency);setField('initial',rub(c.initial));say('Понял: новый счёт. Проверьте и сохраните.');break;}
  case 'category':{navigate('categories');setTimeout(()=>{const f=document.querySelector('#categoryForm');if(!f)return;f.elements.name.value=c.name;f.elements.type.value=c.type;f.elements.name.focus({preventScroll:true});},350);say('Понял: новая категория «'+c.name+'». Нажмите «Добавить».');break;}
 }
}
function run(text){
 if(typeof state!=='object'||typeof document==='undefined')return false;
 let c;try{c=parse(text,{now:new Date(),accounts:state.accounts,goals:state.goals,categories:state.categories,incomeCategories:state.incomeCategories});}catch{return false;}
 if(!c)return false;
 try{apply(c);}catch(e){return false;}
 return true;
}
const api={parse,parseWhen,numbers,run,apply,findAccounts};
root.MonoVoiceCommands=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
