'use strict';
const {install,settings,result:validateResult}=require('./voice-ai');
const Examples=require('./voice-examples');
const USER_PHRASE='купил продукты 5437 заправился вчера на тыщу а еще сегодня взял в долг у друга питик и вернул долг две сотки а еще напомни оплатить завтра инет в 10 утра';
function complexCases(context){
 const today=context.today,shift=n=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const yesterday=shift(-1),tomorrow=shift(1);
 const entry=(type,amount,category,date=today,account='main',extra={})=>({type,amount,category,date,account,...extra});
 return [
  {name:'Смешанная фраза владельца: даты, сленг, долги и напоминание',text:USER_PHRASE,
   entries:[entry('expense',543700,'Продукты'),entry('expense',100000,'Авто',yesterday),entry('income',50000,'Займы'),entry('expense',20000,'Финансовые операции')],
   commands:[{kind:'reminder',data:{date:tomorrow,time:'10:00'}}],internet:true},
  {name:'Зарплата и несколько расходов с разными датами',text:'Сегодня получил зарплату 80 тысяч, купил кофе за 280 и проехал на такси за 400, а вчера купил продукты на полторы тысячи',
   entries:[entry('income',8000000,'Зарплата'),entry('expense',28000,'Кафе'),entry('expense',40000,'Транспорт'),entry('expense',150000,'Продукты',yesterday)]},
  {name:'Свой перевод, расход наличными и кешбэк',text:'Перевёл с карты в наличные пять тысяч, потом купил кофе за 280 наличными, а на карту пришёл кешбэк 50',
   entries:[{type:'transfer',amount:500000,date:today,account:'main',toAccount:'cash'},entry('expense',28000,'Кафе',today,'cash'),entry('income',5000,'Кешбэк')]},
  {name:'Отрицание не создаёт лишнюю трату',text:'Кофе 300 я не покупал, а купил продукты 1200 сегодня',entries:[entry('expense',120000,'Продукты')]},
  {name:'Неясное поступление требует уточнения',text:'Друг перевёл мне пять тысяч',entries:[],clarification:'operation'},
  {name:'Обмен валют без суммы зачисления требует уточнения',text:'Перевёл 100 долларов со счёта Доллары на карту в рублях',entries:[],clarification:'currency'}
 ];
}
function checkCase(actual,example){
 const entries=actual.entries||[],commands=actual.commands||[],expectedCommands=example.commands||[];
 if(example.clarification){const question=example.clarification==='currency'?'Уточните валюту и сумму зачисления.':'Уточните действие и название записи.';return !entries.length&&!commands.length&&actual.errors?.includes(question);}
 if(actual.errors?.length||entries.length!==example.entries.length||commands.length!==expectedCommands.length)return false;
 const keys=['type','amount','category','date','account','toAccount'];
 const normal=e=>JSON.stringify(keys.map(k=>e[k]??null));
 if(entries.map(normal).sort().join('|')!==example.entries.map(normal).sort().join('|'))return false;
 if(expectedCommands.some((expected,i)=>commands[i].kind!==expected.kind||Object.entries(expected.data).some(([k,v])=>commands[i].data[k]!==v)))return false;
 if(example.internet&&(!/оплат/iu.test(commands[0].data.title||'')||!/интернет|инет/iu.test(commands[0].data.title||'')))return false;
 return true;
}
// Проверяем рабочий обработчик на отдельном локальном порту и SQLite в памяти.
async function selfTest({env=process.env,fetchImpl=globalThis.fetch,log=console.log,complex=false,onlyUser=false,diagnose=false,corpusMode=false,limit=8,reportPath=null}={}){
 const cfg=settings(env);
 if(!cfg.enabled||!cfg.key||!cfg.folder)throw Error('Сначала настройте и включите умный разбор в .env.');
 const express=require('express'),Database=require('better-sqlite3'),crypto=require('node:crypto');
 const db=new Database(':memory:'),app=express(),localKey=crypto.randomBytes(32).toString('hex');
 let upstreamError='',modelReply=null;
 const scrub=value=>String(value).split(cfg.key).join('[ключ скрыт]').replace(/(?:Api-Key|Bearer)\s+\S+/gi,'[ключ скрыт]');
 function diagnostic(context){
  log('ДИАГНОСТИКА: сегодня='+context.today+'; статус='+String(modelReply?.status||'нет')+'; токены='+JSON.stringify(modelReply?.usage||null));
  if(!modelReply)return;
  try{
   const reply=JSON.parse(modelReply.text);
   log('Ошибки модели: '+scrub(JSON.stringify(reply.errors)));
   if(Array.isArray(reply.entries))reply.entries.slice(0,10).forEach((entry,i)=>log('Запись '+(i+1)+': '+scrub(JSON.stringify(entry))));
   else log('Поле entries: '+scrub(JSON.stringify(reply.entries)));
   if(Array.isArray(reply.commands))reply.commands.slice(0,5).forEach((cmd,i)=>log('Команда '+(i+1)+': '+scrub(JSON.stringify(cmd))));
   else log('Поле commands: '+scrub(JSON.stringify(reply.commands)));
  }catch{log('Текст модели: '+scrub(modelReply.text||'').slice(0,2000));}
 }
 app.use(express.json({limit:'64kb'}));
 install(app,{db,env,rateLimit:(req,res,next)=>next(),authenticate(req,res){
  if(req.get('x-mono-key')!==localKey){res.status(401).json({error:'unauthorized'});return null;}
  return {code:'000000'};
 },fetchImpl:async(url,options)=>{
  const response=await fetchImpl(url,options);
  if(diagnose&&response.ok){try{const data=await response.clone().json(),a=data.result?.alternatives?.[0];modelReply={status:a?.status,text:a?.message?.text,usage:data.result?.usage};}catch{}}
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
  if(complex){
   context.accounts=[{id:'main',name:'Карта',currency:'RUB'},{id:'cash',name:'Наличные',currency:'RUB'},{id:'usd',name:'Доллары',currency:'USD'}];
   context.categories=['Кафе','Продукты','Транспорт','Авто','Покупки','Финансовые операции','Другое'];
   context.incomeCategories=['Зарплата','Подработка','Займы','Возврат долга','Подарки','Кешбэк','Другое'];
  }
  if(corpusMode)Object.assign(context,Examples.benchmarkContext());
  async function request(text){
   upstreamError='';modelReply=null;
   const response=await fetch(url,{method:'POST',signal:AbortSignal.timeout(16000),headers:{'Content-Type':'application/json','X-Mono-Key':localKey},body:JSON.stringify({code:'000000',text,context})});
   const body=await response.json();
   if(!response.ok||!body.ok)throw Error(upstreamError||'Ошибка разбора: HTTP '+response.status+' / '+body.error);
   return body;
  }
  if(corpusMode){
   if(!Number.isSafeInteger(limit)||limit<1||limit>35)throw Error('limit должен быть целым числом от 1 до 35.');
   const cases=Examples.corpus.examples.filter(e=>e.split==='evaluation').slice(0,limit),report=[];let passed=0;
   const key=e=>JSON.stringify([e.type,e.amount,e.date,e.account,e.category??null,e.goalId??null,e.toAccount??null,e.toAmount??null,e.installmentTotal??null]);
   const commandKey=cmd=>JSON.stringify([cmd.kind,Object.entries(cmd.data).filter(([k])=>!['title','name','text','strict'].includes(k)).sort(([a],[b])=>a.localeCompare(b))]);
   for(const example of cases){
    const reference=Examples.materialize(example,context);if(!reference)throw Error('Некорректный эталон '+example.id);
    const expected=validateResult(reference,context);let actual=null,error=null,ok=false;
    try{
     actual=await request(example.text);
     ok=actual.entries.map(key).sort().join('|')===expected.entries.map(key).sort().join('|')&&actual.commands.map(commandKey).sort().join('|')===expected.commands.map(commandKey).sort().join('|')&&actual.errors.slice().sort().join('|')===expected.errors.slice().sort().join('|');
     if(ok)passed++;
     log((ok?'ОК: ':'НЕ ПРОШЁЛ: ')+example.id+' — '+example.text);
     if(!ok){log('Ответ: '+scrub(JSON.stringify(actual)));if(diagnose)diagnostic(context);}
    }catch(e){error=scrub(e.message);log('НЕ ПРОШЁЛ: '+example.id+' — '+error);if(diagnose)diagnostic(context);}
    report.push({id:example.id,text:example.text,expected,actual,error,ok});
   }
   if(reportPath){require('node:fs').writeFileSync(reportPath,scrub(JSON.stringify({context,passed,total:cases.length,cases:report},null,2)),{mode:0o600});log('Отчёт: '+reportPath);}
   log('Проверяются действия, суммы, даты, счета и категории. Названия и тексты команд смотрите в отчёте.');
   if(passed!==cases.length)throw Error('Пройдено '+passed+' из '+cases.length+'. Рабочая база не менялась.');
   log('Все '+passed+' контрольных фраз пройдены. Рабочая база не менялась.');return;
  }
  if(complex){
   const cases=onlyUser?complexCases(context).slice(0,1):complexCases(context);let passed=0;
   for(const example of cases){
    try{
     const actual=await request(example.text);
     if(checkCase(actual,example)){passed++;log('ОК: '+example.name);}
     else{log('НЕ ПРОШЁЛ: '+example.name);log('Ответ: '+scrub(JSON.stringify(actual)));if(diagnose)diagnostic(context);}
    }catch(error){log('НЕ ПРОШЁЛ: '+example.name+' — '+scrub(error.message));if(diagnose)diagnostic(context);}
   }
   if(passed!==cases.length)throw Error('Пройдено '+passed+' из '+cases.length+'. Рабочая база не менялась.');
   log('Все '+passed+' сложных примеров пройдены. Рабочая база не менялась.');return;
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
module.exports={selfTest,complexCases,checkCase,USER_PHRASE};
if(require.main===module){require('dotenv').config({quiet:true});selfTest({complex:process.argv.includes('--complex'),onlyUser:process.argv.includes('--only-user'),diagnose:process.argv.includes('--diagnose'),corpusMode:process.argv.includes('--corpus'),limit:Number(process.argv.find(a=>a.startsWith('--limit='))?.split('=')[1]||8),reportPath:process.argv.includes('--corpus')?require('node:path').join(__dirname,'voice-ai-report.json'):null}).catch(error=>{console.error(error.message);process.exitCode=1;});}
