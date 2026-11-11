(function(root){
'use strict';
// Переходы между экранами отдаём iOS (MonoTransitions.swift): снимок старого экрана и новый экран
// двигает Core Animation. Если натива нет (браузер) или он не ответил — работает прежняя веб-анимация.
const handler=root.webkit?.messageHandlers?.mono;
const available=!!handler&&!!root.MonoNative;
const post=(action,data={})=>{try{handler.postMessage({action,...data});}catch{}};
const frames=n=>new Promise(r=>{const step=()=>--n<=0?r():requestAnimationFrame(step);requestAnimationFrame(step);});
let seq=0;const waiting=new Map();

// kind: slide | push | dive | zoom | fade. ghost — копия старого экрана, лежит поверх нового.
async function play(kind,dir,rect,ghost,fallback,from){
 const id=++seq;
 await frames(2); // копия старого экрана точно нарисована
 const ok=await new Promise(resolve=>{
  const timer=setTimeout(()=>{waiting.delete(id);resolve(false);},300);
  waiting.set(id,v=>{clearTimeout(timer);waiting.delete(id);resolve(v);});
  post('transitionBegin',{id,kind,dir,from:from||'',rect:rect?{x:rect.left,y:rect.top,w:rect.width,h:rect.height}:null});
 });
 if(!ok||!ghost.isConnected){fallback();return;}
 ghost.remove(); // старый экран теперь показывает снимок iOS
 await frames(2); // новый экран нарисован под снимком
 post('transitionGo',{id});
}
function transitionReady(id,ok){waiting.get(id)?.(!!ok);}

// Свайп между корневыми экранами: после передачи жеста палец ведёт iOS
let dragListener=null;
function pageDrag(from,to,dir,onDenied){dragListener={to,onDenied};post('pageDrag',{from,to,dir});}
function pageDragDenied(to){const l=dragListener;dragListener=null;if(l&&l.to===to)l.onDenied?.();}
function nativeNavigate(to){dragListener=null;if(typeof navigate==='function')navigate(to,{noAnimation:true,noPageMotion:true});}
function pageDragEnd(){dragListener=null;scheduleCache();}

// Снимки корневых экранов — чтобы при свайпе соседний экран был виден сразу
let cacheTimer=0;
function scheduleCache(){clearTimeout(cacheTimer);cacheTimer=setTimeout(()=>{if(typeof page==='string'&&typeof rootPages!=='undefined'&&rootPages.includes(page)&&!document.querySelector('dialog[open]'))post('cachePage',{page});},700);}

if(available)Object.assign(root.MonoNative,{transitionReady,pageDragDenied,nativeNavigate,pageDragEnd});
root.MonoNativeMotion={available,play,pageDrag,scheduleCache};
if(available)setTimeout(scheduleCache,2600);
})(window);
