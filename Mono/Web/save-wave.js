/* Native snapshot handshake: persist runs exactly once, independently of animation success. */
(function(root){
'use strict';
let current=null,sequence=0;
const enabled=()=>root.MONO_CONFIG?.effects?.saveWave!==false&&root.MonoNative?.saveWaveSupported===true;
function run(button,commit){
 if(current)return;
 if(!enabled()){commit();return;}
 const id=String(++sequence),session={id,commit,done:false,timer:null,button,panel:button.closest('dialog')};current=session;button.disabled=true;
 const focused=document.activeElement,keyboard=focused?.matches('input,textarea,select');focused?.blur?.();
 if(session.panel)session.panel.inert=true;
 const prepare=()=>{
  if(current!==session)return;
  const r=button.getBoundingClientRect();session.timer=setTimeout(()=>ready(id,false),900);
  try{MonoNative.prepareSaveWave({id,source:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight},palette:state.settings.theme||'system'});}catch{ready(id,false);}
 };
 if(keyboard)session.timer=setTimeout(prepare,260);else prepare();
}
function release(session){clearTimeout(session.timer);session.button.disabled=false;if(session.panel)session.panel.inert=false;if(current===session)current=null;}
function ready(id,captured){
 const session=current;if(session?.id===id&&session.done)return;if(!session||session.id!==id){if(captured)root.MonoNative?.cancelSaveWave(id);return;}
 if(session.panel&&!session.panel.open){root.MonoNative?.cancelSaveWave(id);release(session);return;}
 session.done=true;clearTimeout(session.timer);
 let saved=false;
 try{saved=session.commit(captured)===true;}catch(error){notify(error.message||'Не удалось сохранить запись.');}
 if(!captured||!saved){root.MonoNative?.cancelSaveWave(id);release(session);return;}
 // Give the final DOM a frame to lay out before WKWebView takes its second snapshot.
 session.timer=setTimeout(()=>{root.MonoNative?.cancelSaveWave(id);release(session);},3500);
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(current===session)root.MonoNative.finishSaveWave(id);}));
}
function finished(id){const session=current;if(session?.id===id){if(!session.done)ready(id,false);else release(session);}}
root.MonoSaveWave={run,ready,finished};
})(window);
