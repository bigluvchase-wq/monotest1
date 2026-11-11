(function(root){
'use strict';
const Schedule=typeof module==='object'?require('./schedule.js'):root.MonoSchedule,SpeechDates=typeof module==='object'?require('./speech-dates.js'):root.MonoSpeechDates;
const Speech=typeof module==='object'?require('./speech-categories.js'):root.MonoSpeechCategories;
const categories=['Кафе','Продукты','Транспорт','Авто','Покупки','Дом','Здоровье','Развлечения','Работа','Красота',...Speech.extraExpenses,...Speech.voiceExpenses,'Другое'];
const dictionary=[['Кафе',/кофе|кафе|ресторан|обед|ужин|завтрак|доставк.*ед|пицц|бургер/],['Продукты',/(?<!\p{L})(?:продукт|магазин|пят[её]роч|перекр[её]ст|магнит|вкусвилл|ашан|дикси|лента(?!\p{L})|самокат|куппер|хлеб|молок|булоч|булк|кола(?!\p{L})|колу(?!\p{L})|колы(?!\p{L})|кока[- ]?кол|coca[- ]?cola|pepsi|пепси|газиров|напит|сок(?!\p{L})|сока(?!\p{L})|соки(?!\p{L})|вод[ауы](?!\p{L})|сыр|яйц|яиц|мяс|куриц|рыб|овощ|фрукт|яблок|банан|карто|помидор|огур|макарон|круп|рис(?!\p{L})|греч|сахар|соль(?!\p{L})|масл|кефир|йогурт|творог|сметан|сливк|печень|конфет|шоколад|морожен|выпечк|батон|сосиск|колбас|чипс|сухар|чай(?!\p{L}))/u],['Авто',/автомойк|мойк[аиуе]|детейлинг|полировк[аиуе]|керамик[аиуе]|химчистк[аиуе] салон|шиномонтаж|балансировк|развал.?схождени|замен[аыуе] масла|заправк|заправил|заправился|азс|бензин|дизел|топлив|автосервис|техобслуживани|техосмотр|тонировк|эвакуатор|автозапчаст|запчаст[иь]|шин[аыу](?!\p{L})|резин[аыу](?!\p{L})|осаго|каско|парковк|стоянк|гибдд|платн[а-я]* дорог|автомобил|машин[аыу](?!\p{L})|лукойл|роснефть|газпром(?!\p{L}*\s*банк)/u],['Транспорт',/такси|метро|автобус|проезд|транспорт|электричк|поезд|самолет|самолёт|каршеринг/],['Здоровье',/аптек|лекарств|врач|здоров|анализ|массаж|стоматолог|клиник|психолог|терапевт/],['Дом',/квартир|аренд|коммун|интернет|ремонт/],['Развлечения',/кино|театр|игр|концерт|подписк|нетфликс|netflix|spotify|спотифай|музе|парк аттракцион/],['Красота',/красот|стриж|парикмахер|барбер|салон|маникюр|педикюр|косметик|бров|ресниц|эпиляц/],['Работа',/стриж|зарплат|аванс|гонорар|клиент|заказ|работ|песн|аранжировк/],['Покупки',/одежд|обув|футбол|подар|покупк|озон|ozon|wildberries|вайлдберриз|ламода|парикмахер|салон|маникюр|косметик/]];
const nums={ноль:0,один:1,одна:1,одну:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,двадцать:20,тридцать:30,сорок:40,пятьдесят:50,шестьдесят:60,семьдесят:70,восемьдесят:80,девяносто:90,сто:100,двести:200,триста:300,четыреста:400,пятьсот:500,шестьсот:600,семьсот:700,восемьсот:800,девятьсот:900,полторы:1.5,полтора:1.5,полтораста:150};
const numword='(?:'+Object.keys(nums).join('|')+'|тысяч[аиу]?|миллион(?:а|ов)?)';
const amountRe=new RegExp('(?<![\\p{L}\\d])(?:\\d{1,3}(?:[ \\u00a0]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?|'+numword+')(?:\\s+'+numword+')*(?![\\p{L}\\d])','giu');
function rubles(s){let total=0,group=0;for(const w of s.toLowerCase().split(/\s+/)){if(/^тысяч/.test(w)){total+=(group||1)*1000;group=0;}else if(/^миллион/.test(w)){total+=(group||1)*1e6;group=0;}else if(w in nums)group+=nums[w];else if(/^\d/.test(w))group+=Number(w.replace(',','.'));}return Math.round((total+group)*100);}
function amountValue(s){const compact=s.replace(/(\d)[ \u00a0](?=\d{3}(?:\D|$))/g,'$1');return rubles(compact);}
function clean(s){
 return Speech.normalizedName(s.replace(/(?<!\p{L})(?:сегодня|вчера|позавчера|утром|вечером|потом|затем|плюс|сразу|минус|потратил[аи]?|заплатил[аи]?|купил[аи]?|взял[аи]?|расходы?|получил[аи]?|заработал[аи]?|доход|рублей|рубля|рубль|руб\.?|наличными|наличкой|с основной карты|с карты|на карту|на основной сч[её]т|основная карта)(?!\p{L})|₽/giu,' ')
  .replace(/^[\s,.:;—\-]+|[\s,.:;—\-]+$/g,'').replace(/^(?:и|на|за|по)\s+/i,'').replace(/\s+/g,' ').trim().replace(/\s+(?:на|за|по)$/iu,'')
  .replace(/тридцатьшестьишесть/gu,'36,6').replace(/восемьдесятпять/gu,'85').replace(/аи(?:девяностодва|девяностопять|девяностовосемь|сто)/gu,x=>({'аидевяностодва':'АИ-92','аидевяностопять':'АИ-95','аидевяностовосемь':'АИ-98','аисто':'АИ-100'}[x])));
}
const notCompleted=/(?<!\p{L})(?:не\s+(?:покупал|купил|платил|заплатил|оплачивал|оплатил|тратил|потратил|получал|получил|переводил|перевел|вернул)[аи]?|(?:хочу|хотел[аи]?|планирую|собираюсь|надо|нужно|думал[аи]?|напомни)\s+(?:купить|оплатить|потратить|заплатить|перевести|заказать|отложить|вернуть|записать)|завтра|(?:куплю|оплачу|ожидаю)|сколько стоит|если)(?!\p{L})/u;
const accountMovement=/(?<!\p{L})(?:перев[её]л[аи]?|перевод|переведи|скинул[аи]?|перебросил[аи]?|снял[аи]?|снятие|положил[аи]?|закинул[аи]?.*(?:на карту|на накопительный)|пополнил[аи]? (?:свой |банковский |брокерский )*сч[её]т|вывел[аи]?.*сч[её]т[а-я]*|купил[аи]? валюту|обменял[аи]?)(?!\p{L})/u;
const ownMovement=/(?:между (?:своими )?(?:счетами|картами)|самому себе|(?:на|со?) (?:свой|свою|своего|своей|моей|мой)|с .*на (?:карту|накопительный)|снял[аи]?.*(?:банкомат|карт[а-я]*)|положил[аи]? наличн|брокерск|на накопительный)/u;
const quantityPattern=/(?<!\p{L})(?:купил[аи]?|взял[аи]?|заказал[аи]?)\s+(\d{1,3}|один|одну|одна|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять)\s+(\p{L}+(?:\s+\p{L}+){0,3}?)\s+(за|по)\s+(?=[\p{L}\d])/u;

function dateString(date){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
function normalizeTitle(title){return title.toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function parseLegacy(text,now=new Date(),history=[],modern=false){
if(!text.trim())return {entries:[],errors:['Сначала скажите или напишите операцию.']};
if(notCompleted.test(text))return {entries:[],errors:['Назовите уже совершённую операцию.']};
if(!Speech.income(text)&&!(modern&&Speech.expense(text)&&/(?<!\p{L})за\s+\p{L}/u.test(text))&&!['Ставки','Переводы','Подарки','Финансовые операции'].includes(Speech.expense(text))&&/(?:перев[её]л|перевод|снял|снятие|вернул|отмени|исправь)/i.test(text))return {entries:[],errors:['Переводы, возвраты и голосовые исправления пока не поддерживаются. Запишите обычный доход или расход.']};
if(/доллар|евро|тенге|юан|\$|€/i.test(text))return {entries:[],errors:['Пока поддерживаются только рубли. Валюта не будет пересчитана автоматически.']};
let errors=[],entries=[];
const clauses=[text.trim()];
for(let clause of clauses){
const quantity=clause.match(quantityPattern);
const units=quantity?.[3]==='по'?(nums[quantity[1]]??Number(quantity[1])):1;
if(quantity)clause=clause.slice(0,quantity.index)+quantity[2]+' '+quantity[3]+' '+clause.slice(quantity.index+quantity[0].length);
const matches=[...clause.matchAll(amountRe)];
if(!matches.length){errors.push('Не найдена сумма: «'+clause+'».');continue;}
const before=clean(clause.slice(0,matches[0].index));
const amountFirst=!before;
for(let i=0;i<matches.length;i++){
const m=matches[i], next=matches[i+1];
const context=amountFirst?clause.slice(m.index+m[0].length,next?.index??clause.length):clause.slice(i?matches[i-1].index+matches[i-1][0].length:0,m.index);
const info=matches.length===1?clause:context;
let title=clean(context);if(matches.length===1)title=clean(clause.replace(m[0],''));
const amount=amountValue(m[0])*units;
if(!Number.isSafeInteger(amount)||amount<=0||amount>1e12){errors.push('Проверьте сумму: «'+m[0]+'».');continue;}
let date=new Date(now);if(/позавчера/i.test(clause))date.setDate(date.getDate()-2);else if(/вчера/i.test(clause))date.setDate(date.getDate()-1);
const income=Speech.income(info),type=income?'income':'expense';
const saved=[...history].reverse().find(e=>e.categoryChosen===true&&e.type===type&&normalizeTitle(e.title)===normalizeTitle(title)&&categories.includes(e.category));
const category=saved?.category||(modern||income!=='Другое'?income:null)||Speech.expense(info)||dictionary.find(([,re])=>re.test(info.toLowerCase()))?.[0]||'Другое';
entries.push({title:title?title[0].toUpperCase()+title.slice(1):type==='income'?'Доход':'Расход',amount,type,category,account:/налич/i.test(info)?'cash':'main',date:dateString(date)});
}}
return {entries,errors};}

const currencies=['RUB','USD','EUR','GBP','KZT','CNY','AED','TRY','GEL','AMD'];
const incomeCategories=['Зарплата','Работа','Подарки','Проценты','Продажи',...Speech.extraIncome,...Speech.voiceIncome,'Другое'];
const uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const isMoney=n=>Number.isSafeInteger(n)&&Math.abs(n)<=1e12;
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&dateString(new Date(d+'T12:00:00'))===d;
const initialState=()=>({version:2,accounts:[{id:'main',name:'Основной счёт',initial:0,currency:'RUB'}],entries:[],categories:[...categories],incomeCategories:[...incomeCategories],limits:{},goals:[],deposits:[],payments:[],settings:{theme:'system',language:'ru',onboarded:false,beautyCategoryAdded:true,speechCategoriesAdded:true,autoCategoryAdded:true,voiceCategoriesAdded:true,voiceFlowsAdded:true},tickets:[]});
function migrate(s){
if(s?.version===2){const next=structuredClone(s);if(!next.settings.beautyCategoryAdded){if(!next.categories.includes('Красота'))next.categories.splice(Math.max(0,next.categories.indexOf('Другое')),0,'Красота');next.settings.beautyCategoryAdded=true;}
if(!next.settings.speechCategoriesAdded){
 for(const [list,additions] of [[next.categories,Speech.extraExpenses],[next.incomeCategories,Speech.extraIncome]]){
  for(const name of additions)if(!list.includes(name))list.splice(list.indexOf('Другое'),0,name);
 }
 next.settings.speechCategoriesAdded=true;
}
if(!next.settings.autoCategoryAdded){if(!next.categories.includes('Авто')){const i=next.categories.indexOf('Транспорт');next.categories.splice(i>=0?i+1:Math.max(0,next.categories.indexOf('Другое')),0,'Авто');}next.settings.autoCategoryAdded=true;}
if(!next.settings.voiceCategoriesAdded){
 for(const [list,additions] of [[next.categories,Speech.voiceExpenses],[next.incomeCategories,Speech.voiceIncome]]){
  for(const name of additions)if(!list.includes(name))list.splice(list.indexOf('Другое'),0,name);
 }
 next.settings.voiceCategoriesAdded=true;
}
if(!next.settings.voiceFlowsAdded){
 for(const name of Speech.voiceIncome)if(!next.incomeCategories.includes(name))next.incomeCategories.splice(next.incomeCategories.indexOf('Другое'),0,name);
 next.settings.voiceFlowsAdded=true;
}
return next;}
if(s?.version!==1)throw Error('Неподдерживаемая версия данных');
return {...initialState(),accounts:s.accounts.map(a=>({...a,currency:'RUB'})),entries:s.entries.map(e=>({...e})),limits:{RUB:{...s.limits}},settings:{theme:'system',language:'ru',onboarded:false,beautyCategoryAdded:true,speechCategoriesAdded:true,autoCategoryAdded:true,voiceCategoriesAdded:true,voiceFlowsAdded:true}};
}
function balance(state,id){const a=state.accounts.find(a=>a.id===id);if(!a)return 0;return a.initial+state.entries.reduce((sum,e)=>{
if(e.type==='transfer')return sum-(e.account===id?e.amount:0)+(e.toAccount===id?(e.toAmount||e.amount):0);
return sum+(e.account===id?(e.type==='income'?e.amount:-e.amount):0);
},0);}
function goalBalance(state,id){return state.entries.filter(e=>e.type==='saving'&&e.goalId===id).reduce((sum,e)=>sum+e.amount,0);}
function totals(state,currency){return {available:state.accounts.filter(a=>a.currency===currency).reduce((s,a)=>s+balance(state,a.id),0),saved:state.goals.filter(g=>g.currency===currency).reduce((s,g)=>s+goalBalance(state,g.id),0)};}
function validateState(input){try{
if(!input||![1,2].includes(input.version))return false;
const s=input.version===1?migrate(input):input;
if(!Array.isArray(s.accounts)||!s.accounts.length||s.accounts.length>100||new Set(s.accounts.map(a=>a.id)).size!==s.accounts.length)return false;
if(!s.accounts.every(a=>a&&typeof a.id==='string'&&typeof a.name==='string'&&a.name.trim()&&a.name.length<=100&&isMoney(a.initial)&&currencies.includes(a.currency)))return false;
if(!Array.isArray(s.categories)||!Array.isArray(s.incomeCategories)||![...s.categories,...s.incomeCategories].every(c=>typeof c==='string'&&c.trim()&&c.length<=80)||!s.categories.includes('Другое')||!s.incomeCategories.includes('Другое'))return false;
if(!Array.isArray(s.goals)||!s.goals.every(g=>g&&typeof g.id==='string'&&typeof g.name==='string'&&g.name.trim()&&g.name.length<=100&&(g.target===null&&g.general===true||isMoney(g.target)&&g.target>0)&&currencies.includes(g.currency)&&(g.icon===undefined||['car','home','gift','palm','bike','phone','camera','appliance','study','heart','laptop','plane','ring','pet','fitness','music','renovation','safety','business','boat'].includes(g.icon)))||new Set(s.goals.map(g=>g.id)).size!==s.goals.length)return false;
if(s.deposits!==undefined&&(!Array.isArray(s.deposits)||!s.deposits.every(d=>d&&typeof d.id==='string'&&typeof d.name==='string'&&isMoney(d.principal)&&d.principal>0&&Number.isFinite(d.rate)&&d.rate>0&&validDate(d.start)&&validDate(d.end)&&['daily','monthly'].includes(d.payout)&&Number.isInteger(d.posted)&&Number.isInteger(d.postedAmount))||new Set(s.deposits.map(d=>d.id)).size!==s.deposits.length))return false;
if(!Array.isArray(s.entries)||new Set(s.entries.map(e=>e?.id)).size!==s.entries.length)return false;
if(!s.entries.every(e=>{const a=s.accounts.find(a=>a.id===e?.account);if(!e||!a||typeof e.id!=='string'||typeof e.title!=='string'||!e.title.trim()||e.title.length>300||!isMoney(e.amount)||e.amount<=0||!validDate(e.date)||!['income','expense','saving','transfer'].includes(e.type))return false;
if(e.createdAt!==undefined&&!(typeof e.createdAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(e.createdAt)&&Number.isFinite(Date.parse(e.createdAt))&&new Date(e.createdAt).toISOString()===(e.createdAt.includes('.')?e.createdAt:e.createdAt.replace('Z','.000Z'))))return false;
if(e.type==='saving')return s.goals.some(g=>g.id===e.goalId&&g.currency===a.currency);
if(e.type==='transfer'){const to=s.accounts.find(a=>a.id===e.toAccount);return !!to&&to.id!==a.id&&isMoney(e.toAmount)&&e.toAmount>0&&(to.currency!==a.currency||e.toAmount===e.amount);}
return [...s.categories,...s.incomeCategories].includes(e.category)&&(e.categoryChosen===undefined||typeof e.categoryChosen==='boolean');}))return false;
if(!s.limits||Object.entries(s.limits).some(([c,ls])=>!currencies.includes(c)||!ls||typeof ls!=='object'||Object.entries(ls).some(([k,v])=>!s.categories.includes(k)||!isMoney(v)||v<0)))return false;
if(!Array.isArray(s.payments)||new Set(s.payments.map(p=>p?.id)).size!==s.payments.length||!s.payments.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&p.name.trim()&&p.name.length<=100&&isMoney(p.amount)&&p.amount>0&&s.accounts.some(a=>a.id===p.account)&&s.categories.includes(p.category)&&validDate(p.date)&&['once','monthly','daily','weekly','fortnightly'].includes(p.repeat)&&(p.reminderTime===undefined||typeof p.reminderTime==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(p.reminderTime))&&Number.isInteger(p.remindDays)&&p.remindDays>=0&&p.remindDays<=30))return false;
if(!s.settings||!['system','light','dark','black','purple','green','burgundy'].includes(s.settings.theme)||!['ru','en'].includes(s.settings.language))return false;
if(!Array.isArray(s.tickets)||!s.tickets.every(t=>t&&typeof t.id==='string'&&typeof t.text==='string'&&t.text.length<=5000&&typeof t.date==='string'))return false;
return true;
}catch{return false;}}
function slang(text){const hundreds=['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];return text.toLowerCase().replace(/(?<!\p{L})пятихатк[ауи]?(?!\p{L})/gu,'пятьсот').replace(/(?<!\p{L})(?:питик|пятик)(?!\p{L})/gu,'пять тысяч').replace(/(?<!\p{L})косар[ьяей]+(?!\p{L})|(?<!\p{L})касар[ьяей]+(?!\p{L})/gu,'тысячи').replace(/(?<!\p{L})касарь(?!\p{L})|(?<!\p{L})косарь(?!\p{L})/gu,'тысяча').replace(/(?<!\p{L})тыщ[а-яё]*(?!\p{L})/gu,'тысячи').replace(/(?<!\p{L})сотк[ауи](?!\p{L})/gu,'__HUNDRED__').replace(/(одна|одну|две|два|три|четыре|пять|шесть|семь|восемь|девять|\d+)\s+__HUNDRED__/g,(_,n)=>String((nums[n]||Number(n))*100)).replace(/__HUNDRED__/g,'сто').replace(/(?<!\p{L})(один|одна|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять)\s+(?=сто(?:\s|$)|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот)/gu,'$1 тысячи ').replace(/(тысяч[аиу]?)\s+([1-9]00)(?!\d)/gu,(_,th,n)=>th+' '+hundreds[Number(n)/100]);}
function matchGoal(clause,goals){
 const stop=new Set(['на','в','для','и','к','цель']);
 const stem=w=>{w=normalizeTitle(w);const r=w.replace(/(?:иями|ями|ами|ого|ему|ому|ыми|ими|ая|яя|ую|юю|ое|ее|ий|ый|ой|ов|ев|ам|ям|ах|ях|ом|ем|ы|и|а|я|у|ю|е)$/u,'');return r.length>=3?r:w;};
 const tokens=[...clause.matchAll(/[\p{L}\p{N}]+/gu)].map(m=>({word:stem(m[0]),start:m.index,end:m.index+m[0].length}));
 const matches=[];
 for(const goal of [...goals].sort((a,b)=>b.name.length-a.name.length)){
  const wanted=normalizeTitle(goal.name).split(' ').filter(w=>!stop.has(w)).map(stem),used=[];
  if(!wanted.length)continue;
  if(wanted.every(w=>{const i=tokens.findIndex((t,j)=>t.word===w&&!used.includes(j));if(i<0)return false;used.push(i);return true;}))matches.push({goal,used,exact:(' '+normalizeTitle(clause)+' ').includes(' '+normalizeTitle(goal.name)+' ')});
 }
 if(!matches.length)return null;
 matches.sort((a,b)=>b.used.length-a.used.length||Number(b.exact)-Number(a.exact));const chosen=matches[0];if(matches.some(m=>m!==chosen&&(!m.used.every(i=>chosen.used.includes(i))||(m.used.length===chosen.used.length&&m.exact===chosen.exact))))return {ambiguous:true};
 let amountText=clause;for(const i of chosen.used.sort((a,b)=>b-a))amountText=amountText.slice(0,tokens[i].start)+' '.repeat(tokens[i].end-tokens[i].start)+amountText.slice(tokens[i].end);
 return {goal:chosen.goal,amountText};
}
// Split continuous dictation before classifying transfers, loans and savings.
function splitSpokenOperations(text){
 const quantity=text.match(quantityPattern);
 const matches=[...text.matchAll(amountRe)].filter(m=>!quantity||m.index>=quantity.index+quantity[0].length||m.index<quantity.index);
 if(matches.length<2)return [text];
 const connector=/(?<!\p{L})(?:потом|затем|плюс|из них|в обед|утром|вечером|(?:я )?сразу|купил[аи]?|заказал[аи]?|заплатил[аи]?|оплатил[аи]?|закинул[аи]?|перевел[аи]?|отложил[аи]?|снял[аи]?)(?!\p{L})/u;
 const currencyPrefix=/^\s*(?:(?:руб(?:лей|ля|ль)?|евро|доллар[а-я]*|тенге|юан[а-яь]*|rub|usd|eur|kzt|cny)(?!\p{L})|[₽$€])/u;
 const pieces=[];
 let start=0;
 for(let i=0;i<matches.length-1;i++){
  const m=matches[i],end=m.index+m[0].length;
  const gap=text.slice(end,matches[i+1].index),currency=gap.match(currencyPrefix)?.[0]||'';
  const words=gap.slice(currency.length),signal=words.match(connector);
  if(!/\p{L}/u.test(words))continue;
  const amountFirst=!clean(text.slice(start,m.index));
  const cut=amountFirst?(signal?end+currency.length+signal.index:matches[i+1].index):
   signal&&/^\s+на пару дней\s*$/u.test(words.slice(0,signal.index))?end+currency.length+signal.index:end+currency.length;
  if(cut>start){pieces.push(text.slice(start,cut).trim());start=cut;}
 }
 return [...pieces,text.slice(start).trim()];
}
function parse(text,now=new Date(),history=[],state=null,defaultAccount='main'){
text=slang(text)
 .replace(/(снял[аи]?\s+)десятк[ау](?=\s+(?:в банкомате|с карты))/gu,'$1десять тысяч')
 .replace(/,\s+(?=котор(?:ый|ая|ые|ую|ое|ого)\s)/gu,' ')
 .replace(/\s+и получил[аи]?\s+перевод(?=\s*[.!?]?\s*$)/u,'')
 .replace(/,\s*(долг вернул[аи]?)(?=\s*[.!?]?\s*$)/u,' $1')
 .replace(/(давал[аи]? в долг),\s*(?=[\p{L}\d])/u,'$1 ')
 .replace(/(?<!\p{L})(один|одна|две|два|три|четыре|пять|шесть|семь|восемь|девять|\d+)\s+с половиной\s+(?=тысяч[аиу]?(?!\p{L}))/gu,(_,n)=>String((nums[n]??Number(n))+.5)+' ')
 .replace(/(?<!\p{L})руб\.(?!\p{L})/gu,'рублей')
 .replace(/(?<!\p{L})аи[ -]?(92|95|98|100)(?!\d)/gu,(_,n)=>'аи'+({'92':'девяностодва','95':'девяностопять','98':'девяностовосемь','100':'сто'}[n]))
 .replace(/(?<![\p{L}\d])36[., ]6(?![\p{L}\d])/gu,'аптека тридцатьшестьишесть')
 .replace(/(?<!\p{L})(?:теле|т|t) 2(?![\p{L}\d])/gu,'теле2')
 .replace(/(?<!\p{L})4 лапы(?!\p{L})/gu,'четыре лапы')
 .replace(/(?<!\p{L})цех 85(?![\p{L}\d])/gu,'цех восемьдесятпять');
const entries=[],errors=[];
if(/^(?:может быть|если|я думал[аи]?|в следующем месяце ожидаю)(?!\p{L})/u.test(text.trim()))return {entries,errors:['Назовите уже совершённую операцию.']};
const clauses=SpeechDates.clauses(text,now,s=>[...s.matchAll(amountRe)].length>0);
if(!clauses.length)return {entries,errors:['Сначала скажите или напишите операцию.']};
if(!state){for(const part of clauses){if(part.error){errors.push(part.error);continue;}const result=parseLegacy(part.text,part.now,history);entries.push(...result.entries);errors.push(...result.errors);}return {entries,errors};}
let previous='';
for(const part of clauses.flatMap(part=>part.error?[part]:splitSpokenOperations(part.text).map(text=>({...part,text})))){
if(part.error){errors.push(part.error);continue;}let clause=part.text;const clauseNow=part.now;
if(/тысяч|миллион/u.test(previous)&&/из них|отложил[аи]? (?:в копилку|на накопления)|билет[а-я]* в отпуск/u.test(clause)){
 const amounts=[...clause.matchAll(amountRe)];
 if(amounts.length===1&&/^\d{1,2}$/.test(amounts[0][0])&&!/руб|евро|доллар|₽|тенге/u.test(clause)){
  const {index}=amounts[0];
  clause=clause.slice(0,index)+Number(amounts[0][0])*1000+clause.slice(index+amounts[0][0].length);
 }
}
if(/^(?:корм|наполнител[а-я]*)(?!\p{L})/u.test(clause)&&Speech.expense(previous)==='Питомцы')clause+=' для питомца';
previous=part.text;
let account=state.accounts.find(a=>a.id===defaultAccount)||state.accounts[0];
if(notCompleted.test(clause)){errors.push('Назовите уже совершённую операцию.');continue;}
if(/с половиной(?!\s+тысяч)/u.test(clause)){errors.push('Уточните сумму целиком и назовите валюту.');continue;}
if(/на прошлой неделе/u.test(clause)){errors.push('Назовите точный день платежа.');continue;}
if(/^(?:я )?купил[аи]? нов(?:ый|ую|ое)\s/u.test(clause)&&!/чехол|аксессуар/u.test(clause)&&entries.at(-1)?.category==='Продажи'&&/телефон|смартфон/u.test(entries.at(-1).title.toLowerCase()))clause=clause.replace(/нов(?:ый|ую|ое)/u,'новый телефон');
const expenseCategory=Speech.expense(clause),incomeCategory=Speech.income(clause);
const internal=accountMovement.test(clause)&&ownMovement.test(clause)&&!['Переводы','Подарки','Финансовые операции'].includes(expenseCategory);
if(accountMovement.test(clause)&&!internal&&!incomeCategory&&!/(?<!\p{L})за\s+\p{L}/u.test(clause)&&!['Ставки','Переводы','Подарки','Финансовые операции'].includes(expenseCategory)){
 errors.push('Уточните, кому перевели деньги или между какими своими счетами их переместили.');
 continue;
}
if(/^(?:я )?получил[аи]?.*от (?:друга|подруги|коллеги|мамы|папы)\s*[.!?]?\s*$/u.test(clause)){errors.push('Уточните, это перевод, подарок, заём или возврат долга?');continue;}
if(/^(?:я )?вернул[аи]? (?:товар|покупку)/u.test(clause)&&!incomeCategory){errors.push('Деньги за покупку уже вернули?');continue;}
if(/^(?:я )?(?:вернул[аи]?|получил[аи]?|пришло|заплатил[аи]?)\s+(?:\d|од[ни]|дв|тр|чет|пят|тысяч)/u.test(clause)&&!expenseCategory&&(!incomeCategory||incomeCategory==='Другое')&&clean(clause.replace(amountRe,'')).replace(/^(?:я |вернул[аи]?|пришло)\s*/gu,'')===''){
 errors.push('Уточните, за что или от кого поступили деньги.');continue;
}
const named=[...state.accounts].sort((a,b)=>b.name.length-a.name.length).find(a=>(' '+normalizeTitle(clause)+' ').includes(' '+normalizeTitle(a.name)+' '));
if(named&&!internal){account=named;clause=clause.replace(new RegExp(named.name.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&'),'i'),'');}
const currencyToken=/(?<!\p{L})(?:доллар[а-я]*|usd|евро|eur|тенге|kzt|юан[а-яь]*|cny|рубл[а-я]*|руб|rub)(?!\p{L})|[$€₽]/u;
const currencyWord=clause.match(currencyToken)?.[0]||'';
const currency=/доллар|usd|\$/u.test(currencyWord)?'USD':/евро|eur|€/u.test(currencyWord)?'EUR':/тенге|kzt/u.test(currencyWord)?'KZT':/юан|cny/u.test(currencyWord)?'CNY':currencyWord?'RUB':null;
if(internal){
 const accounts=state.accounts.filter(a=>!currency||a.currency===currency);
 const amountMatches=[...clause.matchAll(amountRe)];
 const amount=amountMatches.length===1?amountValue(amountMatches[0][0]):0;
 if(!isMoney(amount)||amount<=0||state.accounts.length<2||!accounts.length){
  errors.push('Для перевода между своими нужны два счёта и одна сумма списания.');continue;
 }
 entries.push({title:'Между своими',type:'transfer',amount,account:null,toAccount:null,sourceCurrency:currency,date:dateString(clauseNow)});
 continue;
}
if(currency&&currency!==account.currency){errors.push('Выберите счёт в '+currency+' для фразы «'+clause+'».');continue;}
if(currencyWord)clause=clause.replace(currencyToken,' ');
const loan=/(?<![\p{L}])(?:в\s+долг|одолж(?:ил[аи]?|ить|и|у)|заня(?:л[аи]?|ть)\s*(?:деньги|денег)?|дал[аи]?\s+(?:деньги|денег)|вернул[аи]?\s+долг|закинул[аи]?\s+другу)(?![\p{L}])/iu.test(clause);
if(loan&&!Speech.income(clause)&&Speech.expense(clause)!=='Ставки'){const matches=[...clause.matchAll(amountRe)];if(/(?:^|\s)не\s/i.test(clause)||matches.length!==1||amountValue(matches[0][0])<=0){errors.push('Уточните одну положительную сумму для записи в долг.');continue;}const date=clauseNow;entries.push({title:/(?:вернул|отдал)/u.test(clause)?'Возврат долга':'В долг',amount:amountValue(matches[0][0]),type:'expense',category:state.categories.includes('Финансовые операции')?'Финансовые операции':'Другое',account:account.id,date:dateString(date)});continue;}
const explicitExpense=!!incomeCategory||['Переводы','Подарки'].includes(expenseCategory)||/закинул[аи]? (?:на (?:телефон|проездн|брокерск)|ипотек)/u.test(clause)||/минус|потрат|купил|заплат|оплатил|расход|получил|заработал|зарплат|продал|пополнил[аи]? (?:телефон|транспорт)/i.test(clause);
const goalMatch=!explicitExpense&&Speech.expense(clause)!=='Ставки'&&!Speech.installment(clause)?matchGoal(clause,state.goals):null;
if(goalMatch?.ambiguous){errors.push('Назовите одну цель для каждой суммы.');continue;}
if(goalMatch?.goal){const goal=goalMatch.goal;if(/минус|снял|вывел|забрал|вернул/i.test(clause)){errors.push('Для пополнения цели укажите положительную сумму.');continue;}if(/(?:^|\s)не\s/i.test(clause)){errors.push('Не удалось однозначно понять пополнение цели.');continue;}const matches=[...goalMatch.amountText.matchAll(amountRe)];if(matches.length!==1){errors.push('Укажите одну сумму для цели «'+goal.name+'».');continue;}if(account.currency!==goal.currency){errors.push('Цель и счёт должны быть в одной валюте.');continue;}
entries.push({title:'На '+goal.name,amount:amountValue(matches[0][0]),type:'saving',account:account.id,goalId:goal.id,date:dateString(clauseNow)});continue;}
if(/(?:на|в)\s+накоплен|(?:на|в)\s+сбережен|отложил[аи]?\s+в копилку/u.test(clause)&&!explicitExpense){
 const matches=[...clause.matchAll(amountRe)],amount=matches.length===1?amountValue(matches[0][0]):0;
 if(!isMoney(amount)||amount<=0||/(?:^|\s)(?:не|минус|снял|вывел|забрал)\s/u.test(clause)){errors.push('Назовите одну положительную сумму для накоплений.');continue;}
 const goal=state.goals.find(g=>g.general&&g.currency===account.currency);
 entries.push({title:'В накопления',amount,type:'saving',account:account.id,goalId:goal?.id||null,date:dateString(clauseNow)});continue;
}
if(/цель|накоплен|отлож|закин|пополни|перелож/i.test(clause)&&!explicitExpense&&Speech.expense(clause)!=='Ставки'){errors.push('Сначала создайте цель в разделе «Цели», затем скажите «на отпуск десять тысяч».');continue;}
if(/долями плюс/u.test(clause)){errors.push('Для «Долями Плюс» добавьте платежи по графику из договора.');continue;}
const r=parseLegacy(clause,clauseNow,history,true);errors.push(...r.errors);
for(const e of r.entries){e.account=account.id;const cash=state.accounts.find(a=>/налич/i.test(a.name)&&a.currency===account.currency);if(/налич/i.test(clause)&&cash)e.account=cash.id;
const all=e.type==='income'?state.incomeCategories:state.categories;
const learned=[...history].reverse().find(h=>h.categoryChosen&&h.type===e.type&&normalizeTitle(h.title)===normalizeTitle(e.title)&&all.includes(h.category));
if(learned)e.category=learned.category;
if(e.type==='income'&&Speech.income(clause)==='Возвраты'){
 const refund=refundMatch(history,e,clause);
 if(refund)e.refundOf=refund.id;
}
if(e.type==='expense'&&Speech.installment(clause)){
 if(r.entries.length!==1||e.amount<4){errors.push('Для «Долями» укажите одну полную сумму покупки.');continue;}
 e.installmentTotal=e.amount;
 e.amount=installmentParts(e.amount)[0];
 e.title=e.title.replace(/(?<!\p{L})долями(?!\p{L})/iu,'').replace(/^(?:оплатил[аи]?|за)\s*/iu,'').trim()||'Покупка';
 e.title=e.title[0].toUpperCase()+e.title.slice(1);
}
if(!all.includes(e.category))e.category='Другое';entries.push(e);}
}
return {entries,errors};}

function refundMatch(history,entry,clause){
 const subject=normalizeTitle(clause.match(/(?:за|по покупке)\s+([^\d]+)/iu)?.[1]||'')
  .replace(/\s+(?:рублей|рубля|рубль|руб|тысяч[аиу]?)$/u,'');
 if(!subject)return null;
 const term=subject.replace(/(?:ами|ями|ов|ев|ом|ем|[уыаиоея])$/u,'');
 if(term.length<4)return null;
 const matches=history.filter(e=>e.type==='expense'&&e.account===entry.account&&e.amount===entry.amount&&e.date<=entry.date&&normalizeTitle(e.title).split(' ').some(w=>w.startsWith(term)));
 return matches.length===1?matches[0]:null;
}
function installmentParts(total){
 const base=Math.floor(total/4),remainder=total%4;
 return Array.from({length:4},(_,i)=>base+(i<remainder?1:0));
}
function installmentPlan(total,date){
 return installmentParts(total).map((amount,i)=>{
  const due=new Date(date+'T12:00:00');
  due.setDate(due.getDate()+i*14);
  return {amount,date:dateString(due)};
 });
}
function saveDrafts(state,drafts,createdAt=new Date().toISOString()){
 const next=structuredClone(state);
 const added=drafts.map(({installmentTotal,sourceCurrency,...draft})=>{
  const entry={...draft,title:draft.title.trim(),id:uid(),createdAt};
  if(entry.type==='transfer'){
   const from=next.accounts.find(a=>a.id===entry.account),to=next.accounts.find(a=>a.id===entry.toAccount);
   if(!from||!to||from.id===to.id)throw Error('Выберите два разных счёта для перевода.');
   if(sourceCurrency&&sourceCurrency!==from.currency)throw Error('Выберите счёт списания в '+sourceCurrency+'.');
   if(from.currency===to.currency)entry.toAmount=entry.amount;
  }
  if(entry.type==='saving'&&!entry.goalId){
   const currency=next.accounts.find(a=>a.id===entry.account)?.currency;
   let goal=next.goals.find(g=>g.general&&g.currency===currency);
   if(!goal){goal={id:uid(),name:'Накопления',currency,target:null,general:true};next.goals.push(goal);}
   entry.goalId=goal.id;
  }
  if(installmentTotal!==undefined){
   if(entry.type!=='expense'||!isMoney(installmentTotal)||installmentTotal<4||!validDate(entry.date))throw Error('Проверьте график «Долями».');
   const [first,...rest]=installmentPlan(installmentTotal,entry.date);
   entry.amount=first.amount;
   rest.forEach((due,i)=>next.payments.push({...due,id:uid(),name:entry.title.slice(0,78)+' · Долями '+(i+2)+'/4',account:entry.account,category:entry.category,repeat:'once',remindDays:0,reminderTime:'09:00'}));
  }
  return entry;
 });
 next.entries.push(...added);
 if(!validateState(next))throw Error('Проверьте поля каждой записи.');
 return {next,added};
}

function nextPayment(payment,now=new Date()){return Schedule.next(payment,dateString(now));}
function addEntry(state,entry){const next=structuredClone(state);next.entries.push({...entry,id:entry.id||uid(),createdAt:entry.createdAt??new Date().toISOString()});if(!validateState(next))throw Error('Проверьте операцию');return next;}
const api={categories,incomeCategories,currencies,parse,balance,goalBalance,totals,validateState,dateString,initialState,migrate,slang,nextPayment,addEntry,normalizeTitle,installmentPlan,saveDrafts};if(typeof module!=='undefined')module.exports=api;root.MonoEngine=api;
})(typeof window!=='undefined'?window:globalThis);
