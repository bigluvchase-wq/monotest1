(function(root){
'use strict';
// Загрузка расходов и доходов из выписки банка (CSV или Excel .xlsx) за последние 3 месяца.
// Файл читается только на телефоне: никуда не отправляется, сохраняются лишь найденные операции.

const low=v=>String(v??'').toLowerCase().replace(/ё/g,'е').trim();

// ---------- CSV ----------
function parseCSV(text){
 text=text.replace(/^﻿/,'');
 const head=text.split(/\r?\n/).slice(0,15).join('\n');
 const delim=[';','\t',','].map(d=>[d,head.split(d).length]).sort((a,b)=>b[1]-a[1])[0][0];
 const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(q){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=ch;continue;}
  if(ch==='"')q=true;
  else if(ch===delim){row.push(cell);cell='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
  else cell+=ch;
 }
 if(cell||row.length){row.push(cell);rows.push(row);}
 return rows.filter(r=>r.some(c=>String(c).trim()));
}

// ---------- XLSX (zip + xml), без сторонних библиотек ----------
async function inflate(bytes){
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzip(buf){
 const v=new DataView(buf),u8=new Uint8Array(buf),files={};
 let eocd=-1;for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-66000);i--)if(v.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw new Error('Файл повреждён или это не Excel (.xlsx).');
 let p=v.getUint32(eocd+16,true);const count=v.getUint16(eocd+10,true);
 for(let k=0;k<count;k++){
  if(v.getUint32(p,true)!==0x02014b50)break;
  const method=v.getUint16(p+10,true),size=v.getUint32(p+20,true),nl=v.getUint16(p+28,true),el=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),off=v.getUint32(p+42,true);
  const name=new TextDecoder().decode(u8.subarray(p+46,p+46+nl));
  files[name]={method,size,off};p+=46+nl+el+cl;
 }
 return async name=>{const f=files[name];if(!f)return null;const start=f.off+30+v.getUint16(f.off+26,true)+v.getUint16(f.off+28,true),data=u8.subarray(start,start+f.size);
  return new TextDecoder().decode(f.method===8?await inflate(data):data);};
}
async function parseXLSX(buf){
 const read=await unzip(buf),xml=s=>new DOMParser().parseFromString(s,'application/xml');
 const shared=[];const ss=await read('xl/sharedStrings.xml');
 if(ss)for(const si of xml(ss).getElementsByTagName('si'))shared.push([...si.getElementsByTagName('t')].map(t=>t.textContent).join(''));
 let sheet=await read('xl/worksheets/sheet1.xml');
 if(!sheet)throw new Error('В файле не нашлось листа с операциями.');
 const rows=[];
 for(const r of xml(sheet).getElementsByTagName('row')){
  const row=[];
  for(const c of r.getElementsByTagName('c')){
   const ref=c.getAttribute('r')||'',letters=ref.replace(/\d+/g,'');let col=0;for(const ch of letters)col=col*26+ch.charCodeAt(0)-64;col=col?col-1:row.length;
   const t=c.getAttribute('t'),vEl=c.getElementsByTagName('v')[0];
   let val=t==='s'?shared[Number(vEl?.textContent)]:t==='inlineStr'?[...c.getElementsByTagName('t')].map(x=>x.textContent).join(''):vEl?.textContent;
   if(t!=='s'&&t!=='inlineStr'&&t!=='str'&&val!=null&&val!==''&&!isNaN(val))val=Number(val);
   row[col]=val??'';
  }
  for(let i=0;i<row.length;i++)if(row[i]===undefined)row[i]='';
  if(row.some(x=>String(x).trim()))rows.push(row);
 }
 return rows;
}

// ---------- Разбор таблицы ----------
function parseDate(v){
 if(typeof v==='number'&&v>20000&&v<80000){const d=new Date(Date.UTC(1899,11,30)+Math.floor(v)*864e5);return d.toISOString().slice(0,10);}
 const s=String(v??'').trim();let m;
 if((m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/))){const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
 if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)))return `${m[1]}-${m[2]}-${m[3]}`;
 return null;
}
function parseAmount(v){
 if(typeof v==='number')return v;
 let s=String(v??'').replace(/[\s  ]/g,'').replace(/[₽$€]|руб\.?|rub/gi,'').replace(/[−–—]/g,'-');
 if(!s)return null;
 if(/,\d{1,2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');
 const n=Number(s);return Number.isFinite(n)?n:null;
}
function columns(header){
 const h=header.map(low),find=(...res)=>{for(const re of res){const i=h.findIndex(x=>re.test(x));if(i>=0)return i;}return -1;};
 return {
  date:find(/^дата операции/,/дата операции/,/^дата$/,/дата/,/^date/),
  amount:find(/^сумма операции$/,/сумма в валюте сч/,/^сумма платежа$/,/^сумма операции/,/^сумма$/,/сумма(?!.*(кеш|кэш|бонус|комисс))/,/^amount/),
  debit:find(/^(расход|списани|дебет)/),credit:find(/^(приход|зачислени|поступлени|кредит)/),
  desc:find(/^описание/,/описание/,/назначение/,/наименование/,/контрагент|получатель|место/,/^description/),
  cat:find(/категори/,/^category/),status:find(/^статус/,/^status/),kind:find(/^тип( операции)?$/,/направлени/)
 };
}
function tableToItems(rows){
 let hi=-1,col=null;
 for(let i=0;i<Math.min(rows.length,40);i++){const c=columns(rows[i]);if(c.date>=0&&(c.amount>=0||c.debit>=0||c.credit>=0)){hi=i;col=c;break;}}
 if(hi<0)throw new Error('Не нашли в файле столбцы с датой и суммой. Нужна выписка в CSV или Excel (.xlsx).');
 const items=[];
 for(const r of rows.slice(hi+1)){
  const date=parseDate(r[col.date]);if(!date)continue;
  if(col.status>=0&&/fail|отклон|отмен|ошибк/.test(low(r[col.status])))continue;
  let n=null;
  if(col.amount>=0)n=parseAmount(r[col.amount]);
  if((n===null||n===0)&&(col.debit>=0||col.credit>=0)){const d=parseAmount(r[col.debit])||0,c=parseAmount(r[col.credit])||0;n=c?Math.abs(c):d?-Math.abs(d):null;}
  if(!n)continue;
  if(col.kind>=0){const k=low(r[col.kind]);if(/списан|расход|покупк|оплат|дебет/.test(k))n=-Math.abs(n);else if(/зачисл|пополн|приход|поступ|кредит/.test(k))n=Math.abs(n);}
  const desc=String(r[col.desc]??'').replace(/\s+/g,' ').trim(),bankCat=String(r[col.cat]??'').trim();
  items.push({date,amount:Math.round(Math.abs(n)*100),type:n<0?'expense':'income',title:(desc||bankCat||(n<0?'Расход':'Доход')).slice(0,80),bankCat});
 }
 return items;
}

// Категории банка → категории «моно»
const BANK=[
 [/супермаркет|продукт|гипермаркет/,'Продукты'],[/ресторан|фастфуд|кафе|кофейн|бар/,'Кафе'],[/такси|транспорт|каршеринг|метро/,'Транспорт'],
 [/топливо|азс|авто|парковк/,'Авто'],[/аптек|медицин|здоров/,'Здоровье'],[/красот|салон|косметик/,'Красота'],[/одежд|обув/,'Одежда и обувь'],
 [/развлечен|кино|театр|музе/,'Развлечения'],[/связь|мобильн|интернет|телеком/,'Связь'],[/жкх|коммунал|дом|ремонт/,'Дом'],[/маркетплейс/,'Маркетплейсы'],
 [/путешеств|авиа|отел|ж\/д|жд билет|туризм/,'Путешествия'],[/образован|книг/,'Образование'],[/спорт|фитнес/,'Спорт'],[/животн|зоо/,'Питомцы'],
 [/подписк|цифров/,'Подписки'],[/перевод/,'Переводы'],[/кэшб|кешб/,'Кешбэк'],[/процент/,'Проценты'],[/зарплат/,'Зарплата'],[/подар/,'Подарки']
];
function categorize(item,list){
 const S=root.MonoSpeechCategories,has=c=>c&&list.includes(c)?c:null;
 const bank=BANK.find(([re])=>re.test(low(item.bankCat)))?.[1];
 const fromText=item.type==='income'?S?.income?.(item.title):S?.expense?.(item.title);
 return has(list.includes(item.bankCat)?item.bankCat:null)||has(bank)||has(fromText&&fromText!=='Другое'?fromText:null)||(list.includes('Другое')?'Другое':list[0]);
}

const ds=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function cutoff(today=new Date()){const d=new Date(today);d.setMonth(d.getMonth()-3);return ds(d);}
// Убираем то, что уже есть в приложении (та же дата, сумма и тип на этом счёте)
function plan(items,existing,account,today=new Date()){
 const from=cutoff(today),to=ds(today),seen=new Map();
 for(const e of existing)if(e.account===account&&(e.type==='expense'||e.type==='income')){const k=e.date+'|'+e.amount+'|'+e.type;seen.set(k,(seen.get(k)||0)+1);}
 const fresh=[];let dup=0,old=0;
 for(const it of items){
  if(it.date<from||it.date>to){old++;continue;}
  const k=it.date+'|'+it.amount+'|'+it.type;if(seen.get(k)){seen.set(k,seen.get(k)-1);dup++;continue;}
  fresh.push(it);
 }
 return {fresh,dup,old,from};
}

async function readFile(file){
 const buf=await file.arrayBuffer(),u8=new Uint8Array(buf);
 if(u8[0]===0x50&&u8[1]===0x4b)return tableToItems(await parseXLSX(buf));
 if(u8[0]===0xd0&&u8[1]===0xcf)throw new Error('Это старый формат Excel (.xls). Сохраните выписку в .xlsx или .csv.');
 if(u8[0]===0x25&&u8[1]===0x50)throw new Error('PDF-выписку прочитать не получится. Выгрузите выписку в CSV или Excel (.xlsx).');
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(buf);}catch{text=new TextDecoder('windows-1251').decode(buf);}
 return tableToItems(parseCSV(text));
}

// ---------- Интерфейс ----------
function pick(){
 const input=document.createElement('input');input.type='file';input.accept='.csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 input.style.display='none';document.body.append(input);
 input.onchange=async()=>{const file=input.files?.[0];input.remove();if(!file)return;
  try{preview(await readFile(file));}catch(e){notify(e.message||'Не получилось прочитать файл.');}};
 input.click();
}
function preview(items){
 if(!items.length){notify('В файле не нашлось операций.');return;}
 const accounts=state.accounts,first=(accounts.find(a=>a.currency==='RUB')||accounts[0]).id;
 const fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
 const draw=account=>{
  const acc=accounts.find(a=>a.id===account),cur=acc.currency,p=plan(items,state.entries,account);
  const sum=t=>p.fresh.filter(i=>i.type===t),ex=sum('expense'),inc=sum('income'),tot=l=>l.reduce((n,i)=>n+i.amount,0);
  const sample=p.fresh.slice(0,5).map(i=>`<li><span>${esc(i.title)}<small>${fmt(i.date)}</small></span><b class="${i.type==='income'?'in':''}">${i.type==='income'?'+':'−'}${money(i.amount,cur)}</b></li>`).join('');
  return {p,html:`<form class="bank-import"><p class="muted">Нашли операции с ${fmt(p.from)} по сегодня. Категории подберём сами — потом их можно поменять.</p>
  <label class="field"><span>На какой счёт записать</span><select name="account">${accounts.map(a=>`<option value="${esc(a.id)}" ${a.id===account?'selected':''}>${esc(a.name)} · ${esc(a.currency)}</option>`).join('')}</select></label>
  <ul class="bank-import-sum"><li><span>Расходы · ${ex.length}</span><b>−${money(tot(ex),cur)}</b></li><li><span>Доходы · ${inc.length}</span><b class="in">+${money(tot(inc),cur)}</b></li></ul>
  ${sample?`<ul class="bank-import-list">${sample}</ul>`:''}
  <p class="muted tiny">${p.dup?`Уже есть в приложении: ${p.dup} — пропустим. `:''}${p.old?`Старше 3 месяцев: ${p.old} — не загружаем.`:''}</p>
  <button class="primary full" ${p.fresh.length?'':'disabled'}>${p.fresh.length?`Загрузить ${p.fresh.length}`:'Нечего загружать'}</button></form>`};
 };
 const show=account=>{const v=draw(account);
  actionDialog('Загрузка выписки',v.html,(data)=>{const acc=String(data.get('account')),{fresh}=plan(items,state.entries,acc),now=new Date().toISOString();
   const ok=commit(s=>{const ex=s.categories,inc=s.incomeCategories;for(const it of fresh)s.entries.push({id:uid(),type:it.type,title:it.title,amount:it.amount,category:categorize(it,it.type==='income'?inc:ex),account:acc,date:it.date,createdAt:now,imported:true});},`Загружено операций: ${fresh.length}`);
   if(ok)$('#actionDialog').close();});
  const sel=document.querySelector('#actionBody select[name=account]');if(sel)sel.onchange=()=>show(sel.value);
 };
 show(first);
}

const api={parseCSV,parseDate,parseAmount,tableToItems,categorize,plan,cutoff};
root.MonoBankImport={...api,pick};
if(typeof module==='object')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
