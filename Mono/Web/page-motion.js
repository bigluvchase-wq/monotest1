(function(root){
'use strict';
const app=document.querySelector('.app'),nav=document.querySelector('.bottom-nav'),buttons=[...nav.querySelectorAll('[data-nav]')],slider=document.createElement('span');
slider.className='nav-slider';slider.setAttribute('aria-hidden','true');nav.prepend(slider);
let stage=null,busy=false,navGesture=null,suppressUntil=0;
const BLUR=window.MONO_PAGE_BLUR===false?0:16,ease='cubic-bezier(.22,1,.36,1)',clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
function indicator(index,animate=true){const first=buttons[0].getBoundingClientRect(),last=buttons[1].getBoundingClientRect(),r=nav.getBoundingClientRect();slider.style.width=first.width+'px';slider.style.left=(first.left-r.left)+'px';slider.style.transition=animate&&!reducedMotion()?'transform 420ms '+ease:'none';slider.style.transform=`translateX(${(last.left-first.left)*index}px)`;buttons.forEach((button,i)=>{button.classList.toggle('nav-highlight',i===Math.round(index));button.style.transition=animate&&!reducedMotion()?'color 420ms '+ease:'none';});}
function sync(){if(!stage&&!navGesture)indicator(Math.max(0,rootPages.indexOf(page)),true);if(!stage&&!busy)warmUp();}
// Preview nodes are inert and contain no live form handlers or duplicate IDs.
function mirrorStyles(){if(document.querySelector('#previewRootStyles'))return;let css='';function visit(rules){let result='';for(const rule of rules){if(rule.selectorText&&(/#[a-zA-Z_]|body\[data-page/.test(rule.selectorText))){const selector=rule.selectorText.replace(/#([\w-]+)/g,'[data-preview-id="$1"]').replace(/body(?=\[data-page)/g,'.root-preview');result+=selector+'{'+rule.style.cssText+'}';}else if(rule.cssRules&&rule.conditionText){const head=rule.cssText.slice(0,rule.cssText.indexOf('{'));result+=head+'{'+visit(rule.cssRules)+'}';}}return result;}for(const sheet of document.styleSheets){try{css+=visit(sheet.cssRules);}catch{}}const style=document.createElement('style');style.id='previewRootStyles';style.textContent=css;document.head.append(style);}
function mountPreview(target,clone){
 mirrorStyles();
 const layer=document.createElement('div');
 layer.className='root-preview';layer.dataset.page=target;layer.inert=true;layer.setAttribute('aria-hidden','true');
 clone.querySelectorAll('[id]').forEach(el=>{el.dataset.previewId=el.id;el.removeAttribute('id');});
 clone.querySelectorAll('label[for]').forEach(el=>el.removeAttribute('for'));
 layer.append(clone);document.body.append(layer);
 return layer;
}
function preview(target){
 const clone=app.cloneNode(false);clone.style.cssText='';clone.append(app.querySelector('header').cloneNode(true));
 if(target==='home'){
  const home=document.querySelector('#home').cloneNode(true);home.hidden=false;
  clone.append(home,app.querySelector('footer').cloneNode(true));
 }else{
  const workspace=document.createElement('section');
  workspace.id='workspace';workspace.innerHTML='<div class="page-head"><h1></h1></div><div id="pageBody">'+(target==='history'?renderOperations():renderMenu())+'</div>';
  clone.append(workspace);
 }
 return mountPreview(target,clone);
}
// Заранее собранные превью соседних страниц: слой уже растеризован и размыт, поэтому при свайпе
// он появляется сразу, а не через секунду после начала жеста (WKWebView рисует новые слои с задержкой).
const warm={};let warmTimer=0,warmEpoch=0;
function dropWarm(){for(const k of Object.keys(warm)){warm[k].remove();delete warm[k];}}
function invalidate(){warmEpoch++;clearTimeout(warmTimer);dropWarm();if(!stage&&!busy)warmUp();}
function warmUp(delay=650){clearTimeout(warmTimer);if(reducedMotion())return;const epoch=warmEpoch;warmTimer=setTimeout(()=>{
 if(epoch!==warmEpoch||stage||busy||navGesture||document.hidden||tourActive||holding||listening||document.querySelector('dialog[open]'))return;
 if(!rootPages.includes(page)){dropWarm();return;}
 for(const t of rootPages){if(t===page||warm[t])continue;try{const l=preview(t),inner=l.firstElementChild;l.style.opacity='0.001';l.style.transform='translateX(0)';if(BLUR){inner.style.filter=`blur(${BLUR}px)`;inner.style.willChange='filter';}warm[t]=l;}catch{}}
},delay);}
function takeWarm(target){const l=warm[target];if(!l)return null;delete warm[target];l.style.opacity='';return l;}
function begin(target){if(busy||!rootPages.includes(page)||!rootPages.includes(target)||target===page)return false;if(stage?.target===target)return true;if(stage)clean();const sign=rootPages.indexOf(target)>rootPages.indexOf(page)?1:-1;stage={target,sign,layer:takeWarm(target)||preview(target),dx:0};{const L=stage.layer,inner=L.firstElementChild;L.style.transform=`translateX(${sign*innerWidth}px)`;L.style.willChange='transform';if(BLUR){inner.style.filter=`blur(${BLUR}px)`;inner.style.willChange='filter';}}document.body.classList.add('root-dragging');app.style.position='relative';app.style.zIndex='9';return true;}
function drag(dx){if(!stage)return;stage.dx=dx;const p=clamp(Math.abs(dx)/innerWidth);app.style.transform=`translateX(${dx}px)`;stage.layer.style.transform=`translateX(${stage.sign*innerWidth+dx}px)`;if(BLUR){const inner=stage.layer.firstElementChild;inner.style.filter=p>=.995?'none':`blur(${(Math.pow(1-p,1.6)*BLUR).toFixed(2)}px)`;}const from=rootPages.indexOf(page),to=rootPages.indexOf(stage.target);indicator(from+(to-from)*p,false);}
function clean(){
 stage?.layer.remove();stage=null;dropWarm();
 app.style.transform='';app.style.opacity='';app.style.position='';app.style.zIndex='';app.style.background='';app.style.filter='';app.inert=false;
 document.body.classList.remove('root-dragging');busy=false;
}
async function settle(commit=true){
 const s=stage;if(!s||busy)return;
 busy=true;
 const start=s.dx,edge=s.sign*innerWidth,fromFilter=s.layer.firstElementChild.style.filter||'none';
 let outgoing=app,incoming=s.layer;
 if(commit){
  const clone=app.cloneNode(true);
  clone.style.cssText=`margin-top:${-window.scrollY}px`;
  outgoing=mountPreview(page,clone);
  navigate(s.target,{noPageMotion:true,noAnimation:true});
  s.layer.remove();s.layer=outgoing;
  incoming=app;
 }
 app.inert=true;
 const duration=reducedMotion()?0:commit?Math.round(325+145*(1-clamp(Math.abs(start)/innerWidth))):330;
 const slide=(el,from,to)=>el.animate([{transform:`translateX(${from}px)`},{transform:`translateX(${to}px)`}],{duration,easing:ease,fill:'both'});
 s.animations=[slide(outgoing,start,commit?-edge:0),slide(incoming,edge+start,commit?0:edge)];
 if(BLUR){
  const content=commit?incoming:incoming.firstElementChild;
  s.animations.push(content.animate([{filter:fromFilter},{filter:commit?'blur(0px)':`blur(${BLUR}px)`}],{duration,easing:ease,fill:'both'}));
 }
 indicator(rootPages.indexOf(page),true);
 await Promise.allSettled(s.animations.map(animation=>animation.finished));
 if(stage!==s)return;
 clean();
 s.animations.forEach(animation=>animation.cancel());
 sync();
}
function cancel(){if(stage){stage.animations?.forEach(a=>a.cancel());clean();}navGesture=null;sync();}
function go(target){if(busy)return;if(reducedMotion()){navigate(target,{noPageMotion:true,noAnimation:true});sync();return;}if(begin(target)){drag(0);settle(true);}}
nav.style.touchAction='none';
nav.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0||busy||tourActive||holding||listening||document.querySelector('dialog[open]'))return;navGesture={id:e.pointerId,x:e.clientX,startIndex:rootPages.indexOf(page),index:rootPages.indexOf(page),dragged:false};},{passive:true});
nav.addEventListener('pointermove',e=>{const g=navGesture;if(!g||g.id!==e.pointerId)return;if(!g.dragged&&Math.abs(e.clientX-g.x)<7)return;g.dragged=true;nav.setPointerCapture?.(e.pointerId);const r=nav.getBoundingClientRect(),fraction=clamp((e.clientX-r.left-r.width/6)/(r.width/3),0,2);g.index=Math.round(fraction);indicator(fraction,false);if(e.cancelable)e.preventDefault();},{passive:false});
nav.addEventListener('pointerup',e=>{const g=navGesture;if(!g||g.id!==e.pointerId)return;navGesture=null;if(!g.dragged)return;suppressUntil=performance.now()+450;const target=rootPages[g.index];if(target===page){sync();return;}go(target);},{passive:true});
nav.addEventListener('pointercancel',()=>{navGesture=null;if(stage&&!busy)settle(false);else sync();},{passive:true});
nav.addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
window.addEventListener('resize',()=>{cancel();invalidate();});window.addEventListener('pagehide',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});root.MonoPageMotion={begin,drag,settle,cancel,go,sync,invalidate,isBusy:()=>busy};sync();
})(window);
