(function(root){
'use strict';
const source=document.querySelector('#voiceAccount'),button=document.querySelector('#homeAccountButton'),dialog=document.querySelector('#homeAccountDialog'),options=document.querySelector('#homeAccountOptions');
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),ease='cubic-bezier(.22,1,.36,1)',exitEase='cubic-bezier(.77,0,.175,1)';
let animation=null,closing=false,pending=false,backdropStart=null,drag=null,suppressUntil=0;
const wallet='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18M15 14h3"/></svg>';
const users='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></svg>';
function summaries(){return root.MonoTogether?.pickerGroups()||[{label:'Личные счета',accounts:state.accounts.map(a=>({...a,value:a.id,balance:E.balance(state,a.id)}))}];}
function update(){
 const name=source.selectedOptions[0]?.textContent||'Выберите счёт';button.querySelector('.home-account-name').textContent=name;button.setAttribute('aria-label','Счёт для записи: '+name+'. Изменить');
 if(!dialog.open||closing)return;
 const focused=options.contains(document.activeElement)?document.activeElement.closest('[data-home-account]')?.dataset.homeAccount:null;
 options.innerHTML=summaries().map(group=>`<h3 class="home-account-group">${esc(group.label)}</h3><div class="home-account-options">${group.accounts.map(a=>`<button type="button" class="home-account-option" data-home-account="${esc(a.value)}" aria-pressed="${a.value===source.value}" ${pending?'disabled':''}><span class="home-account-symbol">${a.value.startsWith('shared:')?users:wallet}</span><span class="home-account-copy"><strong>${esc(a.name)}</strong><small>${money(a.balance,a.currency)}</small></span><span class="home-account-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg></span></button>`).join('')}</div>`).join('');
 if(focused&&!pending)[...options.querySelectorAll('[data-home-account]')].find(el=>el.dataset.homeAccount===focused)?.focus({preventScroll:true});
}
function show(){
 if(pending||dialog.open||holding||listening||document.querySelector('dialog[open]'))return;
 animation?.cancel();closing=false;dialog.style.transform='';delete dialog.dataset.exiting;dialog.showModal();button.setAttribute('aria-expanded','true');update();
 animation=dialog.animate(reduce.matches?[{opacity:0},{opacity:1}]:[{transform:'translateY(100%)'},{transform:'translateY(0)'}],{duration:reduce.matches?120:280,easing:ease});
}
async function hide(fromDrag=false){
 if(!dialog.open||closing)return;closing=true;drag=null;delete dialog.dataset.dragging;dialog.dataset.exiting='true';
 const current=getComputedStyle(dialog).transform;
 const y=current==='none'?0:new DOMMatrixReadOnly(current).m42,exitY=Math.max(dialog.offsetHeight,y+16);animation?.cancel();
 const exit=dialog.animate(reduce.matches?[{opacity:1},{opacity:0}]:[{transform:current},{transform:`translateY(${exitY}px)`}],{duration:reduce.matches?100:280,easing:fromDrag===true?ease:exitEase,fill:'forwards'});animation=exit;
 await exit.finished.catch(()=>{});if(!closing||animation!==exit)return;dialog.close();exit.cancel();closing=false;
}
button.addEventListener('click',show);
dialog.querySelector('[data-home-account-close]').addEventListener('click',hide);
dialog.addEventListener('cancel',event=>{event.preventDefault();hide();});
// Ignore a release outside the sheet unless that same gesture began outside it.
const outside=event=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
dialog.addEventListener('pointerdown',event=>{backdropStart=event.target===dialog&&outside(event)?{x:event.clientX,y:event.clientY}:null;});
dialog.addEventListener('pointercancel',()=>{backdropStart=null;});
dialog.addEventListener('click',async event=>{
 if(backdropStart&&event.target===dialog&&outside(event)&&Math.hypot(event.clientX-backdropStart.x,event.clientY-backdropStart.y)<10){backdropStart=null;hide();return;}backdropStart=null;
 const option=event.target.closest('[data-home-account]');if(!option||pending||closing)return;
 const value=option.dataset.homeAccount;if(![...source.options].some(o=>o.value===value)){update();return;}
 if(value===source.value){hide();return;}
 pending=true;dialog.setAttribute('aria-busy','true');update();
 // Begin the exit before waiting for the existing async account switch. Cached state redraws behind it.
 hide();
 try{source.value=value;await source.onchange?.({target:source});}
 catch(error){notify(error.message||'Не удалось выбрать счёт.');refreshAccounts();}
 finally{pending=false;dialog.removeAttribute('aria-busy');update();}
});
dialog.addEventListener('close',()=>{closing=false;drag=null;animation?.cancel();animation=null;dialog.style.transform='';delete dialog.dataset.dragging;delete dialog.dataset.exiting;button.setAttribute('aria-expanded','false');if(page==='home'&&!document.querySelector('dialog[open]'))button.focus({preventScroll:true});});
source.addEventListener('change',()=>queueMicrotask(update));new MutationObserver(update).observe(source,{childList:true,subtree:true,attributes:true,attributeFilter:['selected']});
// A downward gesture at the top of the list belongs to the sheet. Upward/scroll gestures stay native.
function startDrag(id,x,y,target){if(closing||pending||!dialog.open)return;drag={id,x,y,active:false,cancelled:false,base:0,dy:0,lastY:y,lastTime:performance.now(),velocity:0,atTop:dialog.scrollTop<=1||!!target?.closest('.home-account-grip,.home-account-heading')};}
function moveDrag(id,x,y,event){
 const g=drag;if(!g||g.id!==id||g.cancelled)return;
 const dy=y-g.y,dx=x-g.x;
 if(!g.active){
  if(Math.abs(dy)<8&&Math.abs(dx)<8)return;
  if(!g.atTop||dy<=0||Math.abs(dx)>dy){g.cancelled=true;return;}
  const matrix=getComputedStyle(dialog).transform;g.base=matrix==='none'?0:new DOMMatrixReadOnly(matrix).m42;
  animation?.cancel();g.active=true;dialog.dataset.dragging='true';backdropStart=null;
  if(event.pointerId!==undefined)dialog.setPointerCapture?.(event.pointerId);
 }
 if(event.cancelable)event.preventDefault();
 const now=performance.now();g.velocity=(y-g.lastY)/Math.max(1,now-g.lastTime);g.lastTime=now;g.lastY=y;
 g.dy=Math.max(0,g.base+dy);dialog.style.transform=`translateY(${g.dy}px)`;
}
function endDrag(id,cancelled=false){
 const g=drag;if(!g||g.id!==id)return;drag=null;if(!g.active)return;
 suppressUntil=performance.now()+400;delete dialog.dataset.dragging;
 const velocity=performance.now()-g.lastTime<100?g.velocity:0;
 if(!cancelled&&(g.dy>=Math.min(100,dialog.offsetHeight*.25)||(g.dy>20&&velocity>.5))){hide(true);return;}
 const current=getComputedStyle(dialog).transform;animation?.cancel();
 const settle=dialog.animate(reduce.matches?[{opacity:.85},{opacity:1}]:[{transform:current},{transform:'translateY(0)'}],{duration:reduce.matches?100:240,easing:ease,fill:'forwards'});animation=settle;
 settle.finished.then(()=>{if(animation!==settle)return;dialog.style.transform='';settle.cancel();animation=null;}).catch(()=>{});
}
dialog.addEventListener('click',event=>{if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
dialog.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'||!event.isPrimary||event.button!==0||outside(event))return;startDrag(event.pointerId,event.clientX,event.clientY,event.target);},{passive:true});
dialog.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')moveDrag(event.pointerId,event.clientX,event.clientY,event);},{passive:false});
dialog.addEventListener('pointerup',event=>{if(event.pointerType!=='touch')endDrag(event.pointerId);},{passive:true});
dialog.addEventListener('pointercancel',event=>{if(event.pointerType!=='touch')endDrag(event.pointerId,true);},{passive:true});
// Non-passive touchmove lets WKWebView keep native list scrolling unless a downward dismissal is claimed.
dialog.addEventListener('touchstart',event=>{if(event.touches.length!==1){if(drag)endDrag(drag.id,true);return;}const t=event.touches[0];startDrag(t.identifier,t.clientX,t.clientY,event.target);},{passive:true});
dialog.addEventListener('touchmove',event=>{if(event.touches.length!==1){if(drag)endDrag(drag.id,true);return;}const t=event.touches[0];moveDrag(t.identifier,t.clientX,t.clientY,event);},{passive:false});
dialog.addEventListener('touchend',event=>{for(const t of event.changedTouches)endDrag(t.identifier);},{passive:true});
dialog.addEventListener('touchcancel',event=>{for(const t of event.changedTouches)endDrag(t.identifier,true);},{passive:true});
reduce.addEventListener('change',()=>{if(drag)endDrag(drag.id,true);animation?.finish();});
root.MonoHomeAccountPicker={update,show,hide};update();
})(window);
