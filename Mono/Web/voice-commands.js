(function(root){
 'use strict';
 const E=typeof module==='object'?require('./engine.js'):root.MonoEngine;
 const Dates=typeof module==='object'?require('./speech-dates.js'):root.MonoSpeechDates;
 const P=typeof module==='object'?require('./period.js'):root.MonoPeriod;
 const Speech=typeof module==='object'?require('./speech-categories.js'):root.MonoSpeechCategories;
 const normalize=s=>s.toLowerCase().replace(/ё/g,'е').trim().replace(/[.!?]+$/,'');
 const currencies=[['BYN','белорусск[а-я]* рубл[а-я]*|byn'],['USD','доллар[а-я]*|usd'],['EUR','евро|eur'],['KZT','тенге|kzt'],['RUB','рубл[а-я]*|руб|rub'],['GBP','фунт[а-я]*|gbp'],['CNY','юан[а-яь]*|cny']];
 const wordCurrency=new RegExp('(?<!\\p{L})(?:'+currencies.map(([,pattern])=>pattern).join('|')+')(?!\\p{L})|[₽€$]','u');
 const numWords={один:1,одну:1,одна:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,полтора:1.5,полторы:1.5,полчаса:.5};
 const amountFields=text=>{
  const phrase=E.slang(text),found=E.spokenAmount(phrase);
  const unit=phrase.match(wordCurrency)?.[0],currency=unit&&({'₽':'RUB','€':'EUR','$':'USD'}[unit]||currencies.find(([,pattern])=>new RegExp('^(?:'+pattern+')$','u').test(unit))?.[0]);
  const name=(found?phrase.slice(0,found.index)+' '+phrase.slice(found.index+found.text.length):phrase).replace(wordCurrency,' ');
  return {amount:found?.amount,currency,name};
 };
 function title(text){
  const value=text.replace(/[«»",]/g,' ').replace(/(?:^|\s)(?:стоимостью|под названием|с названием|назови (?:его|ее)|названием|на сумму)(?=\s|$)/gu,' ')
   .trim().replace(/^(?:(?:на|в|для|накопить)\s+)+/u,'').replace(/\s+(?:на|в|до|за|по)$/u,'').trim().replace(/\s+/g,' ');
  if(!value||/^(?:на|в|для|до|за|по)$/u.test(value))return '';
  const labels={машину:'машина',квартиру:'квартира',путешествий:'путешествия',поездок:'поездки',накоплений:'накопления',налички:'наличные',зарплаты:'зарплата'};
  const name=labels[value]||value;
  return name[0].toUpperCase()+name.slice(1);
 }
 function reminder(text,now){
  let rest=text.replace(/^напомни(?:те)?(?: мне)?\s*/u,'').trim(),date=E.dateString(now),time='00:00',dateSpecified=false;
  const relative=rest.match(/(?<!\p{L})через\s+(полчаса|\d+(?:[.,]\d+)?|один|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|полтора|полторы)(?:\s+(час[а-я]*|минут[а-я]*|день|дн[яей]+|сут[а-я]*|недел[а-я]*))?(?!\p{L})/u);
  const at=rest.match(/(?<!\p{L})в\s+(\d{1,2})(?:[:.](\d{2})|\s+час(?:а|ов)?(?!\p{L}))?(?![\d.:])(?:\b|$)(?!\s+(?:раз|минут|дн|недел))/u);
  if(relative&&(relative[2]||relative[1]==='полчаса')){
   const [,value,unit='час']=relative,n=numWords[value]??Number(value.replace(',','.'));
   const shifted=new Date(now);
   if(/^(?:день|дн|сут|недел)/u.test(unit)){shifted.setDate(shifted.getDate()+Math.ceil(n*(unit.startsWith('недел')?7:1)));}
   else{shifted.setTime(shifted.getTime()+Math.ceil(n*(unit.startsWith('минут')?1:60))*60000);time=shifted.toTimeString().slice(0,5);}
   date=E.dateString(shifted);dateSpecified=true;rest=rest.replace(relative[0],' ');
  }else{
   const marker=rest.match(/(?<!\p{L})(послезавтра|завтра|сегодня)(?!\p{L})/u);
   const absolute=rest.match(/(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)|(?<!\d)\d{1,2}[./]\d{1,2}[./]\d{2,4}(?!\d)|\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+\d{4})?/u);
   if(marker){dateSpecified=true;date=P.dateAfter(date,{сегодня:0,завтра:1,послезавтра:2}[marker[0]]);rest=rest.replace(marker[0],' ');}
   else if(absolute){
    try{let value=absolute[0];if(!P.validDate(value)){
     value=E.dateString(Dates.past(now,value));
     if(value<date&&/\p{L}/u.test(absolute[0])&&!/\d{4}/.test(absolute[0]))value=String(Number(date.slice(0,4))+(value.slice(5)<date.slice(5)?1:0))+value.slice(4);
    }
    if(P.validDate(value)){date=value;dateSpecified=true;rest=rest.replace(absolute[0],' ');}
    }catch{}
   }
  }
  if(at&&Number(at[1])<24&&Number(at[2]||0)<60){time=at[1].padStart(2,'0')+':'+(at[2]||'00');rest=rest.replace(at[0],' ');}
  if(!dateSpecified&&new Date(date+'T'+time)<=now)date=P.dateAfter(date,1);
  return {kind:'reminders',action:'create',name:title(rest),date,time};
 }
 function category(text,categories){
  const canonical=categories.find(c=>normalize(c)===text.trim());
  const aliases=[
   [/перекус|кофе|доставк[а-я]* ед/u,'Кафе'],[/электроник|бытов[а-я]* товар|детей/u,'Покупки'],
   [/врач|стоматолог/u,'Здоровье'],[/бар[ыау]|хобби/u,'Развлечения'],[/магазин|супермаркет/u,'Продукты'],
   [/онлайн[ -]сервис/u,'Подписки'],[/благотворитель/u,'Подарки'],[/домашн[а-я]* животн/u,'Питомцы'],
   [/путешеств/u,'Путешествия'],[/сплит|ипотек|рассроч|кредит/u,'Финансовые операции']
  ];
  const special=aliases.find(([re])=>re.test(text))?.[1];
  return [canonical,special,Speech.expense(text),E.parse(text+' 1',new Date(),[],E.initialState()).entries[0]?.category].find(c=>c&&c!=='Другое'&&categories.includes(c))||(/проч|друг/u.test(text)?'Другое':'');
 }
 function parse(value,state,now=new Date()){
  const text=normalize(value);
  if(/^напомни(?:те)?(?:\s|$)/u.test(text)){
   const result=reminder(text,now);
   const source=value.trim();
   if(result.name){
    const rawWords=source.match(/[\p{L}\d]+/gu)||[];
    let cursor=0;
    result.name=result.name.replace(/[\p{L}\d]+/gu,word=>{
     const i=rawWords.findIndex((part,index)=>index>=cursor&&normalize(part)===normalize(word));
     if(i<0)return word;
     cursor=i+1;return cursor===1?word:rawWords[i];
    });
    result.name=result.name[0].toUpperCase()+result.name.slice(1);
   }
   return result;
  }
  const lead=text.match(/^напоминай(?: мне)? за (\d+|[а-я]+) д(?:ень|ня|ней) до платежа(?: (.+))?$/u);
  if(lead)return {kind:'payments',action:'lead',subject:lead[2]||'',remindDays:numWords[lead[1]]??Number(lead[1])};
  if(/^хочу тратить(?:\s|$)/u.test(text))return {action:'clarify'};
  const direct=text.match(/^(?:открой|покажи)[,\s]+(?:(?:все|мои|какие)\s+)*(счет[а-я]*|цел[а-я]*|накоплен[а-я]*|лимит[а-я]*|(?:обязательн[а-я]*\s+)?платеж[а-я]*|операци[а-я]*|настройк[а-я]*|напоминани[а-я]*|вклад[а-я]*)/u);
  const kindOf=word=>/^счет/u.test(word)?'accounts':/^(?:цел|накоплен)/u.test(word)?'goals':/^лимит/u.test(word)?'limits':/платеж/u.test(word)?'payments':/^операци/u.test(word)?'history':/^настрой/u.test(word)?'settings':/^напомин/u.test(word)?'reminders':'deposits';
  if(direct)return {action:'open',kind:kindOf(direct[1])};
  const edit=text.match(/^(переименуй|измени|увеличь|удали|отключи|перенеси)\s+/u);
  let kind,action=edit?/^(удали|отключи)/u.test(edit[1])?'remove':'edit':'create',subject=text;
  if(edit){
   const entity=text.match(/(?<!\p{L})(счет[а-я]*|цел[а-я]*|лимит[а-я]*|платеж[а-я]*|уведомлени[а-я]*)(?!\p{L})/u);
   if(!entity)return null;
   kind=entity[1].startsWith('уведомлен')?'payments':kindOf(entity[1]);
   subject=text.slice(entity.index+entity[0].length);
   if(/уведомлен/u.test(entity[1]))action='mute';
  }else if((/^не хочу тратить(?:\s|$)/u.test(text)||/^(?:установи|поставь|создай|сделай|добавь|ограничь|хочу ограничить).*?(?:лимит|бюджет|огранич|расход|траты|больше|покупки)/u.test(text))&&!/^(?:создай|добавь).*?(?:счет|цел|платеж)/u.test(text)){
   kind='limits';
   subject=text.replace(/^.*?(?:лимит[а-я]*|бюджет[а-я]*|ограничени[а-я]*|расход[а-я]*|траты|тратить|покупки)\s*/u,'').replace(/\s+в месяц$/u,'');
  }else if(/^(?:добавь|создай|открой|хочу открыть|хочу создать|мне нужен|мне нужно добавить|давай заведем|сделай|хочу разделить).*?(?:счет|карточк|кошелек)/u.test(text)){
   kind='accounts';subject=text.replace(/^.*?(?:счет[а-я]*|карточк[а-я]*|кошелек)(?!\p{L})/u,'');
  }else if(/^(?:добавь|создай|поставь|хочу|мне нужна|давай|заведи|начни).*?(?:цел[ьяи]|копилк|накоплен|накопить|копить|откладывать|собрать)/u.test(text)){
   kind='goals';subject=text.replace(/^.*?(?:цел[ьяи]|копилк[а-я]*|накоплен[а-я]*|накопить|копить|откладывать|собрать)(?!\p{L})/u,'');
  }else if(/^(?:добавь|создай|запиши|сделай|напоминай|мне нужно каждый|хочу отслеживать|не забудь).*?(?:платеж|платить за|оплату|рассрочк|коммуналк|подписк|постоянные расходы|отдавать за)/u.test(text)){
   kind='payments';subject=text.replace(/^(?:добавь|создай|запиши|сделай|напоминай мне|мне нужно|хочу отслеживать|не забудь про)\s*/u,'')
    .replace(/^(?:(?:в )?обязательн[а-я]*|ежемесячн[а-я]*|регулярн[а-я]*|постоянн[а-я]*)\s+/u,'')
    .replace(/^(?:платеж[а-я]*|платить|оплату|постоянные расходы|оплата)\s*/u,'');
  }else return null;
  const repeat=/кажд[а-я]* месяц|ежемесяч/u.test(text)?'monthly':/кажд[а-я]* две недели/u.test(text)?'fortnightly':/кажд[а-я]* неделю/u.test(text)?'weekly':/кажд[а-я]* день/u.test(text)?'daily':/один раз/u.test(text)?'once':undefined;
  const fields=amountFields(subject.replace(/\s+больше(?=\s|$)/gu,' ').replace(/(?:кажд[а-я]* (?:месяц|две недели|неделю|день)|один раз|отдавать)/gu,' '));
  const bulk=kind==='limits'&&/(?:все[хм]?|кажд[а-я]*) категори|для всех|все лимиты/u.test(text);
  const cat=kind==='limits'||kind==='payments'?category(title(fields.name).toLowerCase(),state.categories):undefined;
  const name=title(fields.name.replace(/(?:^|\s)месячн[а-я]* зарплат[а-я]*(?:$|\s)/u,' ').replace(/^за\s+/u,'').replace(/^до\s+/u,''));
  const ambiguous=kind==='goals'&&/месячн[а-я]* зарплат/u.test(text);
  return {kind,action,name,category:cat,amount:ambiguous?undefined:fields.amount,currency:fields.currency,repeat,bulk,subject:subject.trim(),phrase:text};
 }
 const api={parse};root.MonoVoiceCommands=api;
 if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
