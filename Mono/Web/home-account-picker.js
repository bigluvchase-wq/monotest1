(function(root){
'use strict';
const source=document.querySelector('#voiceAccount'),button=document.querySelector('#homeAccountButton'),dialog=document.querySelector('#homeAccountDialog'),options=document.querySelector('#homeAccountOptions');
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),ease='cubic-bezier(.22,1,.36,1)';
let animation=null,closing=false,pending=false,backdropStart=null;
const wallet='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18M15 14h3"/></svg>';
const users='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></svg>';
function summaries(){return root.MonoTogether?.pickerGroups()||[{label:'Личные счета',accounts:state.accounts.map(a=>({...a,value:a.id,balance:E.balance(state,a.id)}))}];}
function update(){
 const name=source.selectedOptions[0]?.textContent||'Выберите счёт';button.querySelector('.home-account-name').textContent=name;button.setAttribute('aria-label','Счёт для записи: '+name+'. Изменить');
 if(!dialog.open)return;
 const focused=options.contains(document.activeElement)?document.activeElement.closest('[data-home-account]')?.dataset.homeAccount:null;
 options.innerHTML=summaries().map(group=>`<h3 class="home-account-group">${esc(group.label)}</h3><div class="home-account-options">${group.accounts.map(a=>`<button type="button" class="home-account-option" data-home-account="${esc(a.value)}" aria-pressed="${a.value===source.value}" ${pending?'disabled':''}><span class="home-account-symbol">${a.value.startsWith('shared:')?users:wallet}</span><span class="home-account-copy"><strong>${esc(a.name)}</strong><small>${money(a.balance,a.currency)}</small></span><span class="home-account-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg></span></button>`).join('')}</div>`).join('');
 if(focused&&!pending)[...options.querySelectorAll('[data-home-account]')].find(el=>el.dataset.homeAccount===focused)?.focus({preventScroll:true});
}
function show(){
 if(pending||dialog.open||holding||listening||document.querySelector('dialog[open]'))return;
 animation?.cancel();closing=false;dialog.showModal();button.setAttribute('aria-expanded','true');update();
 animation=dialog.animate(reduce.matches?[{opacity:0},{opacity:1}]:[{transform:'translateY(100%)'},{transform:'translateY(0)'}],{duration:reduce.matches?120:280,easing:ease});
}
async function hide(){
 if(!dialog.open||closing||pending)return;closing=true;
 const current=getComputedStyle(dialog).transform;animation?.cancel();
 animation=dialog.animate(reduce.matches?[{opacity:1},{opacity:0}]:[{transform:current},{transform:'translateY(100%)'}],{duration:reduce.matches?100:240,easing:ease});
 await animation.finished.catch(()=>{});if(!closing)return;dialog.close();animation?.cancel();closing=false;
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
 try{source.value=value;await source.onchange?.({target:source});}
 catch(error){notify(error.message||'Не удалось выбрать счёт.');refreshAccounts();}
 finally{pending=false;dialog.removeAttribute('aria-busy');update();hide();}
});
dialog.addEventListener('close',()=>{closing=false;animation?.cancel();button.setAttribute('aria-expanded','false');if(page==='home'&&!document.querySelector('dialog[open]'))button.focus({preventScroll:true});});
source.addEventListener('change',()=>queueMicrotask(update));new MutationObserver(update).observe(source,{childList:true,subtree:true,attributes:true,attributeFilter:['selected']});
reduce.addEventListener('change',()=>{animation?.finish();});
root.MonoHomeAccountPicker={update,show,hide};update();
})(window);
