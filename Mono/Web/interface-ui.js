(function(){
'use strict';
let keyboard=false;window.MonoFocus={isKeyboard:()=>keyboard};document.body.classList.add('pointer-navigation');document.addEventListener('pointerdown',()=>{keyboard=false;document.body.classList.add('pointer-navigation');},{passive:true,capture:true});document.addEventListener('keydown',e=>{if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keyboard=true;document.body.classList.remove('pointer-navigation');}},{capture:true});
// Only close a sheet when a complete pointer gesture starts and ends on its backdrop.
for(const dialog of document.querySelectorAll('dialog:not(#onboarding):not(#chartDialog)')){
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
 queue();
})();
