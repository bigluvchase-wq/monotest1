const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../Mono/Web/engine');
const now=new Date(2026,10,21,12),state=E.initialState();state.goals.push({id:'holiday',name:'Отпуск',currency:'RUB',target:10000000});
const root={};vm.runInNewContext(fs.readFileSync(require.resolve('../Mono/Web/voice-commands.js'),'utf8'),{window:root,E,state,Date,document:{addEventListener(){}}});
const review=t=>root.MonoCommands.review(t,now,[],state,'main');
test('Cyrillic/Latin thousands, case, spacing, decimals and joined rubles have the same money value',()=>{
 for(const [text,amount] of [['2к',200000],['7к',700000],['7K',700000],['2 К',200000],['2kруб',200000],['7крублей',700000],['7к₽',700000],['2,5к',250000],['2.5K',250000],['2,50 к рублей',250000]]){const r=review('продукты '+text);assert.deepEqual(r.errors,[],text);assert.equal(r.entries.length,1,text);assert.equal(r.entries[0].amount,amount,text);}
 for(const unit of ['кг','км','кВт'])assert.equal(E.parse('кофе 2'+unit,now,[],state,'main').entries.length,0,unit+' is not thousand rubles');
});
test('continuous mixed dictation separates incoming actions from the previous expense or income',()=>{
 const r=review('купил кофе 300 потратил 2к на продукты получил 7K за работу вернули 500 долг начислили зарплату 70к заправился 7к и напомни завтра в 9 купить корм');assert.deepEqual(r.errors,[]);
 assert.deepEqual(r.entries.map(e=>[e.amount,e.type,e.category]),[[30000,'expense','Кафе'],[200000,'expense','Продукты'],[700000,'income','Работа'],[50000,'income','Возврат долга'],[7000000,'income','Зарплата'],[700000,'expense','Авто']]);assert.equal(r.reminders.length,1);assert.equal(r.reminders[0].time,'09:00');assert.equal(r.reminders[0].date,'2026-11-22');assert(E.validateState(E.saveDrafts(state,r.entries,now.toISOString(),r.reminders).next));
});
test('amount-first, amount-last and real repeated purchases remain distinct',()=>{
 for(const text of ['продукты 2к такси 7к зарплата 50к','2к продукты 7к такси 50к зарплата']){const r=review(text);assert.deepEqual(r.errors,[]);assert.deepEqual(r.entries.map(e=>e.amount),[200000,700000,5000000]);assert.equal(r.entries[2].type,'income');}
 const repeat=review('кофе 300 и кофе 300 и продукты 2к');assert.equal(repeat.entries.length,3);assert.deepEqual(repeat.entries.map(e=>e.amount),[30000,30000,200000]);assert.equal(review('хлеб и молоко 2к').entries.length,1);
});
test('a short money suffix after a reminder is another record, including Latin k',()=>{
 for(const suffix of ['7к','7K','7крублей']){const r=review('напомни завтра купить корм а потом потратил '+suffix+' на бензин');assert.deepEqual(r.errors,[]);assert.equal(r.entries.length,1);assert.equal(r.entries[0].amount,700000);assert.equal(r.reminders.length,1);assert.equal(r.reminders[0].title,'Купить корм');}
});
test('savings, incoming debt and outgoing debt keep independent meanings',()=>{
 const r=review('получил зарплату 70к потом отложил на отпуск 2к потом вернули 7к долг потом я вернул долг 500');assert.deepEqual(r.errors,[]);assert.deepEqual(r.entries.map(e=>e.type),['income','saving','income','expense']);assert.equal(r.entries[1].goalId,'holiday');assert.equal(r.entries[2].category,'Возврат долга');assert.equal(r.entries[3].amount,50000);
});
