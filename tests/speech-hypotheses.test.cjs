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

test('a replay with spoken and numeric amounts is removed before review and persistence',()=>{
 const transcript=V.createTranscript(E.normalizeVoiceAmounts);
 const first='Автомойка 1500 зарплата 15 000';
 const repeated=first+' Автомойка полторы тыщи зарплата 15 000';
 transcript.update(first,0,4);
 const text=transcript.update(repeated,0,8);
 assert.equal(text,first);
 const state=E.initialState(),result=E.parse(text,new Date(),[],state,'main');
 assert.deepEqual(result.entries.map(e=>[e.type,e.amount]),[['expense',150000],['income',1500000]]);
 const {next}=E.saveDrafts(state,result.entries);
 assert.equal(next.entries.length,2);
 assert.equal(E.balance(next,'main'),1350000);
 assert.equal(V.collapseReplay('Кофе 300 кофе 300',E.normalizeVoiceAmounts),'Кофе 300');
 assert.equal(V.collapseReplay('Кофе 300 и кофе 300',E.normalizeVoiceAmounts),'Кофе 300 и кофе 300');
 assert.equal(V.collapseReplay('Кофе 300 кофе 350',E.normalizeVoiceAmounts),'Кофе 300 кофе 350');
});
