/* Keep the actual calendar surface intact; only content and neighbouring blocks move. */
(function(){
'use strict';
const states=new WeakMap(),motions=new WeakMap(),captures=new WeakMap(),directions=new WeakMap(),reduce=matchMedia('(prefers-reduced-motion:reduce)');
function stop(el){motions.get(el)?.();motions.delete(el);}
function animate(owner,entries){
 stop(owner);const animations=entries.map(([el,frames,options])=>el.animate(frames,options));let cleaned=false;
 const clean=()=>{if(cleaned)return;cleaned=true;animations.forEach(a=>a.cancel());if(motions.get(owner)===clean)motions.delete(owner);};
 motions.set(owner,clean);Promise.all(animations.map(a=>a.finished.catch(()=>{}))).then(clean);
}
const ease='cubic-bezier(.22,.8,.3,1)';
function snapshot(card){return {siblings:[...card.parentElement.children].filter(el=>el!==card).map(el=>[el,el.getBoundingClientRect().top])};}
function layout(card,panel,shown,before){
 stop(card);if(reduce.matches)return;
 const entries=[];
 if(before){
  for(const [el,top] of before.siblings){if(!el.isConnected)continue;const dy=top-el.getBoundingClientRect().top;if(Math.abs(dy)>1)entries.push([el,[{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:320,easing:ease}]);}
 }
 if(shown)entries.push([panel,[{opacity:0,transform:'translateY(-5px)'},{opacity:1,transform:'none'}],{duration:260,delay:40,easing:ease,fill:'backwards'}]);
 animate(card,entries);
}
function refresh(){
 for(const card of document.querySelectorAll('.payments-agenda')){
  const panel=card.querySelector('.agenda-calendar-inner');if(!panel)continue;
  const shown=card.classList.contains('is-open'),month=panel.querySelector('.agenda-calendar-head strong')?.textContent,selected=panel.querySelector('.agenda-day.selected')?.getAttribute('aria-label'),prev=states.get(card),before=captures.get(card);captures.delete(card);
  states.set(card,{shown,month,selected});
  if(prev&&shown!==prev.shown){layout(card,panel,shown,before);continue;}
  if(!shown)continue;
  if(!prev){layout(card,panel,true,null);continue;}
  if(prev.month!==month){if(!reduce.matches)animate(card,[[panel,[{opacity:0,transform:`translateX(${(directions.get(card)||1)*10}px)`},{opacity:1,transform:'none'}],{duration:300,easing:ease}]]);}
  else if(prev.selected!==selected&&!reduce.matches){const number=panel.querySelector('.agenda-day.selected>span');if(number)animate(card,[[number,[{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}],{duration:260,easing:'ease-out'}]]);}
 }
 const picker=document.querySelector('#periodDialog');if(picker){const shown=picker.hasAttribute('open'),prev=states.get(picker);states.set(picker,{shown});if(shown&&!prev?.shown&&!reduce.matches)animate(picker,[[picker,[{opacity:0,transform:'translateY(-6px) scale(.97)'},{opacity:1,transform:'none'}],{duration:420,easing:ease}]]);if(!shown)stop(picker);}
}
let queued=false;function queue(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh();});}
new MutationObserver(records=>{if(records.some(r=>r.target.closest?.('.payments-agenda,#periodDialog')||[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('.payments-agenda')||n.querySelector('.payments-agenda')))))queue();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open']});
document.addEventListener('click',e=>{
 const card=e.target.closest('.payments-agenda');if(!card)return;
 if(e.target.closest('.agenda-toggle')||!e.target.closest('button,.agenda-calendar-reveal'))captures.set(card,snapshot(card));
 const nav=e.target.closest('[data-rem-month],[data-payment-month]');if(nav)directions.set(card,Number(nav.dataset.remMonth||nav.dataset.paymentMonth));
},{capture:true});
reduce.addEventListener('change',()=>document.querySelectorAll('.payments-agenda,#periodDialog').forEach(stop));document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('.payments-agenda,#periodDialog').forEach(stop);});refresh();
})();
