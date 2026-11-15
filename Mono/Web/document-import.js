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
function bankTable(payload){
 if(payload?.format!=='mono-bank-table-v1'||!Array.isArray(payload.rows)||!payload.rows.length||payload.rows.length>5000||typeof payload.sourceText!=='string')throw Error('Не удалось прочитать структуру выписки.');
 const B=root.MonoBankImport||(typeof module==='object'?require('./bank-import'):null);
 const items=payload.rows.map(row=>{
  if(!row||typeof row.date!=='string'||typeof row.amount!=='string'||typeof row.title!=='string')throw Error('Повреждена строка выписки.');
  const date=B.parseDate(row.date),n=B.parseAmount(row.amount.replace(/\s/g,' ')),title=row.title.replace(/\s+/g,' ').trim();
  if(!date||E.dateString(new Date(date+'T12:00:00'))!==date||!Number.isFinite(n)||n===0||!title||!/^\s*[+−–-]/u.test(row.amount))throw Error('Одна из строк выписки не разобрана. Импорт остановлен, чтобы не потерять операции.');
  return {date,amount:Math.round(Math.abs(n)*100),type:n>0?'income':'expense',title:title.slice(0,300),bankCat:'',review:/перевод|снятие наличных/iu.test(title)};
 });
 const moneyPattern='([\\d \\u00a0\\u202f]+[.,]\\d{2})\\s*₽';
 const reversed=['Пополнения','Расходы'].every(label=>new RegExp(moneyPattern+'\\s*'+label+':','u').test(payload.sourceText));
 const total=label=>{const pattern=reversed?moneyPattern+'\\s*'+label+':':label+':\\s*'+moneyPattern;const m=payload.sourceText.match(new RegExp(pattern,'u'));return m?Math.round(B.parseAmount(m[1])*100):null;};
 const income=total('Пополнения'),expense=total('Расходы');
 if(income===null||expense===null||items.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0)!==income||items.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0)!==expense)throw Error('Итоги распознавания не совпали с итогами банка. Неполный импорт заблокирован. Выберите CSV/XLSX или другой PDF.');
 const period=payload.sourceText.match(/за период с\s*(\d{2}\.\d{2}\.\d{4})\s*по\s*(\d{2}\.\d{2}\.\d{4})/iu);
 return {items,income,expense,from:period?B.parseDate(period[1]):null};
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
  if(text.trim().startsWith('{')){let payload;try{payload=JSON.parse(text);}catch{throw Error('Не удалось прочитать ответ распознавания.');}const bank=bankTable(payload);document.querySelector('#entryDialog').close();MonoBankImport.preview(bank.items,bank);return;}
  if(/Справка о движении средств/iu.test(text)&&/в валюте карты/iu.test(text))throw Error('Столбцы банковской выписки не распознаны. Неполный импорт остановлен.');
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
const api={parse,bankTable};root.MonoDocumentImport={...api,pick,recognize};if(typeof module==='object')module.exports=api;
if(typeof document!=='undefined')document.addEventListener('click',e=>{if(e.target.closest('[data-document-pick]'))pick();});
})(typeof window==='object'?window:globalThis);
