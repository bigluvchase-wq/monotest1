const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../Mono/Web/app.js'),'utf8');
const start=source.indexOf('function daySumHTML(');
const end=source.indexOf('\nfunction groupedEntriesHTML',start);
function render(entries,visible){
 const context={state:{entries},selectedCurrency:'RUB',entryCurrency:e=>e.currency||'RUB',esc:String,money:(amount,currency)=>`${amount/100} ${currency}`};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 return context.daySumHTML(visible);
}
const expense=(date,amount,currency='RUB')=>({date,amount,currency,type:'expense'});
test('day total includes all expenses for the date when search shows only one entry',()=>{
 const entries=[expense('2026-11-15',28000),expense('2026-11-15',30000),expense('2026-11-14',10000),expense('2026-11-15',50000,'USD'),{date:'2026-11-15',amount:12000000,type:'income'},{date:'2026-11-15',amount:100000,type:'transfer'}];
 const html=render(entries,[entries[0]]);
 assert.match(html,/>580 RUB<\/button>/);
 assert.match(html,/data-day-expense="2026-11-15"/);
 assert.doesNotMatch(html,/day-in|day-out|[−+]/);
});
test('an income-only date shows zero expenses',()=>{
 const entries=[{date:'2026-11-15',amount:12000000,type:'income'}];
 assert.match(render(entries,entries),/>0 RUB<\/button>/);
});
