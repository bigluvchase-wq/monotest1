(function(){
'use strict';
// Поля с суммами, процентами и сроками открывают цифровую клавиатуру (без букв).
function fix(input){
 if(!(input instanceof HTMLInputElement)||input.type!=='number'||input.hasAttribute('inputmode'))return;
 const step=input.getAttribute('step');
 input.setAttribute('inputmode',step==='1'||step==='1.0'?'numeric':'decimal');
 if(!input.hasAttribute('enterkeyhint'))input.setAttribute('enterkeyhint','done');
}
function scan(root){if(root.nodeType!==1)return;if(root.matches?.('input'))fix(root);root.querySelectorAll?.('input[type=number]').forEach(fix);}
new MutationObserver(list=>{for(const m of list)m.addedNodes.forEach(scan);}).observe(document.documentElement,{childList:true,subtree:true});
scan(document.documentElement);
document.addEventListener('focusin',e=>fix(e.target),true);
})();
