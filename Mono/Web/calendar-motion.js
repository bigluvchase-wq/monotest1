/* Independent WAAPI adaptation of the supplied calendar references; Mono's dates and layout stay intact. */
(function(){
'use strict';
const states=new WeakMap(),motions=new WeakMap(),directions=new WeakMap(),reduce=matchMedia('(prefers-reduced-motion:reduce)');
function stop(el){(motions.get(el)||[]).forEach(a=>a.cancel());motions.delete(el);}
function play(owner,el,frames,options){const a=el.animate(frames,options),list=motions.get(owner)||[];list.push(a);motions.set(owner,list);a.finished.catch(()=>{});}
function open(owner,panel){
 stop(owner);if(reduce.matches)return;
 play(owner,panel,[{opacity:0,transform:'translateY(-8px) scale(.94)'},{opacity:1,transform:'none'}],{duration:620,easing:'cubic-bezier(.34,1.32,.64,1)',fill:'backwards'});
 panel.querySelectorAll('.agenda-day').forEach((day,i)=>play(owner,day,[{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'none'}],{duration:360,delay:80+i*4.5,easing:'ease-out',fill:'backwards'}));
 panel.querySelectorAll('.agenda-day:has(.agenda-dots b)').forEach((day,i)=>play(owner,day.querySelector('.agenda-dots'),[{opacity:0,transform:'scale(.55)'},{opacity:1,transform:'scale(1.08)'},{opacity:1,transform:'none'}],{duration:540,delay:140+i*35,easing:'ease-out',fill:'backwards'}));
}
function refresh(){
 for(const card of document.querySelectorAll('.payments-agenda')){
  const panel=card.querySelector('.agenda-calendar-inner');if(!panel)continue;
  const shown=card.classList.contains('is-open'),month=panel.querySelector('.agenda-calendar-head strong')?.textContent,selected=panel.querySelector('.agenda-day.selected')?.getAttribute('aria-label'),prev=states.get(card);
  states.set(card,{shown,month,selected});
  if(!shown){stop(card);continue;}
  if(!prev?.shown){open(card,panel);continue;}
  if(prev.month!==month){stop(card);if(!reduce.matches)play(card,panel,[{opacity:0,transform:`translateX(${(directions.get(card)||1)*12}px)`},{opacity:1,transform:'none'}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'});}
  else if(prev.selected!==selected&&!reduce.matches){stop(card);const number=panel.querySelector('.agenda-day.selected>span');if(number)play(card,number,[{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:380,easing:'ease-out'});}
 }
 const picker=document.querySelector('#periodDialog');if(picker){const shown=picker.hasAttribute('open'),prev=states.get(picker);states.set(picker,{shown});if(shown&&!prev?.shown)open(picker,picker);if(!shown)stop(picker);}
}
let queued=false;function queue(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh();});}
new MutationObserver(records=>{if(records.some(r=>r.target.closest?.('.payments-agenda,#periodDialog')||[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('.payments-agenda')||n.querySelector('.payments-agenda')))))queue();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open']});
document.addEventListener('click',e=>{const nav=e.target.closest('[data-rem-month],[data-payment-month]');if(nav)directions.set(nav.closest('.payments-agenda'),Number(nav.dataset.remMonth||nav.dataset.paymentMonth));},{capture:true});
reduce.addEventListener('change',()=>document.querySelectorAll('.payments-agenda,#periodDialog').forEach(stop));refresh();
})();
