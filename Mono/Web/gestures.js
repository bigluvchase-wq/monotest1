/* Root pages follow the finger; nested pages retain their back gesture. */
(function(){
let gesture=null,lastSwipe=null;
const app=document.querySelector('.app');
function blocked(target){return window.MonoPageMotion?.isBusy()||tourActive||holding||listening||!!document.querySelector('dialog[open]')||target.closest('input,select,textarea,label,.mic,.bottom-nav,.operations-tools,.category-items,.swipe-shell,.goal-card,.limit-items,.rem-carousel,.hd-pager');}
function destination(dx){
 if(!dx)return null;
 if(!rootPages.includes(page))return dx>0?backDestination():forwardDestination();
 return rootPages[rootPages.indexOf(page)+(dx<0?1:-1)]||(page==='menu'&&dx<0?forwardDestination():null);
}
function reset(){app.style.transform='';app.style.opacity='';document.body.classList.remove('dragging-pages');}
document.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;lastSwipe=null;if(blocked(e.target))return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,start:performance.now(),dx:0,horizontal:false,cancelled:false,target:null};},{passive:true});
document.addEventListener('pointermove',e=>{const g=gesture;if(!g||e.pointerId!==g.id||g.cancelled)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.horizontal){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){g.cancelled=true;return;}if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.35)return;g.horizontal=true;window.MonoMenuMotion?.cancel();document.body.classList.add('dragging-pages');}g.dx=dx;const target=destination(dx);if(rootPages.includes(page)&&rootPages.includes(target)&&window.MonoPageMotion){if(g.target!==target){MonoPageMotion.begin(target);g.target=target;}MonoPageMotion.drag(Math.max(-innerWidth,Math.min(innerWidth,dx)));}else{if(g.target){window.MonoPageMotion?.cancel();g.target=null;}app.style.transform=`translateX(${target?dx*.7:dx*.12}px)`;}if(e.cancelable)e.preventDefault();},{passive:false});
function end(e){
 const g=gesture;if(!g||e.pointerId!==g.id)return;
 gesture=null;
 const target=destination(g.dx),distance=Math.abs(g.dx),velocity=distance/Math.max(1,performance.now()-g.start);
 const commit=g.horizontal&&!g.cancelled&&target&&(distance>Math.min(90,innerWidth*.22)||(distance>38&&velocity>.5));
 document.body.classList.remove('dragging-pages');
 if(g.horizontal)lastSwipe={x:e.clientX,y:e.clientY,time:performance.now()};
 if(g.target){MonoPageMotion.settle(!!commit);return;}
 if(commit)navigate(target,{historyStep:g.dx>0?'back':'forward',direction:g.dx<0?1:-1,duration:420,dragOffset:g.dx*.7});
 else if(g.horizontal&&!reducedMotion())app.animate([{transform:app.style.transform||'translateX(0)'},{transform:'translateX(0)'}],{duration:330,easing:'cubic-bezier(.22,1,.36,1)'});
 reset();
}
document.addEventListener('pointerup',end,{passive:true});
document.addEventListener('pointercancel',event=>{if(event.pointerId!==gesture?.id)return;gesture=null;window.MonoPageMotion?.cancel();reset();},{passive:true});
document.addEventListener('click',event=>{
 if(!lastSwipe||!event.detail||performance.now()-lastSwipe.time>450||Math.hypot(event.clientX-lastSwipe.x,event.clientY-lastSwipe.y)>25)return;
 lastSwipe=null;event.preventDefault();event.stopImmediatePropagation();
},{capture:true});
})();
