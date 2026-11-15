'use strict';
const corpus=require('./voice-examples.json');
const entryFields=['title','type','amount','account','date','category','goalId','toAccount','toAmount','installmentTotal'];
const commandFields=['name','title','text','date','time','repeat','currency','amount','target','initial','category','principal','rate','term','payout','removeTarget','last'];
const day=(today,offset=0)=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
function materialize(example,context){
 if(!example.expected||example.split==='review')return null;
 const accountId=alias=>{
  if(!alias||alias==='default')return context.account;
  return context.accounts.find(a=>a.id===alias)?.id;
 };
 const entries=[];
 for(const item of example.expected.entries){
  const e=Object.fromEntries(entryFields.map(k=>[k,null]));
  Object.assign(e,item);delete e.dateOffset;
  e.title=item.title||item.category||(item.type==='saving'?'На отпуск':'Между своими');
  e.account=accountId(item.account);e.date=day(context.today,item.dateOffset);
  if((!item.account||item.account==='default')&&context.accounts.find(a=>a.id===e.account)?.currency!=='RUB')return null;
  if(!e.account)return null;
  if(item.toAccount){e.toAccount=accountId(item.toAccount);if(!e.toAccount)return null;}
  if(item.goalId){const goal=context.goals.find(g=>g.id===item.goalId)||context.goals.find(g=>/отпуск/iu.test(g.name));if(!goal||goal.currency!==context.accounts.find(a=>a.id===e.account)?.currency)return null;e.goalId=goal.id;}
  if(item.category&&!(item.type==='income'?context.incomeCategories:context.categories).includes(item.category))return null;
  entries.push(e);
 }
 const commands=[];
 for(const item of example.expected.commands){
  const data=Object.fromEntries(commandFields.map(k=>[k,null]));Object.assign(data,item.data);
  delete data.dateOffset;delete data.afterMinutes;
  if(item.data.dateOffset!==undefined)data.date=day(context.today,item.data.dateOffset);
  if(item.data.afterMinutes!==undefined){const date=new Date(context.today+'T'+context.time+':00Z');date.setUTCMinutes(date.getUTCMinutes()+item.data.afterMinutes);data.date=date.toISOString().slice(0,10);data.time=date.toISOString().slice(11,16);}
  if(data.category&&!context.categories.includes(data.category))return null;
  if(data.currency&&data.currency!==context.accounts.find(a=>a.id===context.account)?.currency)return null;
  commands.push({kind:item.kind,data});
 }
 return {entries,commands,errors:example.expected.errors.slice()};
}
const tagRules={loan:/долг|одолж|занял|займ|заем/u,dates:/вчера|сегодня|завтра|утром|вечером/u,slang:/питик|пятихат|косар|тыщ|сотк|полтор/u,reminder:/напомни/u,goal:/цель|копил|отлож|накоп/u,account:/счет|налич|карт/u,limit:/лимит|бюджет/u,payment:/платеж|аренд/u,deposit:/вклад|депозит/u,remove:/удал|убери/u,quantity:/\d+.*\sпо\s+\d+/u,negative:/\sне\s|не покуп/u,income:/зарплат|получил|аванс|продал|вернул|кешбэк/u};
const normalize=text=>text.toLowerCase().replace(/ё/g,'е');
const tags=text=>new Set(Object.entries(tagRules).filter(([,re])=>re.test(normalize(text))).map(([tag])=>tag));
function select(payload,{limit=3,budget=6000}={}){
 const wanted=tags(payload.text),covered=new Set(),selected=[];let used=0;
 const words=new Set(normalize(payload.text).split(/[^\p{L}\d]+/u).filter(w=>w.length>3));
 let candidates=corpus.examples.filter(e=>e.split==='prompt').flatMap(example=>{
  const response=materialize(example,payload.context);if(!response)return [];
  const features=tags(example.text),shared=[...features].filter(tag=>wanted.has(tag));
  const overlap=normalize(example.text).split(/[^\p{L}\d]+/u).filter(w=>words.has(w)).length;
  return [{id:example.id,text:example.text,response,shared,overlap}];
 });
 while(selected.length<limit&&candidates.length){
  candidates.sort((a,b)=>(b.shared.filter(t=>!covered.has(t)).length*4+b.shared.length+b.overlap)-(a.shared.filter(t=>!covered.has(t)).length*4+a.shared.length+a.overlap));
  const item=candidates.shift();if(!item.shared.length&&!item.overlap)continue;
  const size=JSON.stringify({phrase:item.text,response:item.response}).length;if(used+size>budget)continue;
  used+=size;selected.push(item);item.shared.forEach(tag=>covered.add(tag));
 }
 return selected;
}
function prompt(payload){
 const examples=select(payload);if(!examples.length)return '';
 return '\nПРИМЕРЫ ФОРМАТА И ПРАВИЛ МОНО. Это образцы, а не операции пользователя. Не копируй их суммы, имена или действия в ответ. Разбирай только текущую фразу. Не используй 0 или пустую строку вместо null в необязательных полях. Пустые entries/commands/errors — массивы [], а не null. Примеры используют дату и справочники текущего контекста:\n'+JSON.stringify(examples.map(e=>({phrase:e.text,response:e.response})));
}
function benchmarkContext(){
 const expense=new Set(['Другое']),income=new Set(['Другое']);
 for(const example of corpus.examples)for(const e of example.expected?.entries||[])if(e.category)(e.type==='income'?income:expense).add(e.category);
 for(const example of corpus.examples)for(const cmd of example.expected?.commands||[])if(cmd.data.category)expense.add(cmd.data.category);
 return {...corpus.anchor,account:'main',accounts:[{id:'main',name:'Карта',currency:'RUB'},{id:'cash',name:'Наличные',currency:'RUB'},{id:'usd',name:'Доллары',currency:'USD'}],goals:[{id:'holiday',name:'Отпуск',currency:'RUB'}],categories:[...expense],incomeCategories:[...income]};
}
module.exports={corpus,materialize,select,prompt,benchmarkContext};
