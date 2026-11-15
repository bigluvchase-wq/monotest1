(function(root){
'use strict';
const E=typeof module==='object'?require('./engine.js'):root.MonoEngine;
function parse(text,state,account,today=E.dateString(new Date())){
 if(typeof text!=='string'||text.length>300000)throw Error('Слишком много текста. Разделите документ.');
 const entries=[],errors=[];let date=null,assumed=false,previous='';
 const lines=text.replace(/\r/g,'').split('\n');
 const datePattern=/(?<!\d)(\d{2})[./](\d{2})[./](\d{4})(?!\d)/;
 for(let raw of lines){
  if(raw.includes('\f')){date=null;previous='';continue;}
  let line=raw.trim();if(!line)continue;
  if(/^(сегодня|вчера)$/iu.test(line)){const day=new Date(today+'T12:00:00');if(/^вчера$/iu.test(line))day.setDate(day.getDate()-1);date=E.dateString(day);previous='';continue;}
  if(/баланс|остаток|итого|всего|доступно|оборот|кешбэк|кэшбэк|бонус|номер сч[её]та|бик|инн/iu.test(line)){previous='';continue;}
  const d=line.match(datePattern);if(d){date=`${d[3]}-${d[2]}-${d[1]}`;if(E.dateString(new Date(date+'T12:00:00'))!==date){errors.push('Некорректная дата: '+d[0]);date=null;continue;}line=line.replace(d[0],'').replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g,'').trim();}
  if(!line)continue;
  const signed=[...line.matchAll(/([+−–-])\s*(\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*(?:₽|руб\.?))?/gu)];
  if(signed.length===1){const m=signed[0],amount=Math.round(Number(m[2].replace(/[ \u00a0\u202f]/g,'').replace(',','.'))*100);
   const title=line.replace(m[0],'').replace(/^[\s|:;]+|[\s|:;]+$/g,'').trim()||previous;
   if(!title||!Number.isSafeInteger(amount)||amount<=0){errors.push('Проверьте строку: '+raw);continue;}
   if(date&&date>today){errors.push('Будущая операция пропущена: '+raw);continue;}
   const type=m[1]==='+'?'income':'expense',categories=type==='income'?state.incomeCategories:state.categories;
   const parsed=E.parse(`${type==='income'?'доход':'купил'} ${title} ${amount/100}`,new Date((date||today)+'T12:00:00'),state.entries,state,account);
   entries.push({title:title.slice(0,300),amount,type,category:categories.includes(parsed.entries[0]?.category)?parsed.entries[0].category:'Другое',date:date||today,account});if(!date)assumed=true;previous='';
  }else if(signed.length>1){errors.push('В строке несколько сумм: '+raw);previous='';}
  else {
   // Plain notes require an explicit financial action; bare bank amounts are ambiguous.
   if((/купил|потрат|заплат|оплат|расход|доход|зарплат|получил|заработал/iu.test(line)||!date&&/[\p{L}]/u.test(line))&&/\d/.test(line)){
    const r=E.parse(line,new Date((date||today)+'T12:00:00'),state.entries,state,account);
    if(r.errors.length)errors.push(...r.errors);else{entries.push(...r.entries);if(!date)assumed=true;}
   }else previous=line;
  }
  if(entries.length>200)throw Error('Больше 200 операций. Разделите документ на части.');
 }
 return {entries,errors,assumed};
}
let busy=false;
async function recognize(file){
 if(!root.MonoNative?.recognizeDocument)throw Error('Распознавание изображений и PDF доступно в новой сборке приложения для iPhone.');
 if(busy)throw Error('Дождитесь завершения распознавания.');busy=true;
 const originPage=page,wasOpen=document.querySelector('#entryDialog').open,originalText=document.querySelector('#dictation').value;
 try{
  notify('Распознаём документ на iPhone…',false,{duration:10000});
  const text=await root.MonoNative.recognizeDocument(file);
  if(page!==originPage||wasOpen&&(!document.querySelector('#entryDialog').open||document.querySelector('#dictation').value!==originalText)){notify('Импорт отменён: экран или текст изменились.');return;}
  // Preserve table structure when PDF text extraction produced actual columns.
  let r;
  if(root.MonoBankImport&&text.includes('\t')){try{const rows=MonoBankImport.tableToItems(MonoBankImport.parseCSV(text));if(rows.length)r={entries:rows.map(e=>({...e,account:voiceAccount,category:MonoBankImport.categorize(e,e.type==='income'?state.incomeCategories:state.categories)})),errors:[],assumed:false};}catch{}}
  r=r||parse(text,state,voiceAccount);
  if(!r.entries.length)throw Error('Не нашли однозначных операций. Нужны даты, названия и суммы со знаком +/− либо текст «купил…», «получил…». Попробуйте более чёткий снимок или CSV.');
  if(r.entries.length>200)throw Error('Больше 200 операций. Разделите документ.');
  openEntry();drafts=r.entries;parseErrors=[];renderDrafts();
  const warnings=['Строки без явного направления могут быть предложены как расходы. Проверьте каждую сумму, тип, дату, валюту счёта и категорию. Документ ещё не сохранён.'];
  if(r.assumed)warnings.push('Для записей без даты предложена сегодняшняя дата.');
  if(r.errors.length)warnings.push('Некоторые строки не разобраны: '+r.errors.slice(0,5).join('; '));
  const duplicates=r.entries.filter(e=>state.entries.some(x=>x.account===e.account&&x.date===e.date&&x.type===e.type&&x.amount===e.amount&&E.normalizeTitle(x.title)===E.normalizeTitle(e.title))).length;
  if(duplicates)warnings.push('Возможные повторы: '+duplicates+'. Удалите лишние черновики перед сохранением.');
  document.querySelector('#parseErrors').textContent=warnings.join(' ');
 }finally{busy=false;}
}
function pick(){if(busy){notify('Дождитесь завершения распознавания.');return;}const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;document.body.append(input);input.oncancel=()=>input.remove();input.onchange=async()=>{const file=input.files?.[0];input.remove();if(!file)return;try{await recognize(file);}catch(e){notify(e.message);}};input.click();}
const api={parse};root.MonoDocumentImport={...api,pick,recognize};if(typeof module==='object')module.exports=api;
if(typeof document!=='undefined')document.addEventListener('click',e=>{if(e.target.closest('[data-document-pick]'))pick();});
})(typeof window==='object'?window:globalThis);
