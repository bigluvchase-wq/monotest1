const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm');
const E=require('../Mono/Web/engine');
const now=new Date('2026-11-15T12:00:00');
test('питик means 500 rubles in both spending and incoming loans',()=>{
 for(const [phrase,type,category] of [['Кофе питик','expense','Кафе'],['Сегодня взял в долг у друга питик','income','Займы']]){
  const parsed=E.parse(phrase,now,[],E.initialState(),'main');assert.deepEqual(parsed.errors,[]);assert.equal(parsed.entries.length,1);
  assert.equal(parsed.entries[0].amount,50000);assert.equal(parsed.entries[0].type,type);assert.equal(parsed.entries[0].category,category);
 }
});
test('loans affect cash balance but not income statistics',()=>{
 const state=E.initialState();state.entries=[{id:'loan',type:'income',amount:50000,category:'Займы',account:'main',date:'2026-11-15'},{id:'salary',type:'income',amount:100000,category:'Зарплата',account:'main',date:'2026-11-15'}];
 assert.equal(E.balance(state,'main'),150000);assert.equal(state.entries.filter(E.isIncomeForStats).reduce((n,e)=>n+e.amount,0),100000);
});
test('repeated borrowing is not predicted as a regular salary date',()=>{
 const state=E.initialState(),current=new Date();
 for(let month=0;month<3;month++){const date=new Date(current.getFullYear(),current.getMonth()-month,10,12);state.entries.push({type:'income',amount:500000,category:'Займы',account:'main',date:E.dateString(date)});}
 const root={};const context={window:root,E,state,entryCurrency:()=> 'RUB',Date,console};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../Mono/Web/insights.js'),'utf8'),context);
 assert.equal(root.MonoInsights.incomeDays('RUB').length,0);
});
