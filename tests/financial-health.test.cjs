const {test}=require('node:test');const assert=require('node:assert/strict');
const E=require('../Mono/Web/engine'),H=require('../Mono/Web/financial-health');
const today='2026-11-15';
function seed(){const s=E.initialState();s.accounts[0].initial=30000000;
 for(const m of ['08','09','10'])s.entries.push({id:'i'+m,title:'Зарплата',type:'income',category:'Зарплата',amount:10000000,date:`2026-${m}-01`,account:'main'},{id:'e'+m,title:'Покупки',type:'expense',category:'Продукты',amount:6000000,date:`2026-${m}-02`,account:'main'});
 s.settings.financialHealth={historyComplete:true,reserveConfirmed:true,reserveAccountIds:['main'],debtConfirmed:true,debtPaymentIds:[],paymentsComplete:true};return s;}
test('health uses complete months, separates currencies and excludes loans and transfers',()=>{
 const s=seed(),base=H.calculate(s,'RUB',today);assert.equal(base.monthlyIncome,10000000);assert.equal(base.monthlyExpense,6000000);assert.equal(base.score,100);
 s.accounts.push({id:'usd',name:'USD',currency:'USD',initial:0});
 s.entries.push({id:'foreign',title:'Income',type:'income',category:'Зарплата',amount:99999999,date:'2026-09-01',account:'usd'},{id:'loan',title:'Займ',type:'income',category:'Займы',amount:10000000,date:'2026-09-01',account:'main'},{id:'current',title:'Зарплата',type:'income',category:'Зарплата',amount:50000000,date:'2026-11-01',account:'main'});
 assert.equal(H.calculate(s,'RUB',today).monthlyIncome,base.monthlyIncome);
});
test('missing history and missing declarations never produce a healthy default',()=>{
 assert.equal(H.calculate(E.initialState(),'RUB',today).score,null);
 const s=seed();delete s.settings.financialHealth;const r=H.calculate(s,'RUB',today);assert.equal(r.score,null);assert.equal(r.parts.find(p=>p.id==='reserve').score,null);assert.equal(r.parts.find(p=>p.id==='debt').score,null);
 s.settings.financialHealth={historyComplete:true};s.entries=s.entries.filter(e=>e.type==='expense');assert.equal(H.calculate(s,'RUB',today).parts[0].score,0);
});
test('deposit principal is not added and is excluded from liquid coverage until maturity',()=>{
 const s=seed();s.deposits=[{id:'d',name:'Вклад',principal:40000000,account:'main',start:'2026-08-01',end:'2027-08-01'}];
 const r=H.calculate(s,'RUB',today);assert.equal(r.liquid,2000000);assert.equal(r.reserve,2000000);assert.equal(r.depositPrincipal,40000000);
 assert.equal(H.calculate(s,'RUB','2027-08-01').liquid,42000000);
});
test('future obligations count each recurrence and recorded payment only once',()=>{
 const s=seed();s.payments=[{id:'p',name:'Кредит',amount:1000000,account:'main',date:'2026-11-15',repeat:'monthly',category:'Дом',remindDays:0}];s.settings.financialHealth.debtPaymentIds=['p'];
 s.entries.push({id:'paid',title:'Кредит',type:'expense',category:'Дом',amount:1000000,account:'main',date:today,paymentId:'p',paymentDate:today});
 const r=H.calculate(s,'RUB',today);assert.equal(r.debt,1000000);assert.equal(r.upcoming,1000000);assert.equal(r.unpaid,0);assert.equal(r.parts.find(p=>p.id==='bills').score,100);
});
test('matched refunds reduce spending without counting as income',()=>{
 const s=seed();s.entries.push({id:'r',title:'Возврат',type:'income',category:'Возвраты',amount:6000000,account:'main',date:'2026-08-05',refundOf:'e08'});
 const r=H.calculate(s,'RUB',today);assert.equal(r.monthlyIncome,10000000);assert.equal(r.monthlyExpense,4000000);
});
test('purchase reviews wait two weeks, skip everyday spending and survive validation',()=>{
 const s=seed();s.entries.push({id:'phone',title:'Телефон',type:'expense',category:'Покупки',amount:500000,account:'main',date:'2026-10-15'});
 assert.equal(H.reviewCandidate(s,'RUB',today).id,'phone');s.entries.at(-1).purchaseReview={value:'useful',date:today};s.settings.financialHealth.lastReviewDate=today;
 assert.equal(E.validateState(s),true);assert.equal(H.reviewCandidate(s,'RUB',today),null);
 s.entries.at(-1).purchaseReview.value='invalid';assert.equal(E.validateState(s),false);
});
test('confirmed exact names teach categories and direction; explicit direction wins',()=>{
 const s=E.initialState();s.entries=[{id:'learn',title:'Ромашка',type:'income',category:'Работа',categoryChosen:true,amount:50000,account:'main',date:'2026-11-01'}];
 const parse=t=>E.parse(t,new Date(today+'T12:00:00'),s.entries,s).entries[0];
 assert.equal(parse('5000 ромашка').type,'income');assert.equal(parse('5000 ромашка').category,'Работа');
 assert.equal(parse('купил ромашка 500').type,'expense');assert.notEqual(parse('500 ромашка маркет').category,'Работа');
 s.entries[0].categoryChosen=false;assert.equal(parse('500 ромашка').type,'expense');
 s.entries[0]={...s.entries[0],categoryChosen:true,type:'expense',category:'Продукты'};assert.equal(parse('500 рублей ромашка').category,'Продукты');
});
test('personal targets affect the relevant components and are validated',()=>{
 const s=seed();s.goals=[{id:'g',name:'Подушка',currency:'RUB',target:10000000}];
 for(const m of ['08','09','10'])s.entries.push({id:'s'+m,title:'В накопления',type:'saving',amount:1000000,date:`2026-${m}-10`,account:'main',goalId:'g'});
 let r=H.calculate(s,'RUB',today);assert.equal(r.parts.find(p=>p.id==='saving').score,100);assert.equal(r.savingMonths,3);
 s.settings.financialHealth.savingRate=.2;s.settings.financialHealth.reserveMonths=12;r=H.calculate(s,'RUB',today);
 assert.equal(r.parts.find(p=>p.id==='saving').score,50);assert(r.parts.find(p=>p.id==='reserve').score<100);assert.equal(E.validateState(s),true);
 s.settings.financialHealth.savingRate=0;assert.equal(E.validateState(s),false);
});
test('7, 14 and 30 day payment horizons are nested, not additive',()=>{
 const s=seed();s.payments=[{id:'weekly',name:'Платёж',amount:10000,account:'main',date:today,repeat:'weekly',category:'Дом',remindDays:0}];
 assert.deepEqual(H.calculate(s,'RUB',today).commitments,{7:10000,14:20000,30:50000});
});
test('a statement beginning mid-month does not make that month a full observation',()=>{const s=seed();s.entries=s.entries.filter(e=>e.date>='2026-08-15');s.settings.financialHealth.coverageStartByCurrency={RUB:'2026-08-15'};assert.deepEqual(H.calculate(s,'RUB','2026-11-15').months,['2026-09','2026-10']);});
