const {test}=require('node:test');
const assert=require('node:assert/strict');
const AI=require('../server/voice-ai');
const E=require('../Mono/Web/engine');
const context={today:'2026-11-15',account:'main',accounts:[{id:'main',name:'Карта',currency:'RUB'},{id:'cash',name:'Наличные',currency:'RUB'},{id:'usd',name:'Доллары',currency:'USD'}],goals:[{id:'holiday',name:'Отпуск',currency:'RUB'}],categories:['Кафе','Продукты','Покупки','Другое'],incomeCategories:['Зарплата','Другое']};
const expense={title:'Кофе',type:'expense',amount:28000,account:'main',date:context.today,category:'Кафе'};
const parse=e=>AI.result({entries:[e],errors:[]},context);
test('voice input sends only minimal context and strips history and balances',()=>{
 const request={text:'Кофе 280',code:'123456',key:'secret',state:{entries:['private']},context:{...context,history:['private'],accounts:context.accounts.map(a=>({...a,initial:900000}))}};
 const result=AI.input(request);
 assert.deepEqual(Object.keys(result).sort(),['context','text']);
 assert.equal(JSON.stringify(result).includes('private'),false);assert.equal(JSON.stringify(result).includes('900000'),false);
 for(const bad of [{...request,text:'x'.repeat(4001)},{...request,context:{...context,today:'2026-02-30'}},{...request,context:{...context,account:'unknown'}}])assert.throws(()=>AI.input(bad),/invalid_request/);
});
test('AI output cannot invent accounts, categories, currency amounts or invalid dates',()=>{
 assert.deepEqual(parse({...expense,id:'injected',refundOf:'invented'}).entries,[expense]);
 for(const patch of [{account:'unknown'},{category:'Unknown'},{amount:-1},{amount:1.5},{amount:1e13},{date:'2026-02-30'},{date:'2026-11-16'},{type:'delete'},{type:'saving',goalId:'unknown'},{type:'saving',goalId:'holiday',account:'usd'},{type:'transfer',toAccount:'main'},{type:'transfer',toAccount:'usd',toAmount:null},{type:'income',category:'Кафе'}])assert.throws(()=>parse({...expense,...patch}),/invalid_ai_response/);
});
test('AI drafts preserve transfer, saving and installment invariants without modifying history',()=>{
 const value=AI.result({entries:[expense,{...expense,type:'transfer',toAccount:'cash'}, {...expense,type:'saving',goalId:'holiday'}, {...expense,title:'Куртка',amount:1,installmentTotal:800003,category:'Покупки'}],errors:[]},context);
 assert.equal(value.entries[3].amount,200001);
 const state=E.initialState();state.accounts=context.accounts.map(a=>({...a,initial:10000000}));state.goals=[{...context.goals[0],target:20000000}];
 const saved=E.saveDrafts(state,value.entries);assert.equal(state.entries.length,0);assert.equal(saved.added.length,4);assert.equal(saved.next.payments.length,3);
 assert.equal(saved.added[3].amount+saved.next.payments.reduce((n,p)=>n+p.amount,0),800003);
});
test('empty model response becomes an explicit clarification',()=>{
 assert.equal(AI.result({entries:[],errors:[]},context).errors.length,1);
 assert.throws(()=>AI.result({entries:[],errors:['x'.repeat(301)]},context),/invalid_ai_response/);
});
test('out-of-scope requests have a fixed refusal and cannot smuggle executable operations',()=>{
 const value=AI.result({entries:[expense],commands:[{kind:'exec',data:{name:'anything'}}],errors:['out_of_scope']},context);
 assert.deepEqual(value.entries,[]);assert.deepEqual(value.commands,[]);assert.match(value.errors[0],/моно/);
 assert.throws(()=>AI.result({entries:[],errors:['Скорость света равна 299792458 м/с']},context),/invalid_ai_response/);
 assert.throws(()=>AI.result({entries:[],commands:[{kind:'exec',data:{name:'anything'}}],errors:[]},context),/invalid_ai_response/);
});
test('only bounded app commands are returned, with strict single-record deletion',()=>{
 const value=AI.result({entries:[],commands:[{kind:'reminder',data:{title:'Позвонить',date:'2026-11-16',time:'10:00',repeat:'once'}},{kind:'goal',data:{name:'Отпуск',target:20000000,currency:'RUB'}},{kind:'remove',data:{removeTarget:'account',name:'Карта',last:false}}],errors:[]},context);
 assert.equal(value.commands.length,3);assert.equal(value.commands[2].data.strict,true);assert.equal(value.commands[2].data.target,'account');
 for(const cmd of [{kind:'remove',data:{removeTarget:'account',name:'всё'}},{kind:'remove',data:{removeTarget:'account',last:true}},{kind:'payment',data:{name:'Аренда',amount:-100}},{kind:'reminder',data:{title:'Купить',time:'25:00'}},{kind:'limit',data:{category:'Unknown',amount:100}},{kind:'deposit',data:{name:'Банк',rate:Infinity}}])assert.throws(()=>AI.result({entries:[],commands:[cmd],errors:[]},context),/invalid_ai_response/);
});
test('observed Yandex all-null placeholder does not discard four real drafts and a reminder',()=>{
 const fixture=require('../server/tests/fixtures/yandex-mixed-response.json');
 const c={...context,categories:[...context.categories,'Авто','Финансовые операции'],incomeCategories:[...context.incomeCategories,'Займы']};
 const parsed=AI.result(fixture,c);
 assert.equal(parsed.entries.length,4);assert.deepEqual(parsed.entries.map(e=>e.amount),[543700,100000,50000,20000]);
 assert.equal(parsed.commands.length,1);assert.equal(parsed.commands[0].data.time,'10:00');assert.equal(parsed.commands[0].data.date,'2026-11-16');
 assert.equal(parsed.entries[0].category,'Покупки'); // Категорию нельзя молча менять: это исправляется в инструкции и проверяется на модели.
 assert.deepEqual(parsed.errors,[]);
});
test('only exact all-null command templates are skipped; meaningful invalid commands still fail',()=>{
 const fixture=require('../server/tests/fixtures/yandex-mixed-response.json'),empty=fixture.commands[1];
 assert.equal(AI.result({entries:[],commands:[empty],errors:[]},context).errors.length,1);
 for(const patch of [{kind:'exec'}, {data:{...empty.data,time:'25:00'}}, {data:{...empty.data,amount:-100}}, {data:{...empty.data,last:false}}, {data:{title:null}}, {data:{...empty.data,unknown:null}}]){
  assert.throws(()=>AI.result({entries:[],commands:[{...empty,...patch}],errors:[]},context),/invalid_ai_response/);
 }
});
test('clarification suppresses incomplete model drafts instead of treating them as actions',()=>{
 const parsed=AI.result({entries:[{type:'income',amount:500000,account:'main',category:null},{type:'income',amount:0}],commands:[],errors:['operation']},context);
 assert.deepEqual(parsed.entries,[]);assert.deepEqual(parsed.commands,[]);assert.deepEqual(parsed.errors,['Уточните действие и название записи.']);
 const exchange=AI.result({entries:[{type:'transfer',amount:10000,account:'usd',toAccount:'main',toAmount:null},{type:'transfer',amount:0}],commands:[],errors:['missing_data']},context);
 assert.deepEqual(exchange.entries,[]);assert.deepEqual(exchange.errors,['Уточните валюту и сумму зачисления.']);
});
