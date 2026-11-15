'use strict';
const {install,settings}=require('./voice-ai');
// Проверяем рабочий обработчик на отдельном локальном порту и SQLite в памяти.
async function selfTest({env=process.env,fetchImpl=globalThis.fetch,log=console.log}={}){
 const cfg=settings(env);
 if(!cfg.enabled||!cfg.key||!cfg.folder)throw Error('Сначала настройте и включите умный разбор в .env.');
 const express=require('express'),Database=require('better-sqlite3'),crypto=require('node:crypto');
 const db=new Database(':memory:'),app=express(),localKey=crypto.randomBytes(32).toString('hex');
 let upstreamError='';app.use(express.json({limit:'64kb'}));
 install(app,{db,env,rateLimit:(req,res,next)=>next(),authenticate(req,res){
  if(req.get('x-mono-key')!==localKey){res.status(401).json({error:'unauthorized'});return null;}
  return {code:'000000'};
 },fetchImpl:async(url,options)=>{
  const response=await fetchImpl(url,options);
  if(!response.ok){
   upstreamError='Yandex Cloud: HTTP '+response.status;
   try{const body=await response.clone().json(),message=body.error?.message||body.message;
    if(typeof message==='string')upstreamError+=' — '+message.split(cfg.key).join('[ключ скрыт]').replace(/(?:Api-Key|Bearer)\s+\S+/gi,'[ключ скрыт]').replace(/[\r\n]/g,' ').slice(0,500);
   }catch{}
  }
  return response;
 }});
 const server=app.listen(0,'127.0.0.1');
 try{
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const url='http://127.0.0.1:'+server.address().port+'/api/voice/parse';
  const now=new Date(),context={today:now.toISOString().slice(0,10),time:'12:00',account:'main',accounts:[{id:'main',name:'Основной счёт',currency:'RUB'}],goals:[],categories:['Кафе','Продукты','Транспорт','Другое'],incomeCategories:['Зарплата','Другое']};
  async function request(text){
   const response=await fetch(url,{method:'POST',signal:AbortSignal.timeout(16000),headers:{'Content-Type':'application/json','X-Mono-Key':localKey},body:JSON.stringify({code:'000000',text,context})});
   const body=await response.json();
   if(!response.ok||!body.ok)throw Error(upstreamError||'Ошибка разбора: HTTP '+response.status+' / '+body.error);
   return body;
  }
  const parsed=await request('Кофе 280 рублей и такси 400 рублей');
  const expenses=parsed.entries||[];
  if(parsed.errors.length||parsed.commands.length||expenses.length!==2||expenses.some(e=>e.type!=='expense'||e.account!=='main'||e.date!==context.today)||expenses.map(e=>e.amount).sort((a,b)=>a-b).join(',')!=='28000,40000')throw Error('Разбор не прошёл проверку: ожидались два расхода 280 и 400 рублей.');
  log('Разбор фразы: ОК — два расхода, 280 и 400 рублей.');
  const outside=await request('Какова скорость света?');
  if(outside.entries.length||outside.commands.length||outside.errors.length!==1||!outside.errors[0].startsWith('Я помогаю с расходами'))throw Error('Отказ на посторонний вопрос не прошёл проверку.');
  log('Посторонний вопрос: ОК — получен отказ.');
  log('Проверка завершена. Рабочая база не менялась, ключи не выводились.');
 }finally{
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();
 }
}
module.exports={selfTest};
if(require.main===module){require('dotenv').config({quiet:true});selfTest().catch(error=>{console.error(error.message);process.exitCode=1;});}
