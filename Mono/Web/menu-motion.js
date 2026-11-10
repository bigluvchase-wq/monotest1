/* Live content uses a soft slide and staggered reveal, without cloned pages or zooming. */
(function(root){
 'use strict';
 let active=null;
 const easing='cubic-bezier(.25,.7,.25,1)';
 function cancel(){active?.finish(false);}
 function prepare(from,to){
  cancel();if(reducedMotion()||tourActive)return null;
  const opening=from==='menu'&&!rootPages.includes(to),closing=to==='menu'&&!rootPages.includes(from);
  return opening||closing?{opening,route:opening?to:from}:null;
 }
 function play(plan){
  if(!plan)return;
  const workspace=document.querySelector('#workspace'),animations=[],direction=plan.opening?1:-1;let ended=false,timer;
  function finish(focus=true){
   if(ended)return;ended=true;clearTimeout(timer);animations.forEach(a=>a.cancel());if(active?.finish===finish)active=null;
   if(focus&&root.MonoFocus?.isKeyboard()&&!document.querySelector('dialog[open]')){const target=plan.opening?document.querySelector('#pageTitle'):document.querySelector(`.menu-tile[data-go="${plan.route}"]`);if(target){if(plan.opening)target.tabIndex=-1;target.focus({preventScroll:true});}}
  }
  active={finish};
  animations.push(workspace.animate([{transform:`translateY(${direction*16}px)`},{transform:'translateY(0)'}],{duration:540,easing}));
  const children=plan.opening?document.querySelectorAll('#pageBody > *'):document.querySelectorAll('.menu-tile');
  children.forEach((el,index)=>animations.push(el.animate([{transform:'translateY(12px) scale(.985)'},{transform:'none'}],{duration:400,delay:55+Math.min(index,6)*18,easing,fill:'backwards'})));
  Promise.allSettled(animations.map(a=>a.finished)).then(()=>finish());timer=setTimeout(()=>finish(),740);
 }
 window.addEventListener('resize',cancel);window.addEventListener('pagehide',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 root.MonoMenuMotion={prepare,play,cancel,isBusy:()=>!!active};
})(window);
