const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const Database=require('better-sqlite3');
const {install}=require('../voice-ai');
const context={today:'2026-11-15',account:'main',accounts:[{id:'main',name:'Карта',currency:'RUB'}],goals:[],categories:['Кафе','Другое'],incomeCategories:['Зарплата','Другое']};
const expense={title:'Кофе',type:'expense',amount:28000,account:'main',date:context.today,category:'Кафе'};
async function fixture(t,{env={},provider,db=new Database(':memory:')}={}){
 const calls=[],app=express();app.set('env','test');app.use(express.json({limit:'64kb'}));
 install(app,{db,env:{VOICE_AI_ENABLED:'1',YANDEX_API_KEY:'test-secret',YANDEX_FOLDER_ID:'test-folder',...env},rateLimit:(req,res,next)=>next(),authenticate(req,res){if(req.get('x-mono-key')!=='device-key'){res.status(401).json({ok:false,error:'unauthorized'});return null;}return {code:req.body.code};},fetchImpl:async(url,options)=>{calls.push({url,options});return provider?provider(url,options):{ok:true,json:async()=>({result:{alternatives:[{status:'ALTERNATIVE_STATUS_FINAL',message:{text:JSON.stringify({entries:[expense],errors:[]})}}]}})};}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();});
 const url='http://127.0.0.1:'+server.address().port;
 return {calls,db,url,request:(body={},headers={})=>fetch(url+'/api/voice/parse',{method:'POST',headers:{'Content-Type':'application/json','x-mono-key':'device-key',...headers},body:JSON.stringify({code:'123456',text:'Кофе 280',context,...body})})};
}
test('unauthorized or invalid requests never call the paid provider',async t=>{
 const f=await fixture(t);
 assert.equal((await f.request({}, {'x-mono-key':'wrong'})).status,401);
 assert.equal((await f.request({text:'x'.repeat(4001)})).status,400);
 assert.equal((await f.request({code:'12'})).status,400);
 assert.equal((await f.request({text:'x'.repeat(70000)})).status,413);
 assert.equal(f.calls.length,0);
});
test('server authenticates, calls only Yandex, disables logging and returns validated drafts',async t=>{
 const f=await fixture(t);const response=await f.request();assert.equal(response.status,200);assert.deepEqual((await response.json()).entries,[expense]);
 const call=f.calls[0];assert.equal(call.url,'https://ai.api.cloud.yandex.net/foundationModels/v1/completion');
 assert.equal(call.options.headers.Authorization,'Api-Key test-secret');assert.equal(call.options.headers['x-data-logging-enabled'],'false');
 const body=JSON.parse(call.options.body);assert.equal(body.modelUri,'gpt://test-folder/yandexgpt-5.1');
 assert(body.jsonSchema.schema);assert.equal(body.messages.length,2);assert.equal(body.messages[1].text.includes('device-key'),false);assert.equal(body.messages[1].text.includes('123456'),false);
 assert.equal(response.headers.get('cache-control'),'no-store');
});
test('daily usage is persistent and has both per-user and global limits',async t=>{
 const f=await fixture(t,{env:{VOICE_AI_DAILY_LIMIT:'1',VOICE_AI_GLOBAL_DAILY_LIMIT:'2'}});
 assert.equal((await f.request()).status,200);assert.equal((await f.request()).status,429);
 assert.equal((await f.request({code:'654321'})).status,200);assert.equal((await f.request({code:'111111'})).status,429);
 assert.equal(f.calls.length,2);assert.equal(f.db.prepare('SELECT SUM(requests) AS n FROM voice_ai_usage').get().n,2);
});
test('disabled model and malformed or truncated provider answers fail without returning drafts',async t=>{
 const off=await fixture(t,{env:{VOICE_AI_ENABLED:'0'}});assert.equal((await off.request()).status,503);assert.equal(off.calls.length,0);assert.equal((await (await fetch(off.url+'/api/voice/status')).json()).enabled,false);
 const truncated=await fixture(t,{provider:async()=>({ok:true,json:async()=>({result:{alternatives:[{status:'ALTERNATIVE_STATUS_TRUNCATED_FINAL',message:{text:'{}'}}]}})})});
 assert.equal((await truncated.request()).status,502);
 const broken=await fixture(t,{provider:async()=>({ok:true,json:async()=>({result:{alternatives:[{status:'ALTERNATIVE_STATUS_FINAL',message:{text:'not JSON'}}]}})})});
 const response=await broken.request();assert.equal(response.status,503);assert.equal((await response.json()).entries,undefined);
});
test('concurrent requests are bounded and slots release after failure',async t=>{
 let release;const f=await fixture(t,{env:{VOICE_AI_CONCURRENCY:'1'},provider:()=>new Promise(resolve=>{release=()=>resolve({ok:false,status:429});})});
 const first=f.request();while(!release)await new Promise(r=>setTimeout(r,5));
 assert.equal((await f.request({code:'654321'})).status,503);release();assert.equal((await first).status,503);
 assert.equal(f.calls.length,1);
 const second=f.request();const previous=release;while(release===previous)await new Promise(r=>setTimeout(r,5));release();await second;assert.equal(f.calls.length,2);
});
test('real server requires a previously bound device key and rejects oversized voice bodies',async t=>{
 const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mono-ai-http-'));
 const probe=net.createServer();probe.listen(0,'127.0.0.1');await new Promise(r=>probe.once('listening',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{cwd:path.join(__dirname,'..'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DB_PATH:path.join(temp,'test.db'),VOICE_AI_ENABLED:'1',YANDEX_FOLDER_ID:'fake-folder',YANDEX_API_KEY:'fake-key'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>output+=s);
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}fs.rmSync(temp,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+port;
 for(let i=0;i<100&&!output.includes('Server running');i++)await new Promise(r=>setTimeout(r,20));
 assert.match(output,/Server running/);
 const request=(endpoint,body,key='a'.repeat(64))=>fetch(url+endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-mono-key':key},body:JSON.stringify(body)});
 assert.equal((await request('/api/registerUser',{code:'123456'})).status,200);
 assert.equal((await request('/api/voice/parse',{code:'123456',text:'',context},'b'.repeat(64))).status,401);
 assert.equal((await request('/api/voice/parse',{code:'654321',text:'',context})).status,401);
 assert.equal((await request('/api/voice/parse',{code:'123456',text:'',context})).status,400);
 assert.equal((await request('/api/voice/parse',{code:'123456',text:'PRIVATE_MARKER'.repeat(6000),context})).status,413);
 assert.equal(output.includes('PRIVATE_MARKER'),false);
});
test('full voice self-test uses isolated storage and checks both finance and off-topic handling',async()=>{
 const {selfTest}=require('../voice-ai-self-test');let calls=0;const messages=[];
 await selfTest({env:{VOICE_AI_ENABLED:'1',YANDEX_API_KEY:'test-secret',YANDEX_FOLDER_ID:'test-folder'},log:message=>messages.push(message),fetchImpl:async(url,options)=>{
  calls++;const request=JSON.parse(options.body),payload=JSON.parse(request.messages[1].text);
  const entries=payload.text.includes('скорость')?[]:[{...expense,date:payload.context.today},{...expense,title:'Такси',category:'Транспорт',amount:40000,date:payload.context.today}];
  return new Response(JSON.stringify({result:{alternatives:[{status:'ALTERNATIVE_STATUS_FINAL',message:{text:JSON.stringify({entries,commands:[],errors:entries.length?[]:['out_of_scope']})}}]}}),{headers:{'Content-Type':'application/json'}});
 }});
 assert.equal(calls,2);assert.equal(messages.length,3);assert.equal(messages.join('').includes('test-secret'),false);
});
test('complex live checker covers mixed commands, debts, dates and ambiguity',async()=>{
 const {selfTest,complexCases}=require('../voice-ai-self-test');let calls=0;const messages=[];
 await selfTest({complex:true,env:{VOICE_AI_ENABLED:'1',YANDEX_API_KEY:'test-secret',YANDEX_FOLDER_ID:'test-folder'},log:message=>messages.push(message),fetchImpl:async(url,options)=>{
  calls++;const request=JSON.parse(options.body),payload=JSON.parse(request.messages[1].text),example=complexCases(payload.context).find(c=>c.text===payload.text);
  assert(example);const entries=example.entries.map(e=>({...e,title:e.category||'Между своими'}));
  const commands=(example.commands||[]).map(cmd=>({...cmd,data:{...cmd.data,title:'Оплатить интернет',repeat:'once'}}));
  return new Response(JSON.stringify({result:{alternatives:[{status:'ALTERNATIVE_STATUS_FINAL',message:{text:JSON.stringify({entries,commands,errors:example.clarification?[example.clarification]:[]})}}]}}),{headers:{'Content-Type':'application/json'}});
 }});
 assert.equal(calls,6);assert.equal(messages.filter(m=>m.startsWith('ОК:')).length,6);assert.equal(messages.join('').includes('test-secret'),false);
});
test('complex checker catches wrong debt amount, wrong date and missing reminder',()=>{
 const {complexCases,checkCase}=require('../voice-ai-self-test');const example=complexCases(context)[0];
 const actual={entries:structuredClone(example.entries),commands:[{kind:'reminder',data:{...example.commands[0].data,title:'Оплатить интернет'}}],errors:[]};
 assert(checkCase(actual,example));actual.entries[2].amount=500000;assert.equal(checkCase(actual,example),false);
 actual.entries[2].amount=50000;actual.entries[1].date=context.today;assert.equal(checkCase(actual,example),false);
 actual.entries[1].date=example.entries[1].date;actual.commands=[];assert.equal(checkCase(actual,example),false);
});
