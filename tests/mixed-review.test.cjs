const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const E=require('../Mono/Web/engine');
const now=new Date(2026,10,19,12),state=E.initialState(),root={};
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}}
vm.runInNewContext(fs.readFileSync(require.resolve('../Mono/Web/voice-commands.js'),'utf8'),{window:root,E,state,Date:FixedDate,document:{addEventListener(){}}});
const phrase='купил кофе за 300 потом мы купили продукты за 1000 и вчера я заправился на лукойле на тыща 200 а ещё также вчера мне вернули долг 500 руб. и напомни завтра с утра купить корм';
const review=t=>root.MonoCommands.review(t,now,[],state,'main');
test('full owner phrase keeps coffee, short labels, dates and an editable reminder',()=>{
 for(const t of [phrase,phrase.replace('руб. и','рублей и'),phrase.replace('потом',' . Потом')]){
  const r=review(t);assert.deepEqual(r.errors,[]);
  assert.deepEqual(r.entries.map(e=>[e.title,e.amount,e.type,e.date]),[['Кофе',30000,'expense','2026-11-19'],['Продукты',100000,'expense','2026-11-19'],['Заправка',120000,'expense','2026-11-18'],['Возврат долга',50000,'income','2026-11-18']]);
  assert.equal(r.reminders.length,1);assert.equal(r.reminders[0].title,'Купить корм');assert.equal(r.reminders[0].date,'2026-11-20');assert.equal(r.reminders[0].time,'09:00');
  const saved=E.saveDrafts(state,r.entries,now.toISOString(),r.reminders);assert.equal(saved.next.entries.length,4);assert.equal(saved.next.reminders.length,1);assert.equal(saved.next.reminders[0].done,false);assert(E.validateState(saved.next));assert.equal(state.entries.length,0);
 }
});
test('invalid reminder prevents the whole mixed batch from being saved',()=>{
 const r=review(phrase);for(const change of [{title:' '},{date:''},{time:'25:00'},{repeat:'garbage'}])assert.throws(()=>E.saveDrafts(state,r.entries,now.toISOString(),[{...r.reminders[0],...change}]),/напоминания/);
 assert.equal(state.entries.length,0);assert.equal((state.reminders||[]).length,0);
});
test('reminders alone, multiple reminders, missing time and negation stay explicit',()=>{
 const r=review('Напомни завтра в 10 купить корм. И напомни послезавтра в 12 позвонить маме');assert.equal(r.entries.length,0);assert.equal(r.reminders.length,2);assert.equal(E.saveDrafts(state,[],now.toISOString(),r.reminders).next.reminders.length,2);
 assert.equal(review('Напомни купить корм').reminders[0].date,'');
 assert.equal(review('Не напомни купить корм').reminders.length,0);
 assert(review('Не купил кофе 300 и напомни завтра купить корм').errors.length);
});
test('concise titles preserve meaningful unknown merchants and purchased items',()=>{
 for(const [text,title] of [['Мы купили корм для кота 500','Корм для кота'],['Я купил чехол для телефона 900','Чехол для телефона'],['Мы купили продукты 1000','Продукты'],['Я заправиля на лукойле 1200','Заправка']])assert.equal(E.parse(text,now,[],state,'main').entries[0].title,title);
});
test('native bridge keeps later utterances and replaces overlapping partial revisions',()=>{
 const src=fs.readFileSync(require.resolve('../Mono/Web/native-bridge.js'),'utf8');const end=src.indexOf('function refreshReminders');
 const native={webkit:{messageHandlers:{mono:{postMessage(){}}}}};vm.runInNewContext(src.slice(0,end)+'root.TestRecognition=NativeRecognition;root.testEvent=speechEvent;})(window);',{window:native});
 const rec=new native.TestRecognition(),results=[];rec.onresult=e=>results.push(e.results[0][0].transcript);rec.start();
 const emit=(text,start,end)=>native.testEvent(rec.id,'result',{text,segmentStart:String(start),segmentEnd:String(end)});
 emit('Купил кофе за 30',0.2,2);emit('Купил кофе за 300',0.2,2.2);emit('Потом продукты',4,5);emit('Потом продукты за 1000',4,6);
 assert.equal(results.at(-1),'Купил кофе за 300 Потом продукты за 1000');
 emit('Потом продукты за 1000 и напомни завтра купить корм',4,10);assert.equal(results.at(-1),'Купил кофе за 300 Потом продукты за 1000 и напомни завтра купить корм');
 emit('Купил кофе за 300 потом продукты за 1000 и напомни завтра купить корм',0.2,10);assert.equal(results.at(-1),'Купил кофе за 300 потом продукты за 1000 и напомни завтра купить корм');
 native.testEvent(rec.id,'end',{});const next=new native.TestRecognition();next.onresult=rec.onresult;next.start();native.testEvent(next.id,'result',{text:'Новая запись',segmentStart:'0.2',segmentEnd:'2'});assert.equal(results.at(-1),'Новая запись');
});
