/* Use the actual home until it is invisible; never re-layout a cloned reminder card. */
(function(root){
'use strict';
const M=root.MonoMotion;let active=null;
function cancel(){if(active&&!active.switching)active.clean();}
async function open(id){
 if(active||page!=='home')return;
 document.activeElement?.blur?.();
 if(reducedMotion()){navigate('reminders',{noAnimation:true,noPageMotion:true});MonoReminders.focus(id,{scroll:false});return;}
 const app=document.querySelector('.app'),oldPointer=app.style.pointerEvents;
 const session={switching:false,animations:[],clean:null};active=session;
 let cleaned=false;session.clean=()=>{if(cleaned)return;cleaned=true;session.animations.forEach(a=>a.cancel());app.style.pointerEvents=oldPointer;document.documentElement.classList.remove('reminder-opening');if(active===session)active=null;};
 app.style.pointerEvents='none';document.documentElement.classList.add('reminder-opening');
 const out=app.animate([{opacity:1},{opacity:0}],{duration:M.duration.micro,easing:M.ease.exit,fill:'forwards'});session.animations.push(out);
 await out.finished.catch(()=>{});if(active!==session)return;
 session.switching=true;
 try{navigate('reminders',{noAnimation:true,noPageMotion:true});}
 catch(error){session.switching=false;session.clean();notify(error.message||'Не удалось открыть напоминания.');return;}
 session.switching=false;document.documentElement.classList.add('reminder-opening');
 session.animations.push(app.animate([{opacity:0},{opacity:1}],{duration:M.duration.screen,easing:M.ease.enter,fill:'backwards'}));
 const parts=[...document.querySelectorAll('#workspace .page-head,#workspace .reminders-agenda,#workspace .reminder-group')].slice(0,8);
 parts.forEach((el,i)=>session.animations.push(el.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:M.duration.small,delay:40+i*M.duration.stagger,easing:M.ease.enter,fill:'backwards'})));
 // Navigation cancels the completed outgoing animation; wait only for the new page's animations.
 await Promise.allSettled(session.animations.slice(1).map(a=>a.finished));if(active!==session)return;
 session.clean();if(page==='reminders')MonoReminders.focus(id,{scroll:false});
}
root.MonoReminderMotion={open,cancel};
addEventListener('resize',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',cancel);
})(window);
