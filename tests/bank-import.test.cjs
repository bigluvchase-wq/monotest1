const test=require('node:test'),assert=require('node:assert');
global.MonoSpeechCategories=require('../Mono/Web/speech-categories.js');
const B=require('../Mono/Web/bank-import.js');
const today=new Date(2026,10,12);

test('выписка в стиле Т-Банка: знак суммы, статус, категория банка',()=>{
 const csv='"Дата операции";"Дата платежа";"Номер карты";"Статус";"Сумма операции";"Валюта операции";"Сумма платежа";"Валюта платежа";"Кэшбэк";"Категория";"MCC";"Описание"\n'+
 '"10.11.2026 14:03:11";"10.11.2026";"*1234";"OK";"-1 250,50";"RUB";"-1 250,50";"RUB";"";"Супермаркеты";"5411";"Пятёрочка"\n'+
 '"09.11.2026 10:00:00";"09.11.2026";"*1234";"OK";"60000,00";"RUB";"60000,00";"RUB";"";"Пополнения";"";"Зарплата ООО Ромашка"\n'+
 '"08.11.2026 10:00:00";"08.11.2026";"*1234";"FAILED";"-500,00";"RUB";"-500,00";"RUB";"";"Фастфуд";"";"KFC"\n'+
 '"01.06.2026 10:00:00";"01.06.2026";"*1234";"OK";"-300,00";"RUB";"-300,00";"RUB";"";"Фастфуд";"";"KFC"';
 const items=B.tableToItems(B.parseCSV(csv));
 assert.equal(items.length,3);
 assert.deepEqual(items[0],{date:'2026-11-10',amount:125050,type:'expense',title:'Пятёрочка',bankCat:'Супермаркеты'});
 assert.equal(items[1].type,'income');assert.equal(items[1].amount,6000000);
 const cats=['Кафе','Продукты','Транспорт','Другое'],inc=['Зарплата','Другое'];
 assert.equal(B.categorize(items[0],cats),'Продукты');
 assert.equal(B.categorize(items[1],inc),'Зарплата');
 const p=B.plan(items,[{account:'a',type:'expense',date:'2026-11-10',amount:125050}],'a',today);
 assert.equal(p.fresh.length,1);assert.equal(p.dup,1);assert.equal(p.old,1);
});

test('столбцы «Приход/Расход», запятая-разделитель, дата ISO',()=>{
 const csv='Выписка по счёту\nДата,Описание,Приход,Расход\n2026-11-01,Перевод от Ивана,"1 000,00",\n2026-11-02,Яндекс Такси,,"350,00"';
 const items=B.tableToItems(B.parseCSV(csv));
 assert.deepEqual(items.map(i=>[i.date,i.type,i.amount]),[['2026-11-01','income',100000],['2026-11-02','expense',35000]]);
 assert.equal(B.categorize(items[1],['Кафе','Транспорт','Другое']),'Транспорт');
});

test('нет нужных столбцов — понятная ошибка',()=>{
 assert.throws(()=>B.tableToItems(B.parseCSV('a;b\n1;2')),/столбцы с датой и суммой/);
});
