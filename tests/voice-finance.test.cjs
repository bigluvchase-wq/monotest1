const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../Mono/Web/engine'),V=require('../Mono/Web/voice-finance');
const now=new Date(2026,10,22,12),today=E.dateString(now);
const salary='получил зп 100 000р из них закинул 10 тыщ на отпуск и на 5к пополнил свой вклад';
const deposit=(id,name)=>({id,name,account:'main',start:'2026-10-01',end:'2027-03-01',principal:500000,rate:10,payout:'monthly',posted:0,postedAmount:0});
function fixture(){
 const state=E.initialState();
 state.goals.push({id:'holiday',name:'Отпуск',currency:'RUB',target:2000000});
 state.deposits.push(deposit('one','Надёжный'));
 return state;
}
test('split purchases reconcile exact cents and classify the remainder',()=>{
 const state=fixture();
 const review=t=>V.review(t,state,'main',now);
 const {entries,errors}=review('В магазине 2600, из них 1800 на продукты, остальное на дом');
 assert.deepEqual(errors,[]);assert.deepEqual(entries.map(e=>[e.category,e.amount]),[['Продукты',180000],['Дом',80000]]);
 assert.match(review('В магазине 2500, из них 2000 на продукты и 600 на дом').errors[0],/больше/);
 assert.match(review('В магазине 2500, из них 2000 на продукты и 300 на дом').errors[0],/общую сумму/);
 assert.equal(review('Кофе 300 и такси 500'),null);
});
test('allocation stores gross income and debits goal and deposit exactly once',()=>{
 const state=fixture(),draft=V.review(salary,state,'main',now);
 assert.deepEqual(draft.errors,[]);
 const {next}=E.saveDrafts(state,draft.entries,today+'T12:00:00.000Z');
 assert.equal(E.balance(next,'main'),8500000);
 assert.equal(next.entries.filter(E.isIncomeForStats).reduce((n,e)=>n+e.amount,0),10000000);
 assert.equal(E.goalBalance(next,'holiday'),1000000);
 assert.equal(E.depositPrincipal(next,next.deposits[0]),1000000);
 assert.equal(state.entries.length,0);
});
test('ambiguous deposit requires a selection and never commits a partial allocation',()=>{
 const state=fixture();state.deposits.push(deposit('second','Резерв'));
 const {entries}=V.review(salary,state,'main',now);
 assert.equal(entries.at(-1).depositTopUpId,'');
 assert.throws(()=>E.saveDrafts(state,entries,today+'T12:00:00.000Z'),/Выберите вклад/);
 entries.at(-1).depositTopUpId='second';
 const {next}=E.saveDrafts(state,entries,today+'T12:00:00.000Z');
 assert.equal(E.depositPrincipal(next,next.deposits[0]),500000);
 assert.equal(E.depositPrincipal(next,next.deposits[1]),1000000);
 assert.equal(V.review('Пришла зарплата 50 000, из них пополнил вклад Резерв на 5к',state,'main',now).entries.at(-1).depositTopUpId,'second');
});
test('voice reports read limits, goals, comparable dates and unpaid payments',()=>{
 const state=fixture();state.limits.RUB={'Авто':100000};
 state.entries=E.saveDrafts(state,[
  {title:'Заправка',type:'expense',category:'Авто',amount:30000,account:'main',date:'2026-11-10'},
  {title:'Заправка',type:'expense',category:'Авто',amount:20000,account:'main',date:'2026-10-10'},
  {title:'На отпуск',type:'saving',goalId:'holiday',amount:500000,account:'main',date:'2026-11-15'}
 ]).next.entries;
 state.payments.push({id:'internet',name:'Интернет',repeat:'monthly',date:'2026-12-02',category:'Дом',account:'main',amount:70000,remindDays:0});
 const read=text=>V.read(text,state,'main',now);
 assert.equal(read('Сколько осталось по лимиту на авто').items[0].spent,30000);
 assert.equal(read('Сколько накопил на отпуск').items[0].saved,500000);
 const cmp=read('На сколько больше я потратил на авто в этом месяце');
 assert.equal(cmp.rows[0].amount,30000);assert.equal(cmp.priorRows[0].amount,20000);assert.equal(cmp.previous.end,'2026-10-22');
 assert.match(read('Какие платежи остались до зарплаты').error,/Уточните дату/);
 assert.equal(read('Какие платежи до 5 декабря').items[0].payment.name,'Интернет');
});
