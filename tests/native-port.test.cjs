const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const web = path.join(__dirname, '../Mono/Web');
const E = require(path.join(web, 'engine.js'));
const MonoSchedule = require(path.join(web, 'schedule.js'));
const state = E.initialState();
state.payments.push({
  id: 'p', name: 'Интернет', category: 'Связь', account: 'main',
  amount: 80000, repeat: 'fortnightly', date: '2026-11-10', remindDays: 2, reminderTime: '09:00'
});
state.entries.push({paymentId:'p',paymentDate:'2026-11-10'});
const posted = [];
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [2026, 10, 5, 10])); }
}
const window = {webkit: {messageHandlers: {mono: {postMessage: message => posted.push(message)}}}};
vm.runInNewContext(fs.readFileSync(path.join(web,'native-bridge.js'),'utf8'),{
  window,E,MonoSchedule,state,Date:FixedDate,money:n=>String(n/100),account:()=>state.accounts[0]
});
const bridge=window.MonoNative;
const rec=new bridge.Recognition();
const events=[];
rec.onstart=()=>events.push('start');
rec.onresult=e=>events.push(e.results[0][0].transcript);
rec.onend=()=>events.push('end');
rec.start();
bridge.speechEvent(rec.id,'start',{});
bridge.speechEvent(rec.id,'result',{text:'КБ 300'});
rec.stop();
bridge.speechEvent(rec.id,'end',{});
assert.deepEqual(events,['start','КБ 300','end']);
assert.deepEqual(posted.slice(0,2).map(m=>m.action),['speechStart','speechStop']);
bridge.refreshReminders();
const items=posted.at(-1).items;
assert.equal(items.length,60);
assert.equal(items[0].date,'2026-11-22');
assert.equal(items[1].date,'2026-11-24');
assert.equal(items[1].time,'09:00');
const result=E.parse('КБ 300, вчера оплатил долями куртку за 8000',new Date(2026,10,5),[],E.initialState());
assert.deepEqual(result.errors,[]);
assert.equal(result.entries[0].category,'Продукты');
const saved=E.saveDrafts(E.initialState(),result.entries);
assert.equal(saved.next.payments.length,3);
assert.equal(saved.added[1].amount,200000);
assert(E.validateState(JSON.parse(JSON.stringify(saved.next))));
const html=fs.readFileSync(path.join(web,'index.html'),'utf8');
for (const [,url] of html.matchAll(/(?:src|href)="(\.\/[^"?]+)(?:\?[^"]*)?"/g)) {
  assert(fs.existsSync(path.join(web,url)),url);
}
assert(html.indexOf('./native-bridge.js')<html.indexOf('./app.js'));
console.log('Native bridge protocol, reminder queue, bundled assets, parser and backup format passed.');

const day=new Date(2026,10,5);
for(const phrase of ['300 рублей кофе','300 руб. кофе','кофе 300 рублей','кофе 300 руб.']){
  const parsed=E.parse(phrase,day,[],E.initialState());
  assert.deepEqual(parsed.errors,[],phrase);
  assert.deepEqual(parsed.entries.map(e=>[e.title,e.amount,e.type,e.category]),[['Кофе',30000,'expense','Кафе']],phrase);
}
for(const phrase of ['45 000 руб. зарплата','зарплата 45 000 руб.']){
  const parsed=E.parse(phrase,day,[],E.initialState());
  assert.deepEqual(parsed.errors,[],phrase);
  assert.deepEqual(parsed.entries.map(e=>[e.amount,e.type,e.category]),[[4500000,'income','Зарплата']],phrase);
}
const ordered=E.parse('вчера 300 руб. кофе, сегодня зарплата 45 тысяч',day,[],E.initialState());
assert.deepEqual(ordered.errors,[]);
assert.deepEqual(ordered.entries.map(e=>[e.amount,e.date]),[[30000,'2026-11-04'],[4500000,'2026-11-05']]);
assert(!E.initialState().categories.includes('Ставки'));
const old=E.initialState();
delete old.settings.betsDefaultRemoved;
old.categories.push('Ставки');
assert(!E.migrate(old).categories.includes('Ставки'));
old.entries.push({id:'old-bet',title:'Старая запись',account:'main',date:'2026-11-04',amount:30000,type:'expense',category:'Ставки'});
const migrated=E.migrate(old);
assert(E.validateState(migrated));
assert.deepEqual(migrated.entries,old.entries);
assert.equal(E.parse('пополнил фонбет 300',day,migrated.entries,migrated).entries[0].category,'Другое');
