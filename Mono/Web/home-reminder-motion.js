/* Card-to-reader motion inspired by the user's Animorio reference; independent WAAPI implementation. */
(function(root){
'use strict';
let stop=null;
function cancel(){stop?.();}
async function enter(app,ghost,from){
 cancel();
 const old={position:app.style.position,zIndex:app.style.zIndex,pointerEvents:app.style.pointerEvents};
 app.style.position='relative';app.style.zIndex='10';app.style.pointerEvents='none';
 const workspace=document.querySelector('#workspace');
 if(!from.width||!from.height){ghost.remove();Object.assign(app.style,old);document.documentElement.classList.remove('reminder-opening');return;}
 const animations=[],parts=[...workspace.querySelectorAll('.page-head,.reminders-agenda,.reminder-group,.reminder-card')].filter(el=>!el.parentElement.closest('.reminder-group')).slice(0,8);
 let resolve;const settled=new Promise(r=>{resolve=r;});let cleaned=false;
 function clean(){if(cleaned)return;cleaned=true;animations.forEach(a=>a.cancel());ghost.remove();Object.assign(app.style,old);document.documentElement.classList.remove('reminder-opening');if(stop===clean)stop=null;resolve();}
 stop=clean;
 const motion=(el,frames,options)=>{const a=el.animate(frames,options);animations.push(a);return a;};
 // Reveal live content directly: no opaque temporary surface behind the reminders.
 motion(ghost,[{opacity:1},{opacity:0}],{duration:300,easing:'ease-in-out',fill:'forwards'});
 motion(app,[{opacity:0},{opacity:1}],{duration:380,delay:80,easing:'ease-out',fill:'both'});
 parts.forEach((el,i)=>motion(el,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:400,delay:100+i*25,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}));
 Promise.all(animations.map(a=>a.finished.catch(()=>{}))).then(clean);
 await settled;
}
root.MonoReminderMotion={enter,cancel};
addEventListener('resize',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',cancel);
})(window);
