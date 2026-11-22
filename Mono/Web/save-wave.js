/* Native snapshot handshake: persist runs exactly once, independently of animation success. */
(function(root){
'use strict';
let current=null,sequence=0;
const enabled=()=>root.MONO_CONFIG?.effects?.saveWave!==false&&root.MonoNative?.saveWaveSupported===true;
function run(button,commit){
 if(current)return;
 root.MonoNative?.saveFeedback?.();
 if(!enabled()){commit();return;}
 const id=String(++sequence),session={id,commit,done:false,timer:null,button,panel:button.closest('dialog')};current=session;button.disabled=true;
 document.activeElement?.blur?.();
 if(session.panel)session.panel.inert=true;
 const prepare=()=>{
  if(current!==session)return;
  const r=button.getBoundingClientRect();session.timer=setTimeout(()=>ready(id,false),900);
  const theme=getComputedStyle(document.documentElement),accent=theme.getPropertyValue('--accent').trim(),secondary=theme.getPropertyValue('--accent-2').trim()||accent;
  const p=session.panel?.getBoundingClientRect(),panel=p?{x:p.x,y:p.y,width:p.width,height:p.height,cornerRadius:parseFloat(getComputedStyle(session.panel).borderTopLeftRadius)||0}:null;
  try{MonoNative.prepareSaveWave({id,source:{x:r.x,y:r.y,width:r.width,height:r.height},panel,viewport:{width:innerWidth,height:innerHeight},accent,secondary});}catch{ready(id,false);}
 };
 prepare();
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
function simple(button,commit,{feedback=true}={}){
 if(current||button.disabled)return;
 const panel=button.closest('dialog');button.disabled=true;let saved=false;
 try{saved=commit(false)===true;}catch(error){notify(error.message||'Не удалось сохранить запись.');}
 if(!saved)button.disabled=false;
 else{
  if(feedback)root.MonoNative?.saveFeedback?.();
  if(panel&&(panel.open||panel.hasAttribute?.('open')))panel.addEventListener('close',()=>{button.disabled=false;},{once:true});
  else button.disabled=false;
 }
}
function confirm(panel,message){
 panel.inert=true;const clear=showReceipt(panel,message),receipt=panel.querySelector('.save-wave-receipt'),M=root.MonoMotion;
 const animation=receipt.animate(M?.reduced?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(4px) scale(.98)'},{opacity:1,transform:'none'}],{duration:M?.reduced?M.duration.reduced:(M?.duration.feedback||180),easing:M?.ease.enter||'ease-out'});
 animation.finished.catch(()=>{}).then(()=>dismissReceipt(panel,clear));
}
function dismissReceipt(panel,clear){
 if(!panel.open){const finish=()=>{panel.inert=false;requestAnimationFrame(()=>requestAnimationFrame(clear));};if(panel.hasAttribute('open'))panel.addEventListener('close',finish,{once:true});else finish();return;}
 panel.inert=true;panel.dataset.saveDismissing='true';
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 const animation=panel.animate(reduced?[{opacity:1},{opacity:0}]:[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(20px) scale(.985)'}],{duration:reduced?(root.MonoMotion?.duration.reduced||100):(root.MonoMotion?.duration.exit||240),easing:root.MonoMotion?.ease.exit||'ease-out',fill:'forwards'});
 animation.finished.catch(()=>{}).then(()=>{
  panel.dataset.saveWave='true';panel.close();delete panel.dataset.saveWave;
  animation.cancel();delete panel.dataset.saveDismissing;panel.inert=false;
  // Keep old inputs hidden until WebKit has painted the closed top-layer dialog.
  requestAnimationFrame(()=>requestAnimationFrame(clear));
 });
}
function showReceipt(panel,message){
 const receipt=document.createElement('div');receipt.className='save-wave-receipt';receipt.setAttribute('role','status');
 receipt.style.top=panel.scrollTop+'px';receipt.style.height=panel.clientHeight+'px';
 receipt.innerHTML='<span class="save-wave-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span><h2></h2><p></p>';
 receipt.querySelector('h2').textContent=message.startsWith('Платёж')?'Платёж сохранён':'Записано';
 receipt.querySelector('p').textContent=message.startsWith('Платёж')?'Всё на своих местах.':message.replace(/^Записано\.\s*/,'');panel.append(receipt);panel.classList.add('save-wave-sent');
 return ()=>{receipt.remove();panel.classList.remove('save-wave-sent');};
}
root.MonoSaveWave={run,simple,confirm,ready,finished,afterFinish,showReceipt,dismissReceipt};
})(window);
