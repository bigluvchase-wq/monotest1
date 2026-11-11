(function(root){
'use strict';
// Голосовые команды: кроме расходов и доходов можно создать напоминание, цель, счёт, лимит,
// платёж и вклад. Фраза распознаётся, и открывается окно добавления с заполненными полями.
const pad=x=>String(x).padStart(2,'0');
const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"“”]/g,'').replace(/\s+/g,' ').trim();
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
const units={ноль:0,один:1,одна:1,одного:1,одну:1,час:1,два:2,две:2,двух:2,три:3,трех:3,четыре:4,четырех:4,пять:5,пяти:5,шесть:6,шести:6,семь:7,семи:7,восемь:8,восьми:8,девять:9,девяти:9,десять:10,десяти:10,одиннадцать:11,одиннадцати:11,двенадцать:12,двенадцати:12,тринадцать:13,тринадцати:13,четырнадцать:14,четырнадцати:14,пятнадцать:15,пятнадцати:15,шестнадцать:16,шестнадцати:16,семнадцать:17,семнадцати:17,восемнадцать:18,восемнадцати:18,девятнадцать:19,девятнадцати:19};
const tens={двадцать:20,двадцати:20,тридцать:30,тридцати:30,сорок:40,сорока:40,пятьдесят:50,пятидесяти:50};
const ordinals={первого:1,второго:2,третьего:3,четвертого:4,пятого:5,шестого:6,седьмого:7,восьмого:8,девятого:9,десятого:10,одиннадцатого:11,двенадцатого:12,тринадцатого:13,четырнадцатого:14,пятнадцатого:15,шестнадцатого:16,семнадцатого:17,восемнадцатого:18,девятнадцатого:19,двадцатого:20,тридцатого:30};
const months={января:1,февраля:2,марта:3,апреля:4,мая:5,июня:6,июля:7,августа:8,сентября:9,октября:10,ноября:11,декабря:12};
const weekdays={понедельник:1,вторник:2,среду:3,среда:3,четверг:4,пятницу:5,пятница:5,субботу:6,суббота:6,воскресенье:0};
const W='(?:'+[...Object.keys(tens),...Object.keys(units)].sort((a,b)=>b.length-a.length).join('|')+')';
const NUM='(\\d{1,2}|'+W+'(?:\\s+'+W+')?)';
const HOUR='(\\d{1,2}|двадцат[ьи](?:\\s+(?:один|одного|два|двух|три|трех))?|'+Object.keys(units).sort((a,b)=>b.length-a.length).join('|')+')';
const ORD='((?:двадцать|тридцать)\\s+)?('+Object.keys(ordinals).join('|')+')';
function wordNumber(t){
 t=norm(t);if(/^\d+$/.test(t))return Number(t);
 let n=0,ok=false;for(const w of t.split(' ')){if(w in tens){n+=tens[w];ok=true;}else if(w in units){n+=units[w];ok=true;}else return null;}
 return ok?n:null;
}
const dateStr=d=>E.dateString(d);
const addDays=(n,base=new Date())=>{const d=new Date(base);d.setDate(d.getDate()+n);return d;};
// Вырезает найденные фрагменты, чтобы из остатка получить название
function cut(ctx,re,fn){const m=ctx.text.match(re);if(!m)return false;const r=fn(m);if(r===false)return false;ctx.text=(ctx.text.slice(0,m.index)+' '+ctx.text.slice(m.index+m[0].length)).replace(/\s+/g,' ').trim();return true;}
function parseWhen(ctx){
 const now=new Date();let date=null,time=null,rel=null;
 // через N минут / часов / полчаса
 cut(ctx,new RegExp('(?:^|\\s)через\\s+(?:'+NUM+'\\s+)?(минут[уы]?|час(?:а|ов)?|полчаса|дн(?:я|ей)|день|недел(?:ю|и|ь))(?=\\s|$)'),m=>{
  const n=m[1]?wordNumber(m[1]):1;if(n===null)return false;const unit=m[2];
  if(unit==='полчаса')rel=30;else if(unit.startsWith('минут'))rel=n;else if(unit.startsWith('час'))rel=n*60;
  else if(unit.startsWith('нед'))date=dateStr(addDays(7*n));else date=dateStr(addDays(n));
 });
 if(rel!==null){const d=new Date(now.getTime()+rel*60000);date=dateStr(d);time=pad(d.getHours())+':'+pad(d.getMinutes());}
 // день
 cut(ctx,/(?:^|\s)(сегодня|завтра|послезавтра)(?=\s|$)/,m=>{date=dateStr(addDays({сегодня:0,завтра:1,послезавтра:2}[m[1]]));});
 if(!date)cut(ctx,/(?:^|\s)(?:во?\s+)?(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье)(?=\s|$)/,m=>{const want=weekdays[m[1]];let k=(want-now.getDay()+7)%7;if(k===0)k=7;date=dateStr(addDays(k));});
 if(!date)cut(ctx,new RegExp('(?:^|\\s)(?:на\\s+|к\\s+)?(?:(\\d{1,2})(?:-?(?:го|е|ое))?|'+ORD+')\\s+('+Object.keys(months).join('|')+'|числа)(?=\\s|$)'),m=>{
  const day=m[1]?Number(m[1]):(m[2]?wordNumber(m[2].trim()):0)+ordinals[m[3]];if(!day||day>31)return false;
  let y=now.getFullYear(),mo=m[4]==='числа'?now.getMonth()+1:months[m[4]];
  let d=new Date(y,mo-1,day,12);if(m[4]==='числа'&&d<new Date(now.getFullYear(),now.getMonth(),now.getDate()))d=new Date(y,mo,day,12);
  else if(m[4]!=='числа'&&dateStr(d)<dateStr(now))d=new Date(y+1,mo-1,day,12);
  date=dateStr(d);
 });
 if(!date)cut(ctx,/(?:^|\s)(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=\s|$)/,m=>{let y=m[3]?Number(m[3].length===2?'20'+m[3]:m[3]):new Date().getFullYear();const d=new Date(y,Number(m[2])-1,Number(m[1]),12);if(isNaN(d))return false;date=dateStr(d);});
 // время
 if(!time){
  const parts='(утра|дня|вечера|ночи)';
  const done=cut(ctx,/(?:^|\s)(?:в|к|на)\s+(\d{1,2})[:.](\d{2})(?:\s+(утра|дня|вечера|ночи))?(?=\s|$)/,m=>{let h=Number(m[1]);const mi=Number(m[2]);if(h>23||mi>59)return false;if(m[3]&&/дня|вечера/.test(m[3])&&h<12)h+=12;time=pad(h)+':'+pad(mi);})
  ||cut(ctx,new RegExp('(?:^|\\s)(?:в|к|на)\\s+'+HOUR+'(?:\\s+час(?:а|ов|у)?)?(?:\\s+(\\d{1,2}|'+W+'(?:\\s+'+W+')?)(?:\\s+минут[уы]?)?)?(?:\\s+'+parts+')?(?=\\s|$)(?!\\s+(?:\\d|'+W+'(?:\\s|$)|тыс|руб|₽|%|процент|млн|миллион|долл|евро|р\\.?(?:\\s|$)|дн|день|недел|месяц|числа|'+Object.keys(months).join('|')+'))'),m=>{
   let h=wordNumber(m[1]);if(h===null||h>23)return false;let mi=m[2]?wordNumber(m[2]):0;if(mi===null||mi>59)return false;
   const part=m[3];
   if(part==='дня'||part==='вечера'){if(h<12)h+=12;}else if(part==='ночи'){if(h===12)h=0;}else if(part==='утра'){if(h===12)h=0;}
   else if(!part&&h<=7){h+=12;}
   time=pad(h)+':'+pad(mi);
  })
  ||cut(ctx,/(?:^|\s)(?:в\s+)?(полдень|полночь)(?=\s|$)/,m=>{time=m[1]==='полдень'?'12:00':'00:00';})
  ||cut(ctx,/(?:^|\s)(утром|днем|вечером|ночью)(?=\s|$)/,m=>{time={утром:'09:00',днем:'13:00',вечером:'19:00',ночью:'22:00'}[m[1]];});
  void done;
 }
 const timeGiven=!!time;
 if(time&&!date){date=dateStr(now);if(time<=pad(now.getHours())+':'+pad(now.getMinutes()))date=dateStr(addDays(1));}
 if(date&&!time){if(date===dateStr(now)){const d=new Date(now);d.setMinutes(0,0,0);d.setHours(d.getHours()+1);time=pad(d.getHours())+':00';if(dateStr(d)!==date){date=dateStr(d);}}else time='09:00';}
 return {date,time,timeGiven};
}
// Сумма из фразы — тем же разбором, что и для операций
function amountOf(text){
 if(!text||!/\d|сто|тыс|миллион|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|двести|триста|пятьсот|один|два|три|пять|десять/.test(text))return null;
 try{const r=E.parse(text,new Date(),[],state,state.accounts[0].id);const e=r.entries[0];return e?.amount||null;}catch{return null;}
}
const amountRe=/(?:^|\s)((?:\d[\d\s]*(?:[.,]\d+)?|(?:сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот|тысяч[ауи]?|миллион(?:а|ов)?|полтора|полторы|один|одна|две|два|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|\d+)(?:\s+|$))+)\s*(?:тыс\.?|тысяч[ауи]?|к|млн)?\s*(?:руб(?:лей|ля|ль)?|р\.?|₽|долларов|доллара|евро)?(?=\s|$)/;
function takeAmount(ctx){let amount=null;cut(ctx,amountRe,m=>{const a=amountOf(m[0].trim());if(!a)return false;amount=a;});return amount;}
function currencyOf(ctx){let c=null;cut(ctx,/(?:^|\s)(?:в\s+)?(рубл(?:ях|ей|ь)|долларах|доллар(?:ов|а)?|usd|евро|eur|тенге|юан(?:ях|ей)|лир(?:ах)?|лари|драм(?:ах)?|дирхам(?:ах)?|фунт(?:ах|ов)?)(?=\s|$)/,m=>{const w=m[1];c=/рубл/.test(w)?'RUB':/доллар|usd/.test(w)?'USD':/евро|eur/.test(w)?'EUR':/тенге/.test(w)?'KZT':/юан/.test(w)?'CNY':/лир/.test(w)?'TRY':/лари/.test(w)?'GEL':/драм/.test(w)?'AMD':/дирхам/.test(w)?'AED':'GBP';});return c;}
const stripLead=t=>t.replace(/\s+(?:на|в|во|за|по|с|со|для|к|и)$/,'').replace(/^(?:мне|нам|пожалуйста|что|чтобы|о том что|о том чтобы|про|об?|надо|нужно)\s+/,'').replace(/^(?:мне|надо|нужно|что|чтобы)\s+/,'').replace(/\s+(?:пожалуйста)$/,'').replace(/[.,!?;:]+$/,'').trim();
const stem=w=>{w=norm(w);const r=w.replace(/(?:ами|ями|ого|ему|ому|ыми|ими|ая|яя|ую|юю|ое|ее|ий|ый|ой|ов|ев|ам|ям|ах|ях|ом|ем|ы|и|а|я|у|ю|е)$/u,'');return r.length>=3?r:w;};
function matchCategory(text,list){const words=norm(text).split(/[^\p{L}]+/u).filter(Boolean).map(stem);let best=null;for(const c of list){const cw=norm(c).split(/[^\p{L}]+/u).filter(Boolean).map(stem);if(cw.length&&cw.every(w=>words.some(x=>x.startsWith(w)||w.startsWith(x)&&x.length>=4))&&(!best||c.length>best.length))best=c;}return best;}
const CREATE='(?:создай(?:те)?|добавь(?:те)?|заведи(?:те)?|открой(?:те)?|сделай(?:те)?|запиши|новый|новая|новое|хочу)';
const commands=[
 {kind:'reminder',re:/^(?:(?:поставь|создай|добавь|сделай)\s+)?(?:напомни(?:те)?|напоминани[ея])(?:\s|$)/,parse(ctx){
  ctx.text=ctx.text.replace(/^(?:(?:поставь|создай|добавь|сделай)\s+)?(?:напомни(?:те)?|напоминани[ея])\s*/,'');
  let repeat=null;cut(ctx,/(?:^|\s)(каждый день|ежедневно|каждую неделю|еженедельно|каждые две недели|каждый месяц|ежемесячно)(?=\s|$)/,m=>{const w=m[1];repeat=/день|ежеднев/.test(w)?'daily':/две недели/.test(w)?'fortnightly':/недел/.test(w)?'weekly':'monthly';});
  const when=parseWhen(ctx);let rest=stripLead(ctx.text),text='';
  const split=rest.match(/^(.*?)\s*(?:[:—–-]|\bтекст\b)\s*(.+)$/);if(split&&split[1]){rest=split[1];text=cap(split[2]);}
  return {title:cap(stripLead(rest)),text,repeat,...when};
 }},
 {kind:'deposit',re:new RegExp('^(?:'+CREATE+'\\s+|открыл[аи]?\\s+|положил[аи]?\\s+)?(?:вклад|депозит)(?:\\s|$)'),parse(ctx){
  ctx.text=ctx.text.replace(new RegExp('^(?:'+CREATE+'\\s+|открыл[аи]?\\s+|положил[аи]?\\s+)?(?:вклад|депозит)\\s*'),'');
  let rate=null,term=null,payout=null;
  cut(ctx,/(?:^|\s)(?:под\s+)?(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:%|процент(?:ов|а)?(?:\s+годовых)?)(?=\s|$)/,m=>{rate=Number(m[1].replace(',','.'));});
  if(rate===null)cut(ctx,new RegExp('(?:^|\\s)под\\s+'+NUM+'\\s+процент(?:ов|а)?(?:\\s+годовых)?(?=\\s|$)'),m=>{rate=wordNumber(m[1]);});
  cut(ctx,/(?:^|\s)на\s+(год|полгода|месяц|шесть месяцев|6 месяцев|двенадцать месяцев|12 месяцев)(?=\s|$)/,m=>{term=/год|двенадцать|12/.test(m[1])&&!/пол/.test(m[1])?'1y':/пол|шесть|6/.test(m[1])?'6m':'1m';});
  cut(ctx,/(?:^|\s)(?:с\s+)?(?:начислением\s+)?(?:проценты\s+)?(каждый день|ежедневно|раз в месяц|ежемесячно|каждый месяц)(?=\s|$)/,m=>{payout=/день|ежеднев/.test(m[1])?'daily':'monthly';});
  const principal=takeAmount(ctx);const rest=stripLead(ctx.text);
  return {name:rest?'Вклад '+rest:'',principal,rate,term,payout};
 }},
 {kind:'payment',re:new RegExp('^(?:'+CREATE+'\\s+)?(?:обязательный\\s+|ежемесячный\\s+|регулярный\\s+)?платеж(?:\\s|$)'),parse(ctx){
  ctx.text=ctx.text.replace(new RegExp('^(?:'+CREATE+'\\s+)?(?:обязательный\\s+|ежемесячный\\s+|регулярный\\s+)?платеж\\s*'),'');
  let repeat=null;
  cut(ctx,/(?:^|\s)(каждый месяц|ежемесячно|раз в месяц|каждую неделю|еженедельно|каждые две недели|раз в две недели|каждый день|ежедневно|один раз|разово|однократно)(?=\s|$)/,m=>{const w=m[1];repeat=/месяц|ежемесяч/.test(w)?'monthly':/две недели/.test(w)?'fortnightly':/недел/.test(w)?'weekly':/день|ежеднев/.test(w)?'daily':'once';});
  const when=parseWhen(ctx);const amount=takeAmount(ctx);
  const name=cap(stripLead(ctx.text.replace(/^(?:за|на|по)\s+/,'')));
  const category=matchCategory(name,state.categories);
  return {name,amount,date:when.date,time:when.timeGiven?when.time:null,repeat,category};
 }},
 {kind:'limit',re:/^(?:(?:поставь|установи|задай|сделай|создай|добавь|новый)\s+)?(?:лимит|бюджет|ограничение)(?:\s|$)|^ограничь(?:\s|$)/,parse(ctx){
  ctx.text=ctx.text.replace(/^(?:(?:поставь|установи|задай|сделай|создай|добавь|новый)\s+)?(?:лимит|бюджет|ограничение|ограничь)\s*/,'').replace(/(?:^|\s)(?:в|на)\s+месяц(?=\s|$)/,' ');
  const amount=takeAmount(ctx);const rest=ctx.text.replace(/^(?:на|для|по|расходы\s+на|траты\s+на)\s+/,'');
  return {category:matchCategory(rest,state.categories),amount,raw:cap(stripLead(rest))};
 }},
 {kind:'goal',re:new RegExp('^(?:(?:'+CREATE+'\\s+)?цель(?:\\s|$)|(?:хочу\\s+)?(?:накопить|коплю|копить)\\s+на(?:\\s|$))'),parse(ctx){
  ctx.text=ctx.text.replace(new RegExp('^(?:(?:'+CREATE+'\\s+)?цель\\s*|(?:хочу\\s+)?(?:накопить|коплю|копить)\\s+(?=на))'),'');
  const target=takeAmount(ctx);const currency=currencyOf(ctx);
  const viaNa=/^на\s/.test(ctx.text);let name=stripLead(ctx.text.replace(/^(?:на|для)\s+/,'').replace(/\s+(?:на|в)$/,''));
  // «накопить на новую машину» → «Новая машина»
  if(viaNa)name=name.split(' ').map(w=>w.length>3?w.replace(/ую$/,'ая').replace(/юю$/,'яя').replace(/([^аеиоуыэюя])у$/,'$1а').replace(/ю$/,'я'):w).join(' ');
  name=cap(name);
  return {name,target,currency};
 }},
 {kind:'account',re:new RegExp('^(?:'+CREATE+'\\s+)?(?:счет|кошелек|карт[уа])(?:\\s|$)'),parse(ctx){
  ctx.text=ctx.text.replace(new RegExp('^(?:'+CREATE+'\\s+)?(?:счет|кошелек|карт[уа])\\s*'),'');
  const currency=currencyOf(ctx);let initial=null;
  cut(ctx,/(?:^|\s)(?:с\s+)?(?:остатк(?:ом|а)|балансом|на нем|там)\s+(.+)$/,m=>{const a=amountOf(m[1]);if(!a)return false;initial=a;});
  if(initial===null)initial=takeAmount(ctx);
  const name=cap(stripLead(ctx.text.replace(/^(?:под|для|в|на)\s+/,'')));
  return {name,currency,initial};
 }}
];
function detect(raw){
 const text=norm(raw).replace(/[.!?]+$/,'');if(!text)return null;
 for(const c of commands){if(c.re.test(text)){const ctx={text};try{return {kind:c.kind,data:c.parse(ctx),source:raw};}catch(error){console.error(error);return null;}}}
 return null;
}
// Заполняет поля открытого окна и обновляет подписи у полей даты и времени
function fill(values){
 const body=$('#actionBody');if(!body)return;
 for(const [name,value] of Object.entries(values)){
  if(value===null||value===undefined||value==='')continue;
  const el=body.querySelector(`[name="${name}"]`);if(!el||el.disabled)continue;
  if(el.tagName==='SELECT'&&![...el.options].some(o=>(o.value||o.textContent)===String(value)))continue;
  el.value=String(value);
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
 }
}
function limitForm(data){
 if(!requireAccess('limits'))return;
 const currency=selectedCurrency,cat=data.category||state.categories[0],current=state.limits[currency]?.[cat]||0;
 actionDialog('Лимит на месяц',`<form><label class="field">Категория<select name="category">${categoryOptions('expense',cat)}</select></label><label class="field">Лимит, ${currency}<input name="amount" type="number" step="0.01" min="0.01" max="10000000000" required value="${data.amount?data.amount/100:current?current/100:''}"></label><p class="tiny muted">Предупредим при 80% и при превышении. Изменить можно в «Лимитах».</p><button class="primary">Сохранить лимит</button></form>`,f=>{
  if(!requireAccess('limits'))return;const category=f.get('category'),amount=cents(f.get('amount'));if(!(amount>0))throw Error('Проверьте сумму лимита.');
  if(commit(s=>{s.limits[currency]={...(s.limits[currency]||{}),[category]:amount};},'Лимит сохранён'))$('#actionDialog').close();
 });
}
function run(cmd){
 const d=cmd.data;
 if(cmd.kind==='reminder'){root.MonoReminders.form(null,{title:d.title,text:d.text,date:d.date,time:d.time,repeat:d.repeat||undefined});return true;}
 if(cmd.kind==='goal'){goalForm();if(!$('#actionDialog').open)return true;fill({name:d.name,target:d.target?d.target/100:null,currency:d.currency});return true;}
 if(cmd.kind==='account'){accountForm();if(!$('#actionDialog').open)return true;fill({name:d.name,currency:d.currency,initial:d.initial?d.initial/100:null});return true;}
 if(cmd.kind==='payment'){paymentForm();if(!$('#actionDialog').open)return true;fill({name:d.name,amount:d.amount?d.amount/100:null,date:d.date,repeat:d.repeat,category:d.category,reminderTime:d.time});return true;}
 if(cmd.kind==='deposit'){root.MonoDeposits.form();if(!$('#actionDialog').open)return true;fill({name:d.name,principal:d.principal?d.principal/100:null,rate:d.rate,term:d.term,payout:d.payout});return true;}
 if(cmd.kind==='limit'){limitForm(d);return true;}
 return false;
}
// Список фраз, которыми можно управлять моно
const phrases=[
 ['Расходы и доходы',['Кофе 280','Продукты 1500 и такси 400','Получил зарплату 80 тысяч','Вчера оплатил долями куртку за 8 тысяч']],
 ['Напоминания',['Напомни накормить кота сегодня в 6 вечера','Напомни позвонить маме завтра в 10 утра','Напомни через 2 часа выключить духовку','Напомни в пятницу забрать посылку']],
 ['Цели',['Создай цель отпуск 200 тысяч','Хочу накопить на машину миллион','На отпуск 10 тысяч — пополнить цель']],
 ['Счета',['Добавь счёт наличные 5000','Создай счёт в долларах','Новый счёт карта Т-Банк с остатком 20 тысяч']],
 ['Лимиты',['Лимит на кафе 10 тысяч','Поставь лимит на продукты 25 тысяч']],
 ['Платежи',['Добавь платёж аренда 40 тысяч 5 числа каждый месяц','Платёж интернет 700 рублей 20 ноября']],
 ['Вклады',['Открой вклад 100 тысяч под 16% на год','Вклад в Сбере 50 тысяч под 15 процентов на 6 месяцев']]
];
function phrasesHTML(){return `<div class="voice-phrases">${phrases.map(([title,list])=>`<section><h3>${esc(title)}</h3><ul>${list.map(p=>`<li><button type="button" data-try-phrase="${esc(p)}">«${esc(p)}»</button></li>`).join('')}</ul></section>`).join('')}</div>`;}
function showPhrases(){
 actionDialog('Что можно сказать',`<p class="muted">Зажмите микрофон и скажите фразу. моно сам откроет нужное окно и заполнит поля — останется проверить и сохранить.</p>${phrasesHTML()}<p class="tiny muted">Нажмите на фразу, чтобы попробовать без голоса.</p>`);
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-try-phrase]');if(b){const text=b.dataset.tryPhrase;$('#actionDialog').close();setTimeout(()=>openEntry(text.replace(/ — .*$/,'')),280);return;}
 if(e.target.closest('[data-voice-phrases]')){e.preventDefault();if($('#entryDialog').open)$('#entryDialog').close();showPhrases();}
});
root.MonoCommands={detect,run,showPhrases,phrasesHTML,parseWhen:t=>parseWhen({text:norm(t)})};
})(window);
