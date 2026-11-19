(function(root){
'use strict';
const normalize=s=>String(s).toLowerCase().replace(/ё/g,'е');
// Conservative Russian inflection reduction; short words and negations are never corrected.
function stem(s){const word=normalize(s),base=word.replace(/(?:иями|ями|ами|ого|ему|ому|ыми|ими|ая|яя|ую|юю|ое|ее|ий|ый|ой|ов|ев|ам|ям|ах|ях|ом|ем|ы|и|а|я|у|ю|е)$/u,'');return base.length>=3?base:word;}
function distance(a,b){if(Math.abs(a.length-b.length)>2)return 3;let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+Number(a[i]!==b[j])));row=next;}return row[b.length];}
function match(query,names){
 const q=normalize(query),exact=names.filter(n=>normalize(n)===q);if(exact.length)return {name:exact[0],distance:0};
 const ranked=names.map(name=>{const n=normalize(name);return {name,distance:stem(n)===stem(q)?0:distance(q,n)};}).filter(x=>x.distance<=(q.length>=8?2:q.length>=5?1:0)).sort((a,b)=>a.distance-b.distance);
 if(!ranked.length)return null;if(ranked[1]?.distance===ranked[0].distance)return {ambiguous:true};return ranked[0];
}
function entities(text,state){
 let ambiguous=false;
 // Corrections are restricted to explicitly named entities, never arbitrary speech.
 const correct=(lead,names)=>{text=text.replace(lead,(whole,prefix,word)=>{const hit=match(word,names.filter(n=>!n.includes(' ')));if(hit?.ambiguous){ambiguous=true;return whole;}return hit?prefix+hit.name:whole;});};
 correct(/((?:на|в)\s+(?:цель\s+)?)([а-яёa-z-]+)/giu,(state.goals||[]).map(g=>g.name));
 correct(/((?:со?\s+сч[её]та?\s+|на\s+сч[её]т\s+))([а-яёa-z-]+)/giu,(state.accounts||[]).map(a=>a.name));
 correct(/(категори[яию]\s+)([а-яёa-z-]+)/giu,[...(state.categories||[]),...(state.incomeCategories||[])]);
 return {text,ambiguous};
}
function classify(text,{amount=false,goal=false,income=false,expense=false}={}){
 const t=normalize(text),scores={reminder:0,saving:0,income:0,expense:amount?1:0};
 const blocked=/(?:^|\s)не\s+(?:купил|платил|напомни|отложил|получил)|(?:завтра|планирую|хочу|нужно)\s+(?:куплю|купить|получу|получить|отложить)/u.test(t);
 const reminder=/(?:^|\s)(?:напомни|напоминай|не забудь|не забыть)(?:\s|$)/u.test(t);
 if(reminder)scores.reminder+=5;if(reminder&&/завтра|через|\d[:.]\d|утром|вечером/u.test(t))scores.reminder+=3;
 if(goal)scores.saving+=6;if(/отложил|копилк|накоплен/u.test(t))scores.saving+=4;
 if(income||/(?:^|\s)(?:пришло|поступило|получил[аи]?|зарплат[а-я]*)(?:\s|$)/u.test(t))scores.income+=5;if(expense||/купил|потратил|заплатил/u.test(t))scores.expense+=3;
 if(/(?:^|\s)(?:купил[аи]?|потратил[аи]?|заплатил[аи]?|оплатил[аи]?)(?:\s|$)/u.test(t)&&!income)scores.expense+=5;
 const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);return {scores,intent:blocked||ranked[0][1]===0||ranked[0][1]===ranked[1][1]?null:ranked[0][0],blocked};
}
const api={stem,distance,match,entities,classify};root.MonoLocalNLP=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
