/* Live content uses a soft slide and staggered reveal, without cloned pages or zooming. */
(function(root){
 'use strict';
 const M=root.MonoMotion;let active=null;
 const easing=M.ease.screen;
 function cancel(){active?.finish(false);}
 function prepare(from,to){
  cancel();if(reducedMotion()||tourActive)return null;
  const opening=from==='menu'&&!rootPages.includes(to),closing=to==='menu'&&!rootPages.includes(from);
  return opening||closing?{opening,route:opening?to:from}:null;
 }
 function play(plan){
  if(!plan)return;
  if(!plan.opening){
   // Возврат в меню: блоки меню плавно встают на место, одним движением
   if(!reducedMotion()){const grid=document.querySelector('.menu-grid');grid?.animate([{transform:'translateX(-18px) scale(.985)'},{transform:'none'}],{duration:M.duration.screen,easing:M.ease.screen});}
   return;
  }
  const workspace=document.querySelector('#workspace'),animations=[],direction=plan.opening?1:-1;let ended=false,timer;
  function finish(focus=true){
   if(ended)return;ended=true;clearTimeout(timer);animations.forEach(a=>a.cancel());if(active?.finish===finish)active=null;
   if(focus&&root.MonoFocus?.isKeyboard()&&!document.querySelector('dialog[open]')){const target=plan.opening?document.querySelector('#pageTitle'):document.querySelector(`.menu-tile[data-go="${plan.route}"]`);if(target){if(plan.opening)target.tabIndex=-1;target.focus({preventScroll:true});}}
  }
  active={finish};
  animations.push(workspace.animate([{transform:'translateX(22px)'},{transform:'none'}],{duration:M.duration.screen,easing:M.ease.screen}));
  Promise.allSettled(animations.map(a=>a.finished)).then(()=>finish());timer=setTimeout(()=>finish(),M.duration.screen+M.duration.small);
 }
 window.addEventListener('resize',cancel);window.addEventListener('pagehide',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 root.MonoMenuMotion={prepare,play,cancel,isBusy:()=>!!active};
})(window);
