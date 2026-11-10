(function(root){
'use strict';
// Потяните вниз на страницах «Счета», «Цели», «Платежи», «Вклады», «Напоминания» — откроется окно добавления.
const actions={
 accounts:()=>accountForm(),
 goals:()=>goalForm(),
 payments:()=>paymentForm(),
 deposits:()=>root.MonoDeposits?.form(),
 reminders:()=>root.MonoReminders?.form()
};
const THRESHOLD=86;
const hint=document.createElement('div');
hint.className='pull-hint';hint.setAttribute('aria-hidden','true');
hint.innerHTML='<span class="pull-arrow"><svg viewBox="0 0 24 24"><path d="M12 5v13M6.5 12.5 12 18l5.5-5.5"/></svg></span><span class="pull-text">Потяните вниз, чтобы добавить</span>';
document.body.append(hint);
const text=hint.querySelector('.pull-text'),arrow=hint.querySelector('.pull-arrow');
const app=document.querySelector('.app');
let g=null;
function blocked(target){return !actions[page]||window.scrollY>2||tourActive||holding||listening||document.querySelector('dialog[open]')||document.documentElement.classList.contains('search-open')||window.MonoPageMotion?.isBusy()||target.closest('input,textarea,select,.swipe-shell.swipe-open,[data-goal-handle],.goal-card.dragging');}
function show(pull,progress){
 app.style.transition='none';app.style.transform=pull?`translateY(${pull.toFixed(1)}px)`:'';
 hint.style.opacity=String(Math.min(1,progress*1.4));
 hint.style.transform=`translate(-50%,${(-18+Math.min(26,pull*.55)).toFixed(1)}px) scale(${(.9+.1*Math.min(1,progress)).toFixed(3)})`;
 arrow.style.transform=`translateY(${(Math.min(1,progress)*3).toFixed(1)}px)`;
 const ready=progress>=1;
 if(ready!==hint.classList.contains('ready')){hint.classList.toggle('ready',ready);text.textContent=ready?'Отпустите, чтобы добавить':'Потяните вниз, чтобы добавить';if(ready)navigator.vibrate?.(8);}
}
function reset(){
 const from=app.style.transform;app.style.transform='';app.style.transition='';
 if(from&&!reducedMotion())app.animate([{transform:from},{transform:'none'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
 hint.style.opacity='0';hint.style.transform='translate(-50%,-18px) scale(.9)';hint.classList.remove('ready');text.textContent='Потяните вниз, чтобы добавить';arrow.style.transform='';
}
document.addEventListener('touchstart',e=>{
 g=null;
 if(e.touches.length!==1||blocked(e.target))return;
 const t=e.touches[0];g={x:t.clientX,y:t.clientY,on:false,dead:false,dy:0};
},{passive:true});
document.addEventListener('touchmove',e=>{
 if(!g||g.dead)return;
 const t=e.touches[0],dx=t.clientX-g.x,dy=t.clientY-g.y;
 if(!g.on){
  if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){g.dead=true;return;}
  if(dy<-4||window.scrollY>2){g.dead=true;return;}
  if(dy<10)return;
  g.on=true;g.y=t.clientY-1;
 }
 if(e.cancelable)e.preventDefault();
 g.dy=Math.max(0,t.clientY-g.y);
 const progress=g.dy/THRESHOLD,pull=Math.min(g.dy,180)*.42;
 show(pull,progress);
},{passive:false});
function end(){
 if(!g)return;
 const was=g.on,ready=g.dy>=THRESHOLD;g=null;
 if(!was)return;
 reset();
 if(ready){try{actions[page]?.();}catch(error){console.error(error);}}
}
document.addEventListener('touchend',end,{passive:true});
document.addEventListener('touchcancel',()=>{if(g?.on)reset();g=null;},{passive:true});
root.MonoPullAdd={pages:Object.keys(actions)};
})(window);
