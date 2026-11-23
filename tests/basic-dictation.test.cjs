const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const fixture=require('./fixtures/basic-dictation.json');
const E=require('../Mono/Web/engine');
const Voice=require('../Mono/Web/voice');
const now=new Date(fixture.date+'T12:00:00');
const state=E.initialState(),root={};
const source=fs.readFileSync(require.resolve('../Mono/Web/voice-commands.js'),'utf8');
vm.runInNewContext(source,{window:root,E,state,Date,document:{addEventListener(){}}});

function expectDrafts(text,expected){
 const result=root.MonoCommands.review(text,now,state.entries,state,'main');
 if(!expected.length){
  assert.equal(result.entries.length,0);
  assert(result.errors.length>0);
  return;
 }
 assert.deepEqual(result.errors,[]);
 const wanted=expected.map(([title,amount,type,category,days=0])=>{
  const date=new Date(now);date.setDate(date.getDate()+days);
  return [title,amount,type,category,E.dateString(date),'main'];
 });
 assert.deepEqual(result.entries.map(e=>[e.title,e.amount,e.type,e.category,e.date,e.account]),wanted);
 assert.equal(E.saveDrafts(state,result.entries).added.length,expected.length);
}

for(const [text,expected] of fixture.editorial)test('Редакционная фраза · '+text,()=>expectDrafts(text,expected));
for(const {said,recognized,expected} of fixture.observed)test('Расшифровка · '+recognized,()=>{
 expectDrafts(said,expected);
 const transcript=Voice.createTranscript();
 expectDrafts(transcript.update(recognized,0,5),expected);
});

test('Ручная категория сохраняется в следующем расходе с тем же названием',()=>{
 const history=[{type:'expense',title:'Кофе',category:'Работа',categoryChosen:true}];
 const result=root.MonoCommands.review('Вчера потратил 300 на кофе',now,history,state,'main');
 assert.deepEqual(result.entries.map(e=>[e.amount,e.type,e.category]),[[30000,'expense','Работа']]);
});
