(function(root){
'use strict';
// Popover держит уведомление над модальными окнами, не забирая фокус.
function enter(host,{gentle=false}={}){
 host.getAnimations().forEach(a=>a.cancel());delete host.dataset.noticeSwipeOffset;host.hidden=false;
 const dialogs=[...document.querySelectorAll('dialog[open]:not(.closing)')];
 (dialogs.at(-1)||document.body).append(host);
 if(host.showPopover){host.setAttribute('popover','manual');host.hidePopover();host.showPopover();}
 const reduce=root.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
 host.animate([{opacity:0,transform:reduce?'none':gentle?'translateY(-10px)':'translateY(-14px) scale(.98)'},{opacity:1,transform:'none'}],{duration:reduce?120:gentle?470:240,easing:gentle?'cubic-bezier(.3,0,.18,1)':'cubic-bezier(.16,1,.3,1)'});
}
function exit(host,done){
 host.getAnimations().forEach(a=>a.cancel());
 const reduce=root.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
 const offset=Number(host.dataset.noticeSwipeOffset)||0;delete host.dataset.noticeSwipeOffset;
 const animation=host.animate([{opacity:1,transform:reduce?'none':`translateY(${offset}px)`},{opacity:0,transform:reduce?'none':`translateY(${offset-(offset?70:10)}px) scale(.98)`}],{duration:reduce?100:180,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
 animation.finished.then(()=>{done();animation.cancel();}).catch(()=>{});
}
root.MonoNoticeMotion={enter,exit};
// Закрытие окна не должно прерывать уведомление или кнопку отмены удаления.
document.addEventListener('close',event=>{
 if(!event.target.matches?.('dialog'))return;
 event.target.querySelectorAll('#toast:not([hidden]),.delete-undo').forEach(enter);
},true);
const DURATION=5000,CIRCUMFERENCE=2*Math.PI*12;
function lifetimeMount(host,expired,options={}){if(options.countdown===false){const duration=options.duration??DURATION,fade=Math.max(0,Math.min(options.fade||0,duration)),end=performance.now()+duration;let done=false,animation=null,fadeTimer=null;const timer=setTimeout(()=>{if(!done){done=true;expired();animation?.cancel();}},duration);if(fade&&host.animate&&!root.matchMedia?.('(prefers-reduced-motion:reduce)').matches)fadeTimer=setTimeout(()=>{if(!done)animation=host.animate([{opacity:1},{opacity:0}],{duration:fade,easing:'ease-out',fill:'forwards'});},duration-fade);return {cancel(){done=true;clearTimeout(timer);clearTimeout(fadeTimer);animation?.cancel();},remaining:()=>Math.max(0,end-performance.now())};}const badge=document.createElement('span');badge.className='notice-countdown';badge.setAttribute('aria-hidden','true');badge.innerHTML='<svg viewBox="0 0 32 32"><circle class="notice-track" cx="16" cy="16" r="12"/><circle class="notice-progress" cx="16" cy="16" r="12"/></svg><b>5</b>';host.append(badge);const circle=badge.querySelector('.notice-progress'),number=badge.querySelector('b'),end=performance.now()+DURATION;circle.style.strokeDasharray=String(CIRCUMFERENCE);let frame,timer,done=false;
const remaining=()=>Math.max(0,end-performance.now());
function cancel(){if(done)return;done=true;cancelAnimationFrame(frame);clearTimeout(timer);badge.remove();}
function tick(){if(done)return;const left=remaining();number.textContent=String(Math.ceil(left/1000));circle.style.strokeDashoffset=String(-(1-left/DURATION)*CIRCUMFERENCE);if(left<=0){cancel();expired();return;}frame=requestAnimationFrame(tick);}
timer=setTimeout(()=>{if(!done){cancel();expired();}},DURATION);tick();return {cancel,remaining};}
function mount(host,expired,options={}){
 let gesture=null,dismissed=false;
 const lifetime=lifetimeMount(host,dismiss,options);
 function clean(){host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',up);host.removeEventListener('pointercancel',cancelGesture);host.style.translate='';host.style.opacity='';}
 function dismiss(){if(dismissed)return;dismissed=true;lifetime.cancel();clean();expired();}
 function down(e){if(e.button>0||!e.isPrimary)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),dy:0};}
 function move(e){if(!gesture||gesture.id!==e.pointerId)return;gesture.dy=Math.min(0,e.clientY-gesture.y);if(Math.abs(e.clientX-gesture.x)>Math.abs(gesture.dy))return;if(gesture.dy<-5){try{host.setPointerCapture(e.pointerId);}catch{}if(e.cancelable)e.preventDefault();host.style.translate=`0 ${gesture.dy}px`;host.style.opacity=String(Math.max(.25,1+gesture.dy/150));}}
 function up(e){if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(dy<0&&Math.abs(dy)>Math.abs(dx)&&(dy<-32||dy<-14&&-dy/Math.max(1,performance.now()-g.t)>.35)){host.dataset.noticeSwipeOffset=String(dy);dismiss();}else{host.style.translate='';host.style.opacity='';}}
 function cancelGesture(){gesture=null;host.style.translate='';host.style.opacity='';}
 host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move,{passive:false});host.addEventListener('pointerup',up);host.addEventListener('pointercancel',cancelGesture);
 return {remaining:lifetime.remaining,cancel(){dismissed=true;lifetime.cancel();clean();}};
}
root.MonoNoticeLifetime={mount,DURATION};
})(typeof window==='object'?window:globalThis);
