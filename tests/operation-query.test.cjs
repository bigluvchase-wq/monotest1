const {test}=require('node:test'),assert=require('node:assert/strict');
const Q=require('../Mono/Web/operation-query'),E=require('../Mono/Web/engine');
const now=new Date(2026,10,22,12),state=E.initialState();
test('operation date searches match one validated day in numeric and spoken formats',()=>{
 for(const input of ['5 ноября','05.11','05.11.2026','пятого ноября','пять ноября','2026-11-05'])
  assert.equal(Q.searchDay(input,now),'2026-11-05',input);
 for(const input of ['31 февраля','31.02','кофе 500','1500','2026-02-30'])
  assert.equal(Q.searchDay(input,now),null,input);
});
test('local voice reports recognise calendar weeks, dates, ranges and categories',()=>{
 const report=text=>Q.report(text,state,now);
 assert.deepEqual(report('Покажи расходы по категории Авто за прошлую неделю'),{type:'expense',period:{start:'2026-11-09',end:'2026-11-15'},category:'Авто'});
 assert.deepEqual(report('Покажи доходы за пятого ноября').period,{start:'2026-11-05',end:'2026-11-05'});
 assert.deepEqual(report('Покажи операции с 5 по 10 ноября').period,{start:'2026-11-05',end:'2026-11-10'});
 assert.match(report('Покажи расходы по категории несуществующая за прошлую неделю').error,/Категория не найдена/);
 assert.match(report('Покажи расходы за 31 февраля').error,/даты нет/);
 assert.equal(report('Купил кофе за 300'),null);
});
test('voice history uses one or several categories before or after the period',()=>{
 const report=text=>Q.report(text,state,now);
 assert.equal(report('Покажи расходы на авто в этом месяце').category,'Авто');
 assert.deepEqual(report('расходы на продукты за прошлую неделю').period,{start:'2026-11-09',end:'2026-11-15'});
 assert.equal(report('расходы на продукты за прошлую неделю').category,'Продукты');
 assert.deepEqual(report('покажи расходы за эту неделю на продукты и на дом').categories,['Продукты','Дом']);
 assert.equal(report('Покажи расходы на продукты 5 ноября').category,'Продукты');
 assert.deepEqual(report('Покажи расходы на одежду и обувь и дом за эту неделю').categories,['Одежда и обувь','Дом']);
 assert.match(report('Покажи расходы на продукты и на неизвестную категорию').error,/Категория не найдена/);
 assert.equal(report('расходы на такси 300'),null);
});
