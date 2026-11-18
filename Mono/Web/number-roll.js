(function(root){
'use strict';
// Суммы мягко «перекатываются» при изменении: старое значение уходит вверх, новое приходит снизу.
// Срабатывает только когда сумма на том же месте действительно поменялась.
const SELECTOR='.operations-total,.account-balance,.operation-card strong';
const seen=new Map();
function key(el,i){return (document.body.dataset.page||'')+'|'+el.className+'|'+i;}
function roll(el){
 if(reducedMotion())return;
 el.animate([{transform:'translateY(.45em)',opacity:0},{transform:'none',opacity:1}],{duration:420,easing:'cubic-bezier(.32,.72,0,1)'});
}
function scan(){
 const els=[...document.querySelectorAll(SELECTOR)].filter(el=>!el.closest('.root-preview,.nav-ghost'));
 els.forEach((el,i)=>{const k=key(el,i),text=el.textContent.trim(),old=seen.get(k);if(old!==undefined&&old!==text)roll(el);seen.set(k,text);});
}
let frame=0;
new MutationObserver(()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;scan();});}).observe(document.querySelector('.app'),{childList:true,subtree:true,characterData:true});
scan();
})(window);
