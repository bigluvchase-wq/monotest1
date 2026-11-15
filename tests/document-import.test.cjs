const {test}=require('node:test'),assert=require('node:assert/strict');const E=require('../Mono/Web/engine'),D=require('../Mono/Web/document-import');const state=E.initialState(),today='2026-11-15';
test('bank OCR preserves signs and dates, excludes balance and never saves',()=>{
 const r=D.parse('Баланс 100000 ₽\n14.11.2026\nЛента\n−5 437,50 ₽\nЗарплата +80 000 ₽',state,'main',today);
 assert.deepEqual(r.entries.map(e=>[e.type,e.amount,e.date]),[['expense',543750,'2026-11-14'],['income',8000000,'2026-11-14']]);assert.equal(state.entries.length,0);
});
test('notes use local parser and flag an assumed date',()=>{const r=D.parse('Купил продукты 500\nПолучил зарплату 80000\nКофе 250',state,'main',today);assert.equal(r.entries.length,3);assert.equal(r.assumed,true);assert.equal(r.entries[1].type,'income');});
test('ambiguous amounts and invalid dates are not silently imported',()=>{const r=D.parse('31.02.2026\n16.11.2026\nТакси -500 ₽\n15.11.2026\nМагазин -500 +300',state,'main',today);assert.equal(r.entries.length,0);assert(r.errors.length>=3);});
test('date headers do not leak across PDF pages',()=>{const r=D.parse('14.11.2026\nМагазин -500\n\f\nКофе -200',state,'main',today);assert.equal(r.entries[1].date,today);assert.equal(r.assumed,true);});
