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
  const theme=getComputedStyle(document.documentElement),accent=theme.getPropertyValue('--accent').trim(),secondary=theme.getPropertyValue('--accent-2').trim()||accent;
  const p=session.panel?.getBoundingClientRect(),panel=p?{x:p.x,y:p.y,width:p.width,height:p.height,cornerRadius:parseFloat(getComputedStyle(session.panel).borderTopLeftRadius)||0}:null;
  try{MonoNative.prepareSaveWave({id,source:{x:r.x,y:r.y,width:r.width,height:r.height},panel,viewport:{width:innerWidth,height:innerHeight},accent,secondary});}catch{ready(id,false);}
 };
 if(keyboard)session.timer=setTimeout(prepare,260);else prepare();
}
function release(session){clearTimeout(session.timer);session.button.disabled=false;if(session.panel)session.panel.inert=false;if(current===session)current=null;const callback=session.after;session.after=null;callback?.();}
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
function afterFinish(callback){if(current)current.after=callback;else callback();}
function showReceipt(panel,message){
 const receipt=document.createElement('div');receipt.className='save-wave-receipt';receipt.setAttribute('role','status');
 receipt.style.top=panel.scrollTop+'px';receipt.style.height=panel.clientHeight+'px';
 receipt.innerHTML='<span class="save-wave-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span><h2>Записано</h2><p></p>';
 receipt.querySelector('p').textContent=message.replace(/^Записано\.\s*/,'');panel.append(receipt);panel.classList.add('save-wave-sent');
 return ()=>{receipt.remove();panel.classList.remove('save-wave-sent');};
}
root.MonoSaveWave={run,ready,finished,afterFinish,showReceipt};
})(window);
