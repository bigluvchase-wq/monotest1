/* Card-to-reader motion inspired by the user's Animorio reference; independent WAAPI implementation. */
(function(root){
'use strict';
let stop=null;
function cancel(){stop?.();}
async function enter(app,ghost,from){
 cancel();
 const old={position:app.style.position,zIndex:app.style.zIndex,pointerEvents:app.style.pointerEvents};
 app.style.position='relative';app.style.zIndex='10';app.style.pointerEvents='none';
 // Measure in the same positioning context that stays in place throughout the transition.
 const workspace=document.querySelector('#workspace'),r=workspace.getBoundingClientRect();
 const target={left:r.left,top:Math.max(0,r.top),width:r.width,height:Math.max(1,innerHeight-Math.max(0,r.top)-16)};
 if(!from.width||!from.height||!target.width){ghost.remove();Object.assign(app.style,old);document.documentElement.classList.remove('reminder-opening');return;}
 const shell=document.createElement('div');shell.className='reminder-expand-shell';shell.setAttribute('aria-hidden','true');
 Object.assign(shell.style,{left:target.left+'px',top:target.top+'px',width:target.width+'px',height:target.height+'px'});document.body.append(shell);
 const animations=[],parts=[...workspace.querySelectorAll('.page-head,.reminders-agenda,.reminder-group,.reminder-card')].filter(el=>!el.parentElement.closest('.reminder-group')).slice(0,8);
 let resolve;const settled=new Promise(r=>{resolve=r;});let cleaned=false;
 function clean(){if(cleaned)return;cleaned=true;animations.forEach(a=>a.cancel());shell.remove();ghost.remove();Object.assign(app.style,old);document.documentElement.classList.remove('reminder-opening');if(stop===clean)stop=null;resolve();}
 stop=clean;
 const motion=(el,frames,options)=>{const a=el.animate(frames,options);animations.push(a);return a;};
 const start=`translate(${from.left-target.left}px,${from.top-target.top}px) scale(${from.width/target.width},${from.height/target.height})`;
 // Only the empty surface scales. Text remains at its final size and arrives in a separate layer.
 motion(shell,[{transform:start},{transform:'none'}],{duration:600,easing:'cubic-bezier(.87,0,.13,1)',fill:'both'});
 motion(ghost,[{opacity:1},{opacity:0}],{duration:420,delay:180,easing:'ease-in-out',fill:'forwards'});
 motion(app,[{opacity:0},{opacity:1}],{duration:340,delay:260,easing:'ease-out',fill:'both'});
 parts.forEach((el,i)=>motion(el,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:380,delay:300+i*25,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}));
 motion(shell,[{opacity:1},{opacity:0}],{duration:180,delay:580,fill:'both'});
 Promise.all(animations.map(a=>a.finished.catch(()=>{}))).then(clean);
 await settled;
}
root.MonoReminderMotion={enter,cancel};
addEventListener('resize',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',cancel);
})(window);
