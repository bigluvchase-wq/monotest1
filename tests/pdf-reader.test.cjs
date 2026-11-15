const {test}=require('node:test'),assert=require('node:assert/strict'),{table}=require('../Mono/Web/pdf-reader');
const cell=(str,x,y,width=40)=>({str,transform:[1,0,0,1,x,y],width});
test('PDF columns follow header coordinates and select card amount, not transaction currency',()=>{
 const items=[cell('Дата и время',20,700),cell('Дата',100,700),cell('Сумма операции',190,700),cell('в валюте карты',300,685),cell('Описание',430,700),cell('Номер',580,700),cell('15.11.2026',20,650),cell('16.11.2026',100,650),cell('-10.00 $',190,650),cell('-900.00 ₽',300,650),cell('Магазин',430,650),cell('1234',580,650),cell('14.11.2026',20,620),cell('+500.00 ₽',300,620),cell('Поступление',430,620)];
 assert.deepEqual(table(items),[{date:'15.11.2026',amount:'-900.00 ₽',title:'Магазин'},{date:'14.11.2026',amount:'+500.00 ₽',title:'Поступление'}]);
});
test('unknown PDF layouts do not masquerade as supported bank tables',()=>{assert.equal(table([cell('Общая сумма',20,700)]),null);});
