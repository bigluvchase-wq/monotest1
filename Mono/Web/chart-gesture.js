/* Pull down at the top to dismiss; scrolling and row deletion keep their own axes. */
(function(){
 'use strict';
 const panel=document.querySelector('#chartPanel'),dialog=document.querySelector('#chartDialog');
 let gesture=null,settling=null,suppressUntil=0;
 function start(x,y,target,id){
  if(!dialog.open||MonoCharts.isBusy()||target.closest('input,select,textarea,a,.chart-close,.chart-side-arrow,.chart-period-button,.entity-x,.delete-entry,.swipe-delete'))return;
  settling?.cancel();settling=null;
  gesture={x,y,id,started:performance.now(),dy:0,raw:0,scrollAtStart:panel.scrollTop,drag:false,cancelled:false};
 }
 function move(x,y,id,event){
  const g=gesture;if(!g||g.id!==id||g.cancelled)return;
  const dx=x-g.x,dy=y-g.y;g.raw=Math.max(0,dy);
  if(!g.drag){
   if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)||dy<-10){g.cancelled=true;return;}
   if(dy<10||dy<Math.abs(dx)*1.4||(g.scrollAtStart>0&&dy<180))return;
   g.drag=true;panel.classList.add('chart-pulling');if(event.pointerType&&event.pointerType!=='touch')panel.setPointerCapture?.(id);
  }
  g.raw=Math.max(0,dy);g.dy=Math.min(90,g.raw*.4);
  panel.style.transform=`translateY(${g.dy}px)`;
  if(event.cancelable)event.preventDefault();
 }
 function reset(){panel.style.transform='';panel.classList.remove('chart-pulling');}
 function end(id,cancelled=false){
  const g=gesture;if(!g||g.id!==id)return;gesture=null;
  if(!g.drag){if(g.raw>12)suppressUntil=performance.now()+300;reset();return;}
  suppressUntil=performance.now()+300;
  const dismiss=!cancelled&&(g.raw>=260||g.raw>=180&&g.raw/Math.max(1,performance.now()-g.started)>.4);
  panel.classList.remove('chart-pulling');
  if(dismiss){MonoCharts.close({dragOffset:g.dy});return;}
  const from=panel.style.transform;reset();
  if(!reducedMotion()){settling=panel.animate([{transform:from},{transform:'translateY(0)'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});settling.finished.catch(()=>{}).finally(()=>settling=null);}
 }
 panel.addEventListener('touchstart',e=>{if(e.touches.length!==1){if(gesture)end(gesture.id,true);return;}const t=e.touches[0];start(t.clientX,t.clientY,e.target,t.identifier);},{passive:true});
 panel.addEventListener('touchmove',e=>{if(e.touches.length!==1){if(gesture)end(gesture.id,true);return;}const t=e.touches[0];move(t.clientX,t.clientY,t.identifier,e);},{passive:false});
 panel.addEventListener('touchend',e=>{for(const t of e.changedTouches)end(t.identifier);},{passive:true});
 panel.addEventListener('touchcancel',()=>{if(gesture)end(gesture.id,true);},{passive:true});
 panel.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||!e.isPrimary||e.button!==0)return;start(e.clientX,e.clientY,e.target,e.pointerId);});
 panel.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')move(e.clientX,e.clientY,e.pointerId,e);},{passive:false});
 panel.addEventListener('pointerup',e=>{if(e.pointerType!=='touch')end(e.pointerId);});
 panel.addEventListener('pointercancel',e=>{if(e.pointerType!=='touch')end(e.pointerId,true);});
 panel.addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 dialog.addEventListener('close',()=>{gesture=null;settling?.cancel();settling=null;reset();});
})();
