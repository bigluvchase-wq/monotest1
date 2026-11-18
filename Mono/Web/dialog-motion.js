/* A real dialog grows from its actual trigger; no page clones or fake background panels. */
(function(root){
'use strict';
const M=root.MonoMotion,P=HTMLDialogElement.prototype,show=P.showModal,close=P.close,open=Object.getOwnPropertyDescriptor(P,'open');
const states=new WeakMap(),bound=new WeakSet();let recent=null,recentTimer;
const rawOpen=d=>open.get.call(d),special=d=>['chartDialog','onboarding','lockDialog','homeAccountDialog'].includes(d.id);
function remember(event){const el=event.target.closest?.('button,a,[role=button]');if(!el||el.matches('#closeEntry,#closeAction,.period-close,[data-home-account-close]'))return;const r=el.getBoundingClientRect();if(!r.width||!r.height)return;clearTimeout(recentTimer);recent={el,rect:r,radius:parseFloat(getComputedStyle(el).borderTopLeftRadius)||12};recentTimer=setTimeout(()=>{recent=null;},900);}
for(const type of ['pointerup','click'])document.addEventListener(type,remember,{capture:true});
function restore(s){if(s?.hidden){s.origin.el.style.visibility=s.visibility;s.hidden=false;}}
function cleanup(d){const s=states.get(d);if(!s)return;states.delete(d);cancelAnimationFrame(s.frame);s.animations.forEach(a=>a.cancel());restore(s);d._closing=false;d._exit=null;d.classList.remove('closing');delete d.dataset.motionOwned;delete d.dataset.motionEntering;delete d.dataset.motionDirection;}
function play(s,el,frames,options){const a=el.animate(frames,options);a.finished.catch(()=>{});s.animations.push(a);return a;}
function geometry(d,origin){const r=d.getBoundingClientRect();if(!origin||!r.width||!r.height)return null;const from=origin.el.isConnected?origin.el.getBoundingClientRect():origin.rect;if(!from.width||!from.height)return null;const sx=Math.max(.03,Math.min(1.2,from.width/r.width)),sy=Math.max(.03,Math.min(1.2,from.height/r.height));return {transform:`translate(${from.left+from.width/2-r.left-r.width/2}px,${from.top+from.height/2-r.top-r.height/2}px) scale(${sx},${sy})`,radius:`${origin.radius/sx}px / ${origin.radius/sy}px`,side:from.top+from.height/2<r.top+r.height/2?'from-top':'from-bottom'};}
Object.defineProperty(P,'open',{configurable:true,enumerable:true,get(){return rawOpen(this)&&!this._closing;},set(v){open.set.call(this,v);}});
P.showModal=function(){
 const d=this;if(special(d)||d.dataset.enter==='swipe'){recent=null;clearTimeout(recentTimer);return show.call(d);}if(rawOpen(d)&&!d._closing)return;
 const recovering=rawOpen(d),current=recovering?getComputedStyle(d):null,start=recovering?{opacity:current.opacity,transform:current.transform,borderRadius:current.borderRadius}:null;
 const previous=states.get(d)?.origin;cleanup(d);const origin=d.id==='actionDialog'?null:(recent||previous);recent=null;clearTimeout(recentTimer);
 d.dataset.motionOwned='true';d.dataset.motionEntering='true';d._closing=false;const s={origin,hidden:false,visibility:'',animations:[],frame:0};states.set(d,s);
 if(!recovering)show.call(d);
 if(!bound.has(d)){bound.add(d);d.addEventListener('cancel',e=>{if(!e.defaultPrevented&&!special(d)){e.preventDefault();d.close();}});d.addEventListener('close',()=>{if(!rawOpen(d))cleanup(d);});}
 const g=geometry(d,origin),radius=getComputedStyle(d).borderRadius;
 if(g)d.dataset.motionDirection=g.side;
 if(origin?.el.isConnected){s.visibility=origin.el.style.visibility;origin.el.style.visibility='hidden';s.hidden=true;}
 // Force a single initial backdrop style, then let opacity transition on the next frame.
 getComputedStyle(d,'::backdrop').opacity;s.frame=requestAnimationFrame(()=>{if(states.get(d)===s)delete d.dataset.motionEntering;});
 if(M.reduced){delete d.dataset.motionEntering;return;}
 const frames=start?[start,{opacity:1,transform:'none',borderRadius:radius}]:g?[{opacity:.12,transform:g.transform,borderRadius:g.radius},{opacity:1,transform:'none',borderRadius:radius}]:[{opacity:0,transform:'translateY(18px) scale(.985)'},{opacity:1,transform:'none'}];
 play(s,d,frames,{duration:d.id==='actionDialog'?M.duration.formOpen:M.duration.modal,easing:M.ease.enter});
 if(d.id!=='actionDialog')[...d.children].filter(el=>!el.matches('script,style,#toast')).slice(0,7).forEach((el,i)=>play(s,el,[{opacity:0,transform:`translateY(${g?.side==='from-top'?-6:6}px)`},{opacity:1,transform:'none'}],{duration:M.duration.feedback,delay:M.duration.modal*.35+i*M.duration.stagger,easing:M.ease.enter,fill:'backwards'}));
};
P.close=function(value){
 const d=this;if(!rawOpen(d)||d._closing)return;
 const raw=()=>{if(value===undefined)close.call(d);else close.call(d,value);};
 if(special(d)||d.dataset.saveWave==='true'||M.reduced){cleanup(d);raw();return;}
 const current=getComputedStyle(d),start={opacity:current.opacity,transform:current.transform,borderRadius:current.borderRadius},parts=[...d.children].filter(el=>!el.matches('script,style,#toast')).slice(0,7).map(el=>[el,getComputedStyle(el).opacity]),s=states.get(d)||{origin:null,hidden:false,animations:[],frame:0};
 s.animations.forEach(a=>a.cancel());s.animations=[];cancelAnimationFrame(s.frame);states.set(d,s);
 const g=geometry(d,s.origin);d._closing=true;d.classList.add('closing');delete d.dataset.motionEntering;
 const animation=play(s,d,[start,g?{opacity:.05,transform:g.transform,borderRadius:g.radius}:{opacity:0,transform:d.id==='actionDialog'?'translateY(18px) scale(.985)':'translateY(12px) scale(.985)'}],{duration:d.id==='actionDialog'?M.duration.formClose:M.duration.exit,delay:d.id==='actionDialog'?0:40,easing:M.ease.exit,fill:'forwards'});
 d._exit=animation;
 if(d.id!=='actionDialog')parts.forEach(([el,opacity])=>play(s,el,[{opacity},{opacity:0}],{duration:M.duration.micro,easing:M.ease.exit,fill:'forwards'}));
 animation.finished.catch(()=>{}).then(()=>{if(states.get(d)!==s||!d._closing)return;restore(s);raw();cleanup(d);});
};
function finish(){document.querySelectorAll('dialog[data-motion-owned]').forEach(d=>{const s=states.get(d);s?.animations.forEach(a=>{if(a.playState!=='finished'&&a.playState!=='idle')a.finish();});});}
addEventListener('resize',finish);document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',finish);
root.MonoDialogMotion={isOwned:d=>states.has(d)};
})(window);
