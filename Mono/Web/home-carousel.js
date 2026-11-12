(function(root){
'use strict';
// Напоминания и платежи на главной. Выбранная карточка по центру, соседние справа и слева
// видны в лёгком размытии. Листается свайпом и стрелками; от трёх карточек лента зациклена.
const chev=d=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let remembered=0;
function mount(box){
 if(!box)return;
 box._remCleanup?.();box._remCleanup=null;
 const cards=[...box.querySelectorAll(':scope>.reminder')];
 box.classList.toggle('has-carousel',cards.length>1);
 if(cards.length<2){box.classList.remove('rem-peek');return;}
 const n=cards.length,loop=n>=3;
 box.classList.add('rem-peek');
 const wrap=document.createElement('div');wrap.className='rem-carousel';
 const stage=document.createElement('div');stage.className='rem-stage';
 const prev=document.createElement('button');prev.type='button';prev.className='rem-arrow prev';prev.setAttribute('aria-label','Предыдущее напоминание');prev.innerHTML=chev('M14.5 6l-6 6 6 6');
 const next=document.createElement('button');next.type='button';next.className='rem-arrow next';next.setAttribute('aria-label','Следующее напоминание');next.innerHTML=chev('M9.5 6l6 6-6 6');
 const dots=document.createElement('div');dots.className='rem-dots';dots.setAttribute('aria-hidden','true');dots.innerHTML=cards.map(()=>'<i></i>').join('');
 cards.forEach(c=>stage.append(c));wrap.append(stage,prev,next);box.append(wrap,dots);
 let cur=clamp(remembered,0,n-1),drag=0,step=300,dragging=false;
 const rel=i=>{let p=i-cur+drag;if(loop){const half=n/2;p=((p+half)%n+n)%n-half;}return p;};
 function paint(animate){
  cards.forEach((el,i)=>{
   const pos=rel(i),a=Math.abs(pos),near=Math.min(1,a);
   const op=a<=1?1-.42*a:Math.max(0,.58-(a-1)*.9),sc=1-.08*near,bl=near*3.2;
   el.style.transition=animate&&!dragging&&!reducedMotion()?'transform .5s cubic-bezier(.22,1,.36,1),opacity .5s ease,filter .5s ease':'none';
   el.style.transform=`translateX(calc(-50% + ${(pos*step).toFixed(1)}px)) scale(${sc.toFixed(3)})`;
   el.style.opacity=op.toFixed(3);
   el.style.filter=bl>.05?`blur(${bl.toFixed(2)}px)`:'none';
   el.style.zIndex=String(100-Math.round(a*10));
   el.tabIndex=a<.5?0:-1;el.setAttribute('aria-hidden',a<.5?'false':'true');
   el.dataset.pos=pos.toFixed(2);
  });
  prev.classList.toggle('off',!loop&&cur===0);next.classList.toggle('off',!loop&&cur===n-1);
  [...dots.children].forEach((d,i)=>d.classList.toggle('on',i===cur));
 }
 function measure(){const w=cards[0].offsetWidth||260,h=Math.max(...cards.map(c=>c.offsetHeight));step=w+12;stage.style.height=h+'px';}
 function go(d){const before=cards.map((_,i)=>rel(i));cur=loop?((cur+d)%n+n)%n:clamp(cur+d,0,n-1);remembered=cur;
  // при переходе через край ленты карточка перескакивает без анимации
  cards.forEach((el,i)=>{if(loop&&Math.abs(rel(i)-before[i])>1.5)el.style.transition='none';});
  paint(true);}
 measure();paint(false);
 prev.onclick=e=>{e.stopPropagation();go(-1);};next.onclick=e=>{e.stopPropagation();go(1);};
 // Свайп
 let g=null,moved=false;
 const down=e=>{moved=false;if(e.button>0||e.target.closest('.rem-arrow'))return;g={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),lock:null};};
 const move=e=>{
  if(!g||e.pointerId!==g.id)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.lock){if(Math.abs(dx)<6&&Math.abs(dy)<6)return;g.lock=Math.abs(dx)>Math.abs(dy)?'x':'y';if(g.lock==='x'){try{stage.setPointerCapture(e.pointerId);}catch{}dragging=true;}}
  if(g.lock!=='x')return;
  moved=true;if(e.cancelable)e.preventDefault();
  let f=dx/step;if(!loop&&(cur===0&&f>0||cur===n-1&&f<0))f*=.3;
  drag=clamp(f,-1.2,1.2);paint(false);
 };
 const up=e=>{
  if(!g||e.pointerId!==g.id)return;
  const was=g.lock==='x',dx=e.clientX-g.x,v=dx/Math.max(1,performance.now()-g.t);g=null;
  if(!was)return;
  dragging=false;
  const d=Math.abs(dx)>step*.25||Math.abs(v)>.4?(dx<0?1:-1):0;
  // продолжаем с текущего положения: drag переносится в индекс без скачка
  const before=cards.map((_,i)=>rel(i));
  drag=0;cur=loop?((cur+d)%n+n)%n:clamp(cur+d,0,n-1);remembered=cur;
  cards.forEach((el,i)=>{el.style.transition='none';const p=before[i],a=Math.abs(p);el.style.transform=`translateX(calc(-50% + ${(p*step).toFixed(1)}px)) scale(${(1-.08*Math.min(1,a)).toFixed(3)})`;});
  void stage.offsetWidth;
  cards.forEach((el,i)=>{if(loop&&Math.abs(rel(i)-before[i])>1.5)el.dataset.jump='1';});
  paint(true);
  cards.forEach(el=>{if(el.dataset.jump){el.style.transition='none';delete el.dataset.jump;}});
 };
 stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move,{passive:false});
 stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
 stage.addEventListener('touchmove',e=>{if(g?.lock==='x'&&e.cancelable)e.preventDefault();},{passive:false});
 // нажатие на соседнюю карточку выводит её в центр, а не открывает
 const click=e=>{
  if(moved){e.stopPropagation();e.preventDefault();moved=false;return;}
  const el=e.target.closest('.reminder');if(!el||!stage.contains(el))return;
  const pos=Number(el.dataset.pos||0);
  if(Math.abs(pos)>.5){e.stopPropagation();e.preventDefault();go(Math.round(pos));}
 };
 box.addEventListener('click',click,true);
 const onResize=()=>{measure();paint(false);};
 addEventListener('resize',onResize);
 box._remCleanup=()=>{box.removeEventListener('click',click,true);removeEventListener('resize',onResize);};
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
