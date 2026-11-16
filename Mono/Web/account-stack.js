/* Wallet ordering is presentation only. Never changes account balances or the recording account. */
(function(root){
'use strict';
const selections=new Map(),controllers=new Map(),reduce=matchMedia('(prefers-reduced-motion: reduce)');
const duration=280,easing='cubic-bezier(.22,1,.36,1)';
function scope(){return root.MonoTogether?.storageKey()||'personal';}
function stop(controller){for(const animation of controller.animations)animation.cancel();controller.animations=[];}
function layout(controller,animate=false){
 const {stack,items}=controller;if(!stack.isConnected)return;
 const chosen=items.find(item=>item.id===controller.selected)||items[0];if(!chosen)return;
 controller.selected=chosen.id;
 // Read all current visual positions before cancelling an interrupted motion or writing layout.
 const starts=items.map(item=>getComputedStyle(item.shell).transform);
 stop(controller);
 const heights=items.map(item=>item.shell.offsetHeight);
 const step=Math.max(...items.map(item=>item.card.querySelector('.category-head').offsetTop+item.card.querySelector('.category-head').offsetHeight+8));
 const order=items.filter(item=>item!==chosen).concat(chosen),targets=new Map();
 order.forEach((item,index)=>targets.set(item,{y:index*step,scale:1-Math.min(order.length-1-index,3)*.012}));
 // A common stable height prevents the section below jumping between different account names.
 stack.style.height=((items.length-1)*step+Math.max(...heights))+'px';
 stack.classList.add('is-stacked');
 items.forEach((item,index)=>{
  const front=item===chosen,target=targets.get(item),transform=`translateY(${target.y}px) scale(${target.scale})`;
  item.shell.dataset.stackFront=String(front);item.shell.style.zIndex=String(order.indexOf(item)+1);item.shell.style.transform=transform;
  item.card.querySelector('[data-account-select]').setAttribute('aria-pressed',String(front));
  for(const control of item.card.querySelectorAll('[data-edit-account],.entity-x'))control.inert=!front;
  const balance=item.card.querySelector('.account-balance');balance.setAttribute('aria-hidden',String(!front));
  item.card.querySelector('.account-stack-amount').setAttribute('aria-hidden',String(front));
  if(!animate||typeof item.shell.animate!=='function')return;
  const frames=reduce.matches?[{opacity:.65},{opacity:1}]:front?
   [{transform:starts[index]},{transform:`translate(12px,${target.y-12}px) scale(1)`,offset:.65},{transform}]:
   [{transform:starts[index]},{transform}];
  controller.animations.push(item.shell.animate(frames,{duration:reduce.matches?120:duration,easing}));
 });
 const animations=controller.animations;
 Promise.allSettled(animations.map(a=>a.finished)).then(()=>{if(controller.animations===animations)stop(controller);});
}
function decorate(){
 for(const [stack,controller] of controllers){if(!stack.isConnected){stop(controller);controller.observer?.disconnect();controllers.delete(stack);}}
 document.querySelectorAll('#pageBody [data-account-stack]').forEach(stack=>{
  if(controllers.has(stack))return;
  const items=[...stack.querySelectorAll('[data-stack-card]')].map(card=>({id:card.dataset.stackCard,card,shell:card.closest('.swipe-shell')}));
  if(!items.length||items.some(item=>!item.shell))return;
  const key=scope()+'|'+stack.dataset.accountStack,selected=selections.get(key)||items[0].id;
  const controller={stack,items,key,selected,animations:[],observer:null};controllers.set(stack,controller);layout(controller);
  if(root.ResizeObserver){let width=stack.clientWidth;controller.observer=new ResizeObserver(()=>{const next=stack.clientWidth;if(Math.abs(next-width)<.5)return;width=next;layout(controller);});controller.observer.observe(stack);}
 });
}
document.addEventListener('click',event=>{
 const rear=event.target.closest('.account-stack>[data-stack-front=false]');
 const button=event.target.closest('[data-account-select]')||rear?.querySelector('[data-account-select]');if(!button)return;
 const controller=controllers.get(button.closest('[data-account-stack]'));if(!controller||controller.selected===button.dataset.accountSelect)return;
 root.MonoSwipe?.close();controller.selected=button.dataset.accountSelect;selections.set(controller.key,controller.selected);
 // Keyboard selection is immediate; touch/mouse preserves the spatial movement.
 layout(controller,event.detail!==0);
});
reduce.addEventListener('change',()=>{for(const controller of controllers.values())layout(controller);});
addEventListener('pagehide',()=>{for(const controller of controllers.values())stop(controller);});
root.MonoAccountStack={decorate};decorate();
})(window);
