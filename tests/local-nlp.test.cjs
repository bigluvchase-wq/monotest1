const {test}=require('node:test'),assert=require('node:assert/strict'),N=require('../Mono/Web/local-nlp'),E=require('../Mono/Web/engine');
const now=new Date(2026,10,19,12);
test('inflections and bounded fuzzy names prefer exact and reject ties',()=>{
 assert.equal(N.stem('зарплату'),N.stem('зарплата'));assert.equal(N.match('тинькоф',['Тинькофф']).name,'Тинькофф');assert.equal(N.match('отпуст',['Отпуск']).name,'Отпуск');
 assert.equal(N.match('отпуст',['Отпуск','Отпуст']).name,'Отпуст');assert.equal(N.match('касса',['Масса','Каска']).ambiguous,true);assert.equal(N.match('дом',['Том']),null);
});
test('entity corrections reach financial parsing without changing merchant prose',()=>{
 const s=E.initialState();s.goals.push({id:'holiday',name:'Отпуск',currency:'RUB',target:100000});s.accounts.push({id:'t',name:'Тинькофф',currency:'RUB',initial:0});
 const goal=E.parse('отложил 500 на отпуст',now,[],s,'main');assert.deepEqual(goal.errors,[]);assert.equal(goal.entries[0].goalId,'holiday');
 const account=E.parse('кофе 300 со счета тинькоф',now,[],s,'main');assert.deepEqual(account.errors,[]);assert.equal(account.entries[0].account,'t');
 assert.equal(N.entities('купил отпуск 500',s).text,'купил отпуск 500');
 s.categories.push('Обучение');const category=E.parse('курс 500 категория обученее',now,[],s,'main');assert.deepEqual(category.errors,[]);assert.equal(category.entries[0].category,'Обучение');
 s.goals.push({id:'other',name:'Отпуст',currency:'RUB',target:100000});assert(N.entities('на отпусп 500',s).ambiguous);
});
test('intent scores retain explicit expense priority and do not invent reminders from time',()=>{
 assert.equal(N.classify('заплатил сотруднику зарплату 20000',{amount:true}).intent,'expense');assert.equal(N.classify('пришло 5000 за консультацию',{amount:true}).intent,'income');assert.equal(N.classify('завтра в 18:00').intent,null);assert.equal(N.classify('напомни завтра в 18:00 купить корм').intent,'reminder');assert.equal(N.classify('на отпуск 500',{amount:true,goal:true}).intent,'saving');
 const s=E.initialState();assert.equal(E.parse('пришло 5000 за консультацию',now,[],s,'main').entries[0].type,'income');assert.equal(E.parse('завтра получу зарплату 5000',now,[],s,'main').entries.length,0);
});
test('conversation joins and normalized amounts preserve each monetary record',()=>{
 const s=E.initialState();for(const join of [' и ',' потом ',' плюс ',' также ', ', ']){const r=E.parse('такси 500'+join+'кофе 300',now,[],s,'main');assert.deepEqual(r.errors,[],join);assert.deepEqual(r.entries.map(e=>e.amount),[50000,30000],join);}
 for(const [words,value] of [['полторы тысячи',150000],['2к',200000],['триста пятьдесят',35000]])assert.equal(E.parse('продукты '+words,now,[],s,'main').entries[0].amount,value);
});

test('half-thousand speech and joint purchase names retain one amount',()=>{
 const s=E.initialState();for(const words of ['два с половиной к','2 с половиной к']){const r=E.parse('кофе '+words,now,[],s,'main');assert.deepEqual(r.errors,[]);assert.equal(r.entries[0].amount,250000);}
 const food=E.parse('хлеб и молоко 300',now,[],s,'main');assert.deepEqual(food.errors,[]);assert.equal(food.entries.length,1);assert.equal(food.entries[0].amount,30000);
});

test('manual categories persist independently of history and newer choices replace earlier ones',()=>{
 const B=require('../Mono/Web/bank-merchants'),s=E.initialState();
 const first=E.parse('ромашка 2000',now,[],s,'main').entries[0];assert.equal(first.category,'Другое');
 first.category='Красота';first.categoryChosen=true;B.remember(s,first);
 const restored=JSON.parse(JSON.stringify(s));restored.entries=[];
 assert.equal(E.parse('ромашка 3500',now,[],restored,'main').entries[0].category,'Красота');
 const changed=E.parse('ромашка 1500 категория здоровье',now,[],restored,'main').entries[0];assert.equal(changed.category,'Здоровье');B.remember(restored,changed);
 assert.equal(E.parse('ромашка 500',now,[],restored,'main').entries[0].category,'Здоровье');
 assert.equal(restored.settings.bankMerchantRules.length,1);
});
