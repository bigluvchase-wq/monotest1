const {test}=require('node:test'),assert=require('node:assert/strict'),V=require('../Mono/Web/voice'),E=require('../Mono/Web/engine');
test('timestamp drift and numeric revisions replace the formatted hypothesis',()=>{
 const t=V.createTranscript();
 assert.equal(t.update('Заправился на 6',0,1),'Заправился на 6');
 assert.equal(t.update('Заправился на 650',.2,2),'Заправился на 650');
 assert.equal(t.update('Заправился на 650',.4,2.1),'Заправился на 650');
 assert.equal(t.update('Заправился на 650 и напомни завтра купить корм',.6,6),'Заправился на 650 и напомни завтра купить корм');
 assert.equal(t.update('Заправился на 650 и напомни завтра купить корм',.8,6.2),'Заправился на 650 и напомни завтра купить корм');
});
test('short numeric tail revises the window rather than joining two number fragments',()=>{
 const t=V.createTranscript();t.update('Заправился на 6',0,2);assert.equal(t.update('Заправился на 650',.3,2.5),'Заправился на 650');
});
test('replayed complete hypothesis is idempotent while separate identical purchases survive',()=>{
 const t=V.createTranscript(),phrase='Купил кофе 300 потом заправился на 650 и напомни завтра купить корм';
 t.update(phrase,0,8);assert.equal(t.update(phrase+' '+phrase,0,16),phrase);
 assert.equal(t.update(phrase,0,8),phrase);
 const separate=V.createTranscript();assert.equal(separate.update('Кофе 300 и кофе 300',0,3),'Кофе 300 и кофе 300');
});
test('ambiguous numeric spacing is blocked instead of silently becoming two financial entries',()=>{
 const s=E.initialState();for(const text of ['заправился на 6 50','продукты 12 50']){const r=E.parse(text,new Date(),[],s,'main');assert.equal(r.entries.length,0);assert(r.errors.some(e=>e.includes('цифры пробелом')));}
 for(const [text,sum] of [['заправился на 650',65000],['продукты 1 500',150000],['кофе 6,50',650]]){const r=E.parse(text,new Date(),[],s,'main');assert.deepEqual(r.errors,[]);assert.equal(r.entries[0].amount,sum);}
});

test('a revised cumulative result replaces a previously preserved prefix too',()=>{
 const t=V.createTranscript();t.update('Кофе 300',0,2);t.update('Потом продукты 1000',4,7);assert.equal(t.update('Кофе 350 потом продукты 1000',0,7),'Кофе 350 потом продукты 1000');
});
test('recognition replaces a replay with a truncated final word and preserves explicit repeated items',()=>{
 const transcript=V.createTranscript(),phrase='Пришла зп 100 тысяч 10 из них отложил на отпуск';
 const partial=phrase.slice(0,-4);
 transcript.update(partial,0,5);
 assert.equal(transcript.update(partial+' '+phrase,0,12),phrase);
 assert.equal(V.repairReplay('Купил в магазине кофе 300 и купил в магазине кофе 300'),'Купил в магазине кофе 300 и купил в магазине кофе 300');
});

test('recognition repairs the repeated decimal amount without dropping intentional identical purchases',()=>{
 const replay='Продукты 999,99 руб. копе Продукты 999,99 руб. коек';
 assert.equal(V.repairReplay(replay),'Продукты 999,99 руб.');
 const transcript=V.createTranscript();
 assert.equal(transcript.update('Кофе 300 Кофе 300',0,2),'Кофе 300');
 const separate=V.createTranscript();
 assert.equal(separate.update('Кофе 300',0,1),'Кофе 300');
 assert.equal(separate.update('Кофе 300',2,3),'Кофе 300 Кофе 300');
 assert.equal(V.createTranscript().update('Кофе 300. Кофе 300',0,3),'Кофе 300. Кофе 300');
});

test('a replay with rewritten amounts keeps one copy and preserves unrelated operations',()=>{
 const first='Кофе 300 и продукты 1999',second='Кофе 300 и продукты тыща 999';
 const transcript=V.createTranscript();
 transcript.update(first,0,4);
 assert.equal(transcript.update(first+' '+second,0,8),second);
 assert.equal(V.repairReplay(first+' '+second+' и такси 650'),second+' и такси 650');
 assert.equal(V.repairReplay(first+' и еще '+second),first+' и еще '+second);
 assert.equal(V.repairReplay(first+'. '+second),first+'. '+second);
 assert.equal(V.repairReplay(first+' Кофе 300 и продукты 2000'),first+' Кофе 300 и продукты 2000');
 const separate=V.createTranscript();
 separate.update(first,0,4);
 assert.equal(separate.update(second,4.3,8),second);
});

test('reminders replay without an amount and explicitly repeated reminders stay visible',()=>{
 const phrase='Напомни завтра купить корм';
 assert.equal(V.repairReplay('Напомни купить корм Напомни купить корм'),'Напомни купить корм');
 assert.equal(V.repairReplay(phrase+' '+phrase),phrase);
 assert.equal(V.repairReplay(phrase+' и еще '+phrase),phrase+' и еще '+phrase);
 assert.equal(V.repairReplay(phrase+'. '+phrase),phrase+'. '+phrase);
 assert.equal(V.repairReplay(phrase+' Напомни завтра купить хлеб'),phrase+' Напомни завтра купить хлеб');
});
test('review detects repeated money and reminders while distinct details remain separate',()=>{
 const first={title:'Кофе',type:'expense',amount:30000,date:'2026-11-25',account:'main'};
 const reminder={title:'Купить корм',date:'2026-11-26',time:'09:00',repeat:'once'};
 assert.equal(E.duplicateDraftCount([first,{...first,category:'Работа'}],[reminder,{...reminder}]),2);
 assert.equal(E.duplicateDraftCount([first,{...first,amount:35000},{...first,account:'cash'},{...first,date:'2026-11-24'}],
  [reminder,{...reminder,time:'10:00'},{...reminder,text:'Для кота'}]),0);
});
