(function(root){
'use strict';
// Напоминания и платежи на главной. Выбранная карточка по центру, соседние справа и слева
// приглушены. Листается свайпом и стрелками; от трёх карточек лента зациклена.
const chev=d=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let remembered=0;
function mount(box){
 if(!box)return;
 box._remCleanup?.();
 const cards=[...box.querySelectorAll(':scope>.reminder')];
 box.classList.toggle('has-carousel',cards.length>1);
 box.classList.toggle('rem-peek',cards.length>1);
 if(cards.length<2)return;
 const wrap=document.createElement('div');wrap.className='rem-carousel';
 const stage=document.createElement('div');stage.className='rem-stage rem-native';
 stage.setAttribute('role','region');stage.setAttribute('aria-label','Напоминания');
 const arrow=(label,d)=>{const el=document.createElement('button');el.type='button';el.className='rem-arrow '+(d<0?'prev':'next');el.setAttribute('aria-label',label);el.innerHTML=chev(d<0?'M14.5 6l-6 6 6 6':'M9.5 6l6 6-6 6');return el;};
 const prev=arrow('Предыдущее напоминание',-1),next=arrow('Следующее напоминание',1);
 const dots=document.createElement('div');dots.className='rem-dots';dots.setAttribute('aria-hidden','true');dots.innerHTML=cards.map(()=>'<i></i>').join('');
 cards.forEach(c=>stage.append(c));wrap.append(stage,prev,next);box.append(wrap,dots);
 let cur=clamp(remembered,0,cards.length-1),timer;
 const offset=i=>cards[i].offsetLeft-(stage.clientWidth-cards[i].offsetWidth)/2;
 function mark(){prev.disabled=cur===0;next.disabled=cur===cards.length-1;[...dots.children].forEach((d,i)=>d.classList.toggle('on',i===cur));remembered=cur;}
 function go(i,smooth=true){cur=clamp(i,0,cards.length-1);stage.scrollTo({left:offset(cur),behavior:smooth&&!reducedMotion()?'smooth':'instant'});mark();}
 prev.onclick=()=>go(cur-1);next.onclick=()=>go(cur+1);
 stage.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();go(cur+(e.key==='ArrowRight'?1:-1));}});
 // Let WebKit own scrolling and inertia; no pointer capture or per-frame transforms.
 let start=null,moved=false;
 stage.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};moved=false;},{passive:true});
 stage.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)moved=true;},{passive:true});
 stage.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopImmediatePropagation();moved=false;}},true);
 stage.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(()=>{cur=cards.reduce((best,c,i)=>Math.abs(offset(i)-stage.scrollLeft)<Math.abs(offset(best)-stage.scrollLeft)?i:best,0);mark();},80);},{passive:true});
 const resize=()=>go(cur,false);addEventListener('resize',resize);go(cur,false);
 box._remCleanup=()=>{clearTimeout(timer);removeEventListener('resize',resize);};
}
// Появление блока последним после заставки
function reveal(box){
 if(!box||!box.classList.contains('rem-waiting'))return;
 box.classList.remove('rem-waiting');
 if(reducedMotion()||!box.children.length)return;
 box.animate([{opacity:0,transform:'translateY(22px) scale(.97)'},{opacity:1,transform:'none'}],{duration:560,easing:'cubic-bezier(.22,1,.36,1)'});
}
// Когда блок напоминаний меняет высоту, остальное на главной плавно сдвигается, без прыжка
(function smoothHome(){
 const home=document.querySelector('#home'),box=document.querySelector('#homeReminders');
 if(!home||!box||typeof ResizeObserver!=='function')return;
 // и сами блоки главной, и то, что внутри блока записи (микрофон, выбор счёта, клавиатура)
 const movers=()=>[...home.children].filter(el=>el!==box&&!el.hidden).flatMap(el=>el.classList.contains('recording-block')?[...el.children]:[el]);
 let last=null,lastHeight=null;
 const snap=()=>{last=new Map(movers().map(el=>[el,el.getBoundingClientRect().top]));lastHeight=box.offsetHeight;};
 new ResizeObserver(()=>{
  const h=box.offsetHeight;
  if(last&&lastHeight!==null&&h!==lastHeight&&page==='home'&&!home.hidden&&!reducedMotion()){
   // translate не конфликтует с transform (--home-shift), поэтому оба сдвига складываются плавно
   for(const el of movers()){const before=last.get(el);if(before===undefined)continue;const dy=before-el.getBoundingClientRect().top;if(Math.abs(dy)>.5)el.animate([{translate:`0 ${dy}px`},{translate:'0 0'}],{duration:620,easing:'cubic-bezier(.22,1,.36,1)'});}
   if(h>lastHeight&&!box.classList.contains('rem-waiting'))box.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'none'}],{duration:620,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  snap();
 }).observe(box);
 addEventListener('resize',()=>requestAnimationFrame(snap));
 root.MonoHomeSnap=()=>{if(!home.hidden)snap();};
})();
root.MonoHomeCarousel={mount,reveal};
// Модули напоминаний подключаются после app.js — перерисовываем главную, когда всё готово
if(typeof renderHomeReminders==='function')renderHomeReminders();
})(window);
