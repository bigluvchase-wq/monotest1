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
const hint=document.createElement('div');hint.className='pull-hint';hint.setAttribute('aria-hidden','true');hint.textContent='Потяните вниз для добавления';document.body.append(hint);
const THRESHOLD=78;
let g=null;
const app=document.querySelector('.app');
function reset(animate){hint.style.opacity='0';hint.style.transform='translate(-50%,-14px)';if(animate){app.style.transition='transform .28s cubic-bezier(.25,.8,.3,1)';app.style.transform='';setTimeout(()=>{app.style.transition='';},300);}else{app.style.transform='';}}
document.addEventListener('touchstart',e=>{
 g=null;
 if(!actions[page]||e.touches.length!==1||window.scrollY>1||tourActive||holding||listening||document.querySelector('dialog[open]')||document.documentElement.classList.contains('search-open'))return;
 if(e.target.closest('.swipe-shell.swipe-open,input,textarea,select,[data-goal-handle]'))return;
 const t=e.touches[0];g={x:t.clientX,y:t.clientY,on:false,dead:false};
},{passive:true});
document.addEventListener('touchmove',e=>{
 if(!g||g.dead)return;
 const t=e.touches[0],dx=t.clientX-g.x,dy=t.clientY-g.y;
 if(!g.on){
  if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){g.dead=true;return;}
  if(dy<-6||window.scrollY>1){g.dead=true;return;}
  if(dy<8)return;
  g.on=true;
 }
 if(e.cancelable)e.preventDefault();
 const p=Math.min(1,dy/THRESHOLD),pull=Math.min(dy,160)*.38;
 app.style.transition='none';app.style.transform=`translateY(${pull.toFixed(1)}px)`;
 hint.style.opacity=String(Math.min(1,p*1.2));hint.style.transform=`translate(-50%,${(-14+Math.min(18,pull*.5)).toFixed(1)}px)`;
 hint.textContent=p>=1?'Отпустите, чтобы добавить':'Потяните вниз для добавления';
 hint.classList.toggle('ready',p>=1);
},{passive:false});
function end(e){
 if(!g){return;}
 const was=g.on,ready=hint.classList.contains('ready');g=null;
 if(!was)return;
 hint.classList.remove('ready');reset(true);
 if(ready){try{actions[page]?.();}catch{}}
}
document.addEventListener('touchend',end,{passive:true});document.addEventListener('touchcancel',()=>{if(g?.on){reset(true);hint.classList.remove('ready');}g=null;},{passive:true});
})(window);
