(function(root){
'use strict';
let active=[];
function cancel(){active.forEach(animation=>animation.cancel());active=[];}
function open(id){
 if(page!=='home')return;
 document.activeElement?.blur?.();
 navigate('reminders',{noAnimation:true,noPageMotion:true});
 MonoReminders.focus(id,{scroll:false});
 if(reducedMotion())return;
 const parts=[...document.querySelectorAll('#workspace .page-head,#workspace .reminders-agenda,#workspace .reminder-group')].slice(0,8);
 active=parts.map((element,index)=>element.animate(
  [{opacity:.64,transform:'translateY(8px)'},{opacity:1,transform:'none'}],
  {duration:310,delay:index*23,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'}
 ));
}
root.MonoReminderMotion={open,cancel};
addEventListener('resize',cancel);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',cancel);
})(window);
