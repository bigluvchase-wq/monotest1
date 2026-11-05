(function(root){
'use strict';
const DURATION=5000,CIRCUMFERENCE=2*Math.PI*12;
function mount(host,expired,options={}){if(options.countdown===false){const duration=options.duration??DURATION,fade=Math.max(0,Math.min(options.fade||0,duration)),end=performance.now()+duration;let done=false,animation=null,fadeTimer=null;const timer=setTimeout(()=>{if(!done){done=true;expired();animation?.cancel();}},duration);if(fade&&host.animate&&!root.matchMedia?.('(prefers-reduced-motion:reduce)').matches)fadeTimer=setTimeout(()=>{if(!done)animation=host.animate([{opacity:1},{opacity:0}],{duration:fade,easing:'ease-out',fill:'forwards'});},duration-fade);return {cancel(){done=true;clearTimeout(timer);clearTimeout(fadeTimer);animation?.cancel();},remaining:()=>Math.max(0,end-performance.now())};}const badge=document.createElement('span');badge.className='notice-countdown';badge.setAttribute('aria-hidden','true');badge.innerHTML='<svg viewBox="0 0 32 32"><circle class="notice-track" cx="16" cy="16" r="12"/><circle class="notice-progress" cx="16" cy="16" r="12"/></svg><b>5</b>';host.append(badge);const circle=badge.querySelector('.notice-progress'),number=badge.querySelector('b'),end=performance.now()+DURATION;circle.style.strokeDasharray=String(CIRCUMFERENCE);let frame,timer,done=false;
const remaining=()=>Math.max(0,end-performance.now());
function cancel(){if(done)return;done=true;cancelAnimationFrame(frame);clearTimeout(timer);badge.remove();}
function tick(){if(done)return;const left=remaining();number.textContent=String(Math.ceil(left/1000));circle.style.strokeDashoffset=String(-(1-left/DURATION)*CIRCUMFERENCE);if(left<=0){cancel();expired();return;}frame=requestAnimationFrame(tick);}
timer=setTimeout(()=>{if(!done){cancel();expired();}},DURATION);tick();return {cancel,remaining};}
root.MonoNoticeLifetime={mount,DURATION};
})(typeof window==='object'?window:globalThis);
