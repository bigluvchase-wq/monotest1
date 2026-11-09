const assert=require('node:assert/strict');
const {test}=require('node:test');
const E=require('../Mono/Web/engine');
const P=require('../Mono/Web/period');
const F=require('../Mono/Web/finance-tools');
const C=require('../Mono/Web/voice-commands');
const S=require('../Mono/Web/global-search');
const Schedule=require('../Mono/Web/schedule');
const now=new Date(2026,10,9,14,30);

test('daily and monthly deposits earn 500 RUB on 1000 RUB at 50% for 365 days',()=>{
 for(const frequency of ['daily','monthly']){
  const state=E.initialState();
  state.deposits.push({id:'d',name:'Вклад',account:'main',principal:100000,rate:5000,start:'2026-11-09',end:'2027-11-09',frequency,posted:0});
  assert(E.validateState(state));
  const next=F.accrue(state,'2027-11-09');
  assert(E.validateState(next));
  assert.equal(next.entries.length,frequency==='daily'?365:12);
  assert.equal(next.entries.reduce((n,e)=>n+e.amount,0),50000);
  assert.equal(F.accrue(next,'2027-11-10'),null);
  next.entries.pop();
  assert.equal(F.accrue(next,'2027-11-10'),null);
 }
 assert.equal(F.anniversary('2026-01-31',1),'2026-02-28');
 assert.equal(F.anniversary('2026-01-31',2),'2026-03-31');
});
test('optional records keep existing backups valid and bounded payments stop repeating',()=>{
 const state=E.initialState();delete state.deposits;delete state.reminders;
 assert(E.validateState(state));assert.deepEqual(E.migrate(state).deposits,[]);
 const p={date:'2026-10-06',endDate:'2026-11-01',repeat:'monthly'};
 assert.equal(Schedule.next(p,'2026-11-01'),null);
 assert.deepEqual(Schedule.datesInMonth(p,'2026-11'),[]);
 assert.equal(Schedule.isDue(p,'2026-11-06'),false);
});
test('search combines local dates, categories, exact amount and ё normalization',()=>{
 const entry={title:'Пятёрочка, такси',category:'Продукты',note:'Семья',date:'2026-10-31',amount:150000,type:'expense'};
 for(const q of ['пятер','продукты за октябрь','такси вчера','1 500 ₽','семья 1500 руб','31.10.2026']){
  assert(S.matches(entry,S.parse(q,'2026-11-01',P),'RUB'),q);
 }
 for(const q of ['1 501 ₽','1 500 €','такси сегодня'])assert(!S.matches(entry,S.parse(q,'2026-11-01',P),'RUB'),q);
});
test('spoken commands open matching forms and remain separate from transaction dictation',()=>{
 const state=E.initialState(),parse=phrase=>C.parse(phrase,state,now);
 assert.equal(parse('Потратил 300 на кофе'),null);
 assert.equal(parse('Оплатил Сплит 5000'),null);
 assert.equal(parse('Перевёл 500 евро на счёт'),null);
 assert.equal(parse('Хочу тратить на кофе 300').action,'clarify');
 assert.equal(parse('Создай счёт для путешествий в евро').name,'Путешествия');
 assert.equal(parse('Создай счёт для путешествий в евро').currency,'EUR');
 assert.equal(parse('Создай счёт в евро').name,'');
 assert.equal(parse('Хочу накопить 500 тысяч на машину').amount,50000000);
 assert.equal(parse('Хочу накопить 500 тысяч на машину').name,'Машина');
 assert.equal(parse('Добавь обязательный платёж 5000 рублей Сплит').name,'Сплит');
 assert.equal(parse('Создай платёж Netflix 15 евро').currency,'EUR');
 assert.equal(parse('Отключи все лимиты').bulk,true);
 assert.equal(parse('Напоминай за три дня до платежа').remindDays,3);
 assert.deepEqual(parse('Напомни заплатить за VPN через 2 часа'),{kind:'reminders',action:'create',name:'Заплатить за VPN',date:'2026-11-09',time:'16:30'});
 assert.deepEqual(parse('Напомни завтра поздравить Сашу с днём рождения'),{kind:'reminders',action:'create',name:'Поздравить Сашу с днём рождения',date:'2026-11-10',time:'00:00'});
 const aliases=[['кофе','Кафе'],['такси','Транспорт'],['бензин','Авто'],['продукты','Продукты'],['аптеку','Здоровье'],['одежду','Одежда и обувь'],['кино','Развлечения'],['интернет','Связь'],['коммуналку','Дом'],['подписки','Подписки']];
 const forms=['Установи лимит на','Поставь бюджет на','Ограничь расходы на','Поставь ограничение на','Сделай лимит на','Не хочу тратить на'];
 for(const [term,category] of aliases)for(const prefix of forms)for(const [words,amount] of [['300 рублей',30000],['5000',500000],['10 тысяч',1000000],['полторы тысячи',150000],['1500 рублей',150000]]){
  const phrase=prefix+' '+term+' '+words,c=parse(phrase);
  assert.equal(c.kind,'limits',phrase);assert.equal(c.category,category,phrase);assert.equal(c.amount,amount,phrase);
 }
});
