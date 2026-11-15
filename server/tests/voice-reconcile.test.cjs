const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reconcile,result}=require('../voice-ai');
const Examples=require('../voice-examples');
const corpus=require('../voice-examples.json');
test('shared application parser repairs observed categories, date scope and third-party transfer',()=>{
 const context=Examples.benchmarkContext();
 for(const id of ['legacy-05','legacy-09','legacy-12','legacy-13','legacy-14']){
  const example=corpus.examples.find(e=>e.id===id),expected=Examples.materialize(example,context);
  const raw=structuredClone(expected);
  raw.entries.forEach(e=>{e.category='Другое';e.date=context.today;});
  if(id==='legacy-13'){raw.entries[1].type='transfer';raw.entries[1].toAccount=null;}
  const actual=result(reconcile(raw,{text:example.text,context}),context);
  const fields=e=>[e.type,e.amount,e.account,e.date,e.category];
  assert.deepEqual(actual.entries.map(fields),expected.entries.map(fields),id);
 }
});
test('reconciliation never overrides different amounts, clarifications or mixed commands',()=>{
 const context=Examples.benchmarkContext(),example=corpus.examples.find(e=>e.id==='legacy-05');
 for(const modify of [r=>{r.entries[0].amount++;},r=>{r.errors=['operation'];},r=>{r.commands=[{kind:'reminder',data:{title:'Позвонить'}}];}]){
  const raw=Examples.materialize(example,context);modify(raw);
  assert.equal(reconcile(raw,{text:example.text,context}),raw);
 }
});
test('reminder removal accepts an exact title alias but rejects conflicting names',()=>{
 const context=Examples.benchmarkContext();
 const raw={entries:[],errors:[],commands:[{kind:'remove',data:{removeTarget:'reminder',title:'Позвонить маме',last:false}}]};
 assert.deepEqual(result(raw,context).commands,[{kind:'remove',data:{target:'reminder',name:'Позвонить маме',last:false,strict:true}}]);
 raw.commands[0].data.name='Оплатить интернет';
 assert.throws(()=>result(raw,context),/invalid_ai_response/);
});
