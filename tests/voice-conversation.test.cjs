const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const E=require('../Mono/Web/engine');
const now=new Date(2026,10,16,12),state=E.initialState();
const expenses=[
 ['Кофе полтос',50,'Кафе'],['Кофе полтинник',50,'Кафе'],['Проезд чирик',10,'Транспорт'],['Проезд червонец',10,'Транспорт'],
 ['Продукты 2к',2000,'Продукты'],['Такси 1,5к',1500,'Транспорт'],['Продукты пару тысяч',2000,'Продукты'],['Продукты пара тысяч',2000,'Продукты'],
 ['Кофеек 150',150,'Кафе'],['Кофеечек с собой 220',220,'Кафе'],['Закинул на мобилу 700',700,'Связь'],['Закинула на мобилу 700',700,'Связь'],
 ['Положил на телефон 800',800,'Связь'],['Переобул машину 2500',2500,'Авто'],['Шинка 2000',2000,'Авто'],['Списали за инет 650',650,'Связь'],
 ['С карты списалось 1200 за продукты',1200,'Продукты'],['Вчера списали за мобильную связь 650',650,'Связь']
];
const incomes=[
 ['Выручил за продажу велосипеда 12000',12000,'Продажи'],['Выручила за продажу куртки 2500',2500,'Продажи'],
 ['Подработка принесла 4500',4500,'Работа'],['Фриланс принес 5000',5000,'Работа'],['За фриланс заплатили 9000',9000,'Работа'],
 ['Рассчитались со мной за работу 8500',8500,'Работа'],['Зачислили стипендию 4500',4500,'Социальные выплаты'],
 ['Пришла пенсия 22000',22000,'Социальные выплаты'],['Начислили пособие 7500',7500,'Социальные выплаты'],['Зачислили алименты 15000',15000,'Социальные выплаты'],
 ['Мне возместили расходы на командировку 8000',8000,'Возвраты'],['Компенсировали мне билет 3500',3500,'Возвраты'],
 ['Деньги за отмененный заказ вернулись 1700',1700,'Возвраты'],['Зачислили проценты по вкладу 350',350,'Проценты'],['На карту капнула зарплата 85000',85000,'Зарплата']
];
for(const [type,cases] of [['expense',expenses],['income',incomes]])test('conversational '+type+' phrases preserve amount, direction, category and valid saving',()=>{
 for(const [phrase,amount,category] of cases){const r=E.parse(phrase,now,[],state,'main');assert.deepEqual(r.errors,[],phrase);assert.equal(r.entries.length,1,phrase);assert.equal(r.entries[0].amount,amount*100,phrase);assert.equal(r.entries[0].type,type,phrase);assert.equal(r.entries[0].category,category,phrase);assert.equal(r.entries[0].date,phrase.startsWith('Вчера')?'2026-11-15':'2026-11-16',phrase);assert(E.validateState(E.saveDrafts(state,r.entries).next),phrase);}
});
test('new receipt words do not turn negations and future actions into completed operations',()=>{
 for(const phrase of ['Не списали за инет 650','Не списалось 1200 за продукты','Не зачислили стипендию 4500','Не начислили пособие 7500','Должны зачислить стипендию 4500','Мне не возместили расходы 8000','Подработка не принесла 4500','Фриланс не принес 5000','Не выручил за продажу велосипеда 12000','Завтра зачислят зарплату 85000','Жду стипендию 4500','Ожидаю пенсию 22000']){const r=E.parse(phrase,now,[],state,'main');assert.equal(r.entries.length,0,phrase);assert(r.errors.length,phrase);}
});
test('mixed new phrases retain individual directions and dates',()=>{
 const r=E.parse('Вчера списали за инет 650, сегодня подработка принесла 4500 и такси 1,5к',now,[],state,'main');assert.deepEqual(r.errors,[]);assert.deepEqual(r.entries.map(e=>[e.type,e.amount,e.date]),[['expense',65000,'2026-11-15'],['income',450000,'2026-11-16'],['expense',150000,'2026-11-16']]);
});
test('spending on salaries and own transfers keep their existing direction rules',()=>{
 assert.equal(E.parse('Заплатил сотруднику зарплату 20000',now,[],state,'main').entries[0].type,'expense');
 const two=structuredClone(state);two.accounts.push({id:'cash',name:'Наличные',currency:'RUB',initial:0});const r=E.parse('Перевел самому себе 2к с карты на накопительный счет',now,[],two,'main');assert.deepEqual(r.errors,[]);assert.equal(r.entries.length,1);assert.equal(r.entries[0].type,'transfer');assert.equal(r.entries[0].amount,200000);assert.equal(E.parse('Перевел между своими счетами 2к на оплату мобильной связи',now,[],two,'main').entries[0].type,'transfer');
});
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now.getTime();}}
const root={},context={window:root,E,state,Date:FixedDate,console,document:{addEventListener(){}}};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../Mono/Web/voice-commands.js'),'utf8'),context);
const commands=[
 ['Пожалуйста напомни завтра в 10 утра оплатить инет','reminder',{title:'Оплатить инет',date:'2026-11-17',time:'10:00'}],
 ['Поставь напоминалку завтра в 9 позвонить маме','reminder',{title:'Позвонить маме',time:'09:00'}],
 ['Напоминай каждый месяц первого числа оплатить аренду','reminder',{title:'Оплатить аренду',repeat:'monthly',date:'2026-12-01'}],
 ['Не забудь завтра забрать посылку','reminder',{title:'Забрать посылку',date:'2026-11-17'}],
 ['Мне нужно напомнить завтра в 10 проверить почту','reminder',{title:'Проверить почту',time:'10:00'}],
 ['Хочу напоминание завтра купить билеты','reminder',{title:'Купить билеты'}],
 ['Создать напоминание завтра позвонить врачу','reminder',{title:'Позвонить врачу'}],
 ['Установи напоминание завтра в 11 оплатить страховку','reminder',{title:'Оплатить страховку',time:'11:00'}],
 ['Поставь цель отпуск 100 тысяч','goal',{name:'Отпуск',target:10000000}],
 ['Начни копить на отпуск 100 тысяч','goal',{name:'Отпуск',target:10000000}],
 ['Хочу откладывать на ремонт 50 тысяч','goal',{name:'Ремонт',target:5000000}],
 ['Заведи копилку на ремонт 50 тысяч','goal',{name:'Ремонт',target:5000000}],
 ['Добавить цель отпуск 100 тысяч','goal',{name:'Отпуск',target:10000000}],
 ['Добавь ежемесячный расход интернет 700 20 ноября','payment',{name:'Интернет',amount:70000,repeat:'monthly',date:'2026-11-20'}],
 ['Запланируй платеж аренда 40000 5 числа','payment',{name:'Аренда',amount:4000000,date:'2026-12-05'}],
 ['Установи лимит расходов на кафе 5к','limit',{category:'Кафе',amount:500000}],
 ['Моно пожалуйста поставь лимит на продукты пару тысяч','limit',{category:'Продукты',amount:200000}],
 ['Создать счет наличные 5000','account',{name:'Наличные',initial:500000}],
 ['Добавить счет отпуск в долларах 500','account',{name:'Отпуск',currency:'USD',initial:50000}],
 ['Открыть вклад 100 тысяч под 16 процентов на год','deposit',{principal:10000000,rate:16,term:'1y'}]
];
test('conversational creation commands retain names, amounts, dates and recurrence',()=>{
 for(const [phrase,kind,data] of commands){const cmd=root.MonoCommands.detect(phrase);assert(cmd,phrase);assert.equal(cmd.kind,kind,phrase);for(const [key,value] of Object.entries(data))assert.equal(cmd.data[key],value,phrase+' '+key);}
});
test('new aliases do not make ordinary expenses into commands or imply deletion',()=>{
 for(const phrase of ['Кофе полтос','Не удаляй цель отпуск','Жду зарплату 85000','Закинул на мобилу 700'])assert.equal(root.MonoCommands.detect(phrase),null,phrase);
});
test('one spoken sentence can contain financial records and an explicit reminder',()=>{
 for(const join of ['а еще','а ещё','и','и ещё','а также']){
  const chunks=root.MonoCommands.split('Кофе полтос и такси 1,5к '+join+' напомни завтра в 10 оплатить инет');assert.equal(chunks.length,2,join);
  const operations=E.parse(chunks[0],now,[],state,'main');assert.deepEqual(operations.errors,[],join);assert.deepEqual(operations.entries.map(e=>e.amount),[5000,150000],join);const command=root.MonoCommands.detect(chunks[1]);assert.equal(command.kind,'reminder');assert.equal(command.data.time,'10:00');assert.equal(command.data.date,'2026-11-17');
 }
 assert.equal(root.MonoCommands.split('Продукты 1200 и такси 400').length,1);
 assert.equal(root.MonoCommands.split('Лимит на кафе 5к и добавь цель отпуск 100 тысяч').length,2);
});

test('amount aliases do not rewrite reminder titles or names in removal commands',()=>{
 assert.equal(root.MonoCommands.detect('Удали цель Питик').data.name,'питик');
 assert.equal(root.MonoCommands.detect('Напомни завтра забрать заказ Питик').data.title,'Забрать заказ питик');
});
