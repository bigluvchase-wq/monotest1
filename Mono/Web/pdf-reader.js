(function(root){
'use strict';
let loading;
const base=typeof document==='object'?new URL('.',document.currentScript.src).href:'';
function loadScript(name){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=base+'vendor/pdfjs/'+name;s.onload=resolve;s.onerror=()=>reject(Error('Не удалось загрузить локальный PDF-модуль. Обновите приложение.'));document.head.append(s);});}
async function library(){if(!loading)loading=(async()=>{await loadScript('pdf.worker.min.js');await loadScript('pdf.min.js');return root.pdfjsLib;})().catch(e=>{loading=null;throw e;});return loading;}
function table(items){
 const cells=items.filter(i=>typeof i.str==='string'&&i.str.trim()).map(i=>({text:i.str.trim(),x:i.transform[4],y:i.transform[5],width:i.width||0}));
 const header=pattern=>cells.find(c=>pattern.test(c.text));
 const dateHead=header(/^Дата и время/iu),amountHead=header(/в валюте карты/iu),descHead=header(/^Описание$/iu);
 if(!dateHead||!amountHead||!descHead)return null;
 const secondDate=cells.find(c=>/^Дата$/iu.test(c.text)&&c.x>dateHead.x&&c.x<amountHead.x),card=cells.find(c=>/^Номер$/iu.test(c.text)&&c.x>descHead.x);
 if(!secondDate||!card)return null;
 const dates=cells.filter(c=>/^\d{2}\.\d{2}\.\d{4}$/.test(c.text)&&c.x>=dateHead.x-2&&c.x<secondDate.x-2&&c.y<descHead.y).sort((a,b)=>b.y-a.y);
 return dates.map((d,i)=>{
  const lower=Math.max(i+1<dates.length?dates[i+1].y+2:55,d.y-85);
  const amount=cells.filter(c=>c.x>=amountHead.x-2&&c.x<descHead.x-4&&Math.abs(c.y-d.y)<3).sort((a,b)=>a.x-b.x).map(c=>c.text).join(' ');
  const title=cells.filter(c=>c.x>=descHead.x-2&&c.x<card.x-2&&c.y<=d.y+2&&c.y>lower).sort((a,b)=>Math.abs(a.y-b.y)>3?b.y-a.y:a.x-b.x).map(c=>c.x+c.width>card.x&&/\s\d{4}$/.test(c.text)?c.text.replace(/\s\d{4}$/,''):c.text).join(' ');
  return {date:d.text,amount,title};
 });
}
async function read(file){
 if(file.size>20000000)throw Error('Максимальный размер PDF — 20 МБ.');
 const lib=await library();
 // Load the bundled worker handler in this realm: no network worker or file:// CORS dependency.
 const task=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,isOffscreenCanvasSupported:false,useWorkerFetch:false});
 let doc;
 try{
  doc=await task.promise;if(doc.numPages>30)throw Error('В PDF больше 30 страниц. Разделите выписку.');
  let sourceText='',rows=[],detected=false,textPages=0;
  for(let i=1;i<=doc.numPages;i++){
   const page=await doc.getPage(i),content=await page.getTextContent();
   const ordered=content.items.filter(x=>typeof x.str==='string'&&x.str.trim()).slice().sort((a,b)=>Math.abs(a.transform[5]-b.transform[5])>2?b.transform[5]-a.transform[5]:a.transform[4]-b.transform[4]);
   const lines=[];for(const item of ordered){const last=lines.at(-1);if(last&&Math.abs(last.y-item.transform[5])<=2)last.items.push(item);else lines.push({y:item.transform[5],items:[item]});}
   const text=lines.map(l=>l.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(x=>x.str).join(' ')).join('\n');if(text.trim().length>30)textPages++;
   sourceText+=text+'\n\f\n';const parsed=table(content.items);if(parsed){detected=true;rows.push(...parsed);}
   if(sourceText.length>300000||rows.length>5000)throw Error('Выписка слишком большая. Разделите файл.');
   page.cleanup();await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(detected)return JSON.stringify({format:'mono-bank-table-v1',rows,sourceText});
  if(!textPages)return null; // Scans need the native OCR fallback.
  if(/дата|выписка|движени[ея] средств/iu.test(sourceText)&&/сумма|расход|приход/iu.test(sourceText))throw Error('Этот макет PDF пока не поддерживается. Нужен отдельный разбор столбцов банка; CSV/XLSX уже поддерживаются.');
  return sourceText;
 }finally{if(doc)await doc.destroy();else await task.destroy();}
}
const api={table,read};root.MonoPDFReader=api;if(typeof module==='object')module.exports={table};
})(typeof window==='object'?window:globalThis);
