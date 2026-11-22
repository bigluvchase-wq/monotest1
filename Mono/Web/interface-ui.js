(function(){
'use strict';
let keyboard=false;window.MonoFocus={isKeyboard:()=>keyboard};document.body.classList.add('pointer-navigation');document.addEventListener('pointerdown',()=>{keyboard=false;document.body.classList.add('pointer-navigation');},{passive:true,capture:true});document.addEventListener('keydown',e=>{if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keyboard=true;document.body.classList.remove('pointer-navigation');}},{capture:true});
// Only close a sheet when a complete pointer gesture starts and ends on its backdrop.
for(const dialog of document.querySelectorAll('dialog:not(#onboarding):not(#chartDialog):not(#homeAccountDialog)')){
 let start=null;
 function outside(e){const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;}
 dialog.addEventListener('pointerdown',e=>{start=e.target===dialog&&outside(e)?{x:e.clientX,y:e.clientY}:null;});
 dialog.addEventListener('click',e=>{if(start&&e.target===dialog&&outside(e)&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<10)dialog.close();start=null;});
 dialog.addEventListener('pointercancel',()=>start=null);
}
})();

// Главный экран: микрофон встаёт на уровень логотипа заставки; заголовок остаётся по центру.
(function(){
 const root=document.documentElement;let queued=false;
 function alignHome(){
  queued=false;
  if(document.body.dataset.page!=='home')return;
  if(document.querySelector('#home.home-dash')){root.style.setProperty('--home-shift','0px');return;}
  const mic=document.querySelector('#mic'),key=document.querySelector('#textEntry');
  if(!mic||!key)return;
  // текущий сдвиг вычитаем из координат: при плавном переходе не сбрасываем его в ноль
  const block=mic.closest('.recording-block'),t=block?getComputedStyle(block).transform:'none',ty=t&&t!=='none'?new DOMMatrixReadOnly(t).m42:0;
  const shift=r=>({top:r.top-ty,height:r.height,bottom:r.bottom-ty});
  const m=shift(mic.getBoundingClientRect()),k=shift(key.getBoundingClientRect()),foot=document.querySelector('.app footer')?.getBoundingClientRect();
  const reminder=document.querySelector('#homeReminders')?.firstElementChild?.getBoundingClientRect();
  const target=(window.__launchRatio||.47)*innerHeight,wanted=target-(m.top+m.height/2);
  const floor=Math.min(foot?foot.top:innerHeight-110,reminder?reminder.top:Infinity),room=floor-k.bottom-8;
  root.style.setProperty('--home-shift',Math.round(Math.max(0,Math.min(wanted,room)))+'px');
 }
 const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(alignHome);};
 window.MonoAlignHome=alignHome;
 addEventListener('load',queue);addEventListener('resize',queue);addEventListener('orientationchange',queue);
 document.fonts?.ready.then(queue);
 new MutationObserver(queue).observe(document.body,{attributes:true,attributeFilter:['data-page']});
 const reminders=document.querySelector('#homeReminders');if(reminders)new MutationObserver(queue).observe(reminders,{childList:true});
 // высота блока напоминаний меняется после построения карусели — тоже пересчитываем
 if(reminders&&typeof ResizeObserver==='function')new ResizeObserver(queue).observe(reminders);
 setTimeout(queue,400);setTimeout(queue,1200);setTimeout(queue,2200);
 queue();
})();

// Prevent vertical rubber-banding on the home canvas, preserving modal scrolling.
document.addEventListener('touchmove',event=>{
 if(document.body.dataset.page==='home'&&!document.querySelector('dialog[open]')&&event.cancelable)event.preventDefault();
},{passive:false});

/* Keep inline editors and icon pickers in flow while their contents expand. */
window.MonoDisclosure=(()=>{
 const active=new WeakMap();
 return (panel,expanded,onClosed)=>{
  const previous=active.get(panel);
  const start=panel.hidden?0:panel.getBoundingClientRect().height;
  previous?.cancel();active.delete(panel);
  panel.inert=!expanded;
  const complete=()=>{
   panel.classList.remove('disclosure-moving');
   if(!expanded){panel.hidden=true;onClosed?.();}
  };
  panel.hidden=false;
  const end=expanded?panel.getBoundingClientRect().height:0;
  if(matchMedia('(prefers-reduced-motion:reduce)').matches||Math.abs(start-end)<1){complete();return;}
  panel.classList.add('disclosure-moving');
  const animation=panel.animate([{height:start+'px',opacity:start?1:0},{height:end+'px',opacity:expanded?1:0}],
   {duration:300,easing:'cubic-bezier(.24,.7,.3,1)',fill:'both'});
  active.set(panel,animation);
  animation.finished.then(()=>{
   if(active.get(panel)!==animation)return;
   active.delete(panel);complete();animation.cancel();
  }).catch(()=>{});
 };
})();

document.querySelector('#drafts').addEventListener('click',event=>{
 const summary=event.target.closest('.draft-summary');
 if(!summary)return;
 const details=summary.parentElement,editor=details.querySelector('.draft-editor');
 const expanded=summary.getAttribute('aria-expanded')!==null?summary.getAttribute('aria-expanded')!=='true':!details.open;
 if(expanded&&!details.open){editor.hidden=true;details.open=true;}
 event.preventDefault();
 if(!expanded&&editor.contains(document.activeElement))summary.focus({preventScroll:true});
 summary.setAttribute('aria-expanded',String(expanded));
 details.toggleAttribute('data-editing',expanded);
 MonoDisclosure(editor,expanded,()=>{details.open=false;editor.hidden=false;editor.inert=false;});
});
