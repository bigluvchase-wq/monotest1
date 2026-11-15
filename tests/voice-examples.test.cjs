const {test}=require('node:test'),assert=require('node:assert/strict');
const Examples=require('../server/voice-examples'),AI=require('../server/voice-ai'),E=require('../Mono/Web/engine');
test('shared project corpus preserves 28 phrases and 85 original operation references',()=>{
 const all=Examples.corpus.examples,legacy=all.filter(e=>e.id.startsWith('legacy-'));
 assert.equal(all.length,64);assert.equal(legacy.length,28);assert.equal(legacy.reduce((n,e)=>n+e.legacyExpected.split(' ').length,0),85);
 assert.equal(new Set(all.map(e=>e.id)).size,64);
 assert.equal(all.filter(e=>e.split==='prompt').length,19);assert.equal(all.filter(e=>e.split==='evaluation').length,35);assert.equal(all.filter(e=>e.split==='review').length,10);
});
test('all 54 reviewed references satisfy server validation and financial save invariants',()=>{
 const context=Examples.benchmarkContext();AI.input({text:'Проверка',context});let count=0;
 for(const example of Examples.corpus.examples){
  if(example.split==='review'){assert.equal(Examples.materialize(example,context),null);continue;}
  const raw=Examples.materialize(example,context);assert(raw,example.id);const parsed=AI.result(raw,context);
  const state=E.initialState();state.accounts=context.accounts.map(a=>({...a,initial:0}));state.goals=context.goals.map(g=>({...g,target:10000000}));state.categories=context.categories;state.incomeCategories=context.incomeCategories;
  if(parsed.entries.length)assert(E.validateState(E.saveDrafts(state,parsed.entries).next),example.id);
  count++;
 }
 assert.equal(count,54);
});
test('prompt examples use current dates and existing goal identifiers',()=>{
 const context=Examples.benchmarkContext();context.today='2028-03-01';context.goals=[{id:'actual-goal',name:'Отпуск',currency:'RUB'}];
 const installment=Examples.materialize(Examples.corpus.examples.find(e=>e.id==='command-04'),context);assert.equal(installment.entries[0].date,'2028-02-29');
 const saving=Examples.materialize(Examples.corpus.examples.find(e=>e.id==='command-11'),context);assert.equal(saving.entries[0].goalId,'actual-goal');
 context.goals=[];assert.equal(Examples.materialize(Examples.corpus.examples.find(e=>e.id==='command-11'),context),null);
 context.accounts[0].currency='USD';assert.equal(Examples.materialize(Examples.corpus.examples.find(e=>e.id==='command-01'),context),null);
});
test('selection is bounded and never exposes evaluation or unresolved references as examples',()=>{
 const payload={text:'Взял в долг питик и напомни завтра оплатить интернет',context:Examples.benchmarkContext()};
 const chosen=Examples.select(payload);assert(chosen.length>0&&chosen.length<=3);
 for(const sample of chosen)assert.equal(Examples.corpus.examples.find(e=>e.id===sample.id).split,'prompt');
 const small=Examples.select(payload,{budget:1000});assert(small.reduce((n,e)=>n+JSON.stringify({phrase:e.text,response:e.response}).length,0)<=1000);
 assert.equal(Examples.prompt({text:'Какова скорость света?',context:payload.context}), '');
 const minimal={...payload.context,categories:['Другое'],incomeCategories:['Другое'],goals:[]};
 for(const sample of Examples.select({...payload,context:minimal}))assert.doesNotThrow(()=>AI.result(sample.response,minimal));
});
