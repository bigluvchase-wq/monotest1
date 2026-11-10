(function(root){
'use strict';
// Напоминания и платежи на главной. Одна или две карточки — по центру, листаются свайпом.
// Три и больше — выбранная всегда по центру, соседние справа и слева в лёгком размытии, лента зациклена.
const chev=d=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function mount(box){
 if(!box)return;
 if(box._remCleanup){box._remCleanup();box._remCleanup=null;}
 const cards=[...box.querySelectorAll(':scope>.reminder')];
 if(cards.length<2){box.classList.remove('has-carousel','rem-peek','rem-solo');return;}
 const n=cards.length,loop=n>=3,peek=loop;
 box.classList.add('has-carousel');box.classList.toggle('rem-peek',peek);box.classList.toggle('rem-solo',!peek);
 const wrap=document.createElement('div');wrap.className='rem-carousel';
 const stage=document.createElement('div');stage.className='rem-stage';
 const prev=document.createElement('button');prev.type='button';prev.className='rem-arrow prev';prev.setAttribute('aria-label','Предыдущее');prev.innerHTML=chev('M15 5l-7 7 7 7');
 const next=document.createElement('button');next.type='button';next.className='rem-arrow next';next.setAttribute('aria-label','Следующее');next.innerHTML=chev('M9 5l7 7-7 7');
 cards.forEach(c=>stage.append(c));wrap.append(stage,prev,next);box.append(wrap);
 let cur=0,drag=0,step=300,dragging=false,anim=true;
 const rel=(i,f)=>{
  if(!loop)return i-cur+f;
  const half=n/2;let p=i-cur+f;p=((p+half)%n+n)%n-half;return p;
 };
 function paint(prevPos){
  cards.forEach((el,i)=>{
   const pos=rel(i,drag),a=Math.abs(pos);
   let op,sc,bl;
   if(peek){op=a<=1?1-.5*a:Math.max(0,.5-(a-1));sc=1-.07*Math.min(1,a);bl=Math.min(1,a)*2;}
   else{op=Math.max(0,1-1.6*a);sc=1-.05*Math.min(1,a);bl=0;}
   const wrapped=prevPos&&Math.abs(pos-prevPos[i])>n/2+.01&&loop;
   el.style.transition=(!anim||dragging||wrapped)?'none':'transform .46s cubic-bezier(.25,.8,.3,1),opacity .46s ease,filter .46s ease';
   el.style.transform=`translateX(calc(-50% + ${(pos*step).toFixed(1)}px)) scale(${sc.toFixed(3)})`;
   el.style.opacity=op.toFixed(3);
   el.style.filter=bl>.02?`blur(${bl.toFixed(2)}px)`:'none';
   el.style.zIndex=String(100-Math.round(a*10));
   el.style.pointerEvents=a>1.2?'none':'';
   el.dataset.pos=pos.toFixed(2);
  });
  prev.classList.toggle('off',!loop&&cur===0);next.classList.toggle('off',!loop&&cur===n-1);
 }
 function snapshot(){return cards.map((_,i)=>rel(i,drag));}
 function setIndex(i){
  const before=snapshot();
  cur=loop?((i%n)+n)%n:clamp(i,0,n-1);drag=0;
  paint(before.map((p,k)=>p-(loop?0:0)));
 }
 function measure(){
  const w=cards[0].offsetWidth||250,h=Math.max(...cards.map(c=>c.offsetHeight));
  step=w+(peek?10:30);stage.style.height=h+'px';
 }
 measure();
 // первое отображение без анимации
 anim=false;paint();requestAnimationFrame(()=>{anim=true;});
 const go=d=>{setIndex(cur+d);};
 prev.onclick=e=>{e.stopPropagation();go(-1);};next.onclick=e=>{e.stopPropagation();go(1);};
 // свайп
 let g=null,moved=false;
 const down=e=>{moved=false;if(e.button>0||e.target.closest('.rem-arrow'))return;g={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),lock:null};};
 const move=e=>{
  if(!g||e.pointerId!==g.id)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.lock){if(Math.abs(dx)<6&&Math.abs(dy)<6)return;g.lock=Math.abs(dx)>Math.abs(dy)?'x':'y';if(g.lock==='x'){try{stage.setPointerCapture(e.pointerId);}catch{}dragging=true;}}
  if(g.lock!=='x')return;
  moved=true;if(e.cancelable)e.preventDefault();
  let f=dx/step;if(!loop){const lim=cur===0&&f>0||cur===n-1&&f<0;if(lim)f*=.3;}
  drag=clamp(f,-1.2,1.2);paint();
 };
 const up=e=>{
  if(!g||e.pointerId!==g.id)return;
  const was=g.lock==='x',dx=e.clientX-g.x,v=dx/Math.max(1,performance.now()-g.t);g=null;
  if(!was)return;
  dragging=false;
  const before=snapshot();
  let d=0;if(Math.abs(dx)>step*.28||Math.abs(v)>.45)d=dx<0?1:-1;
  const target=loop?cur+d:clamp(cur+d,0,n-1);
  // продолжаем с текущего положения без скачка
  cur=loop?((target%n)+n)%n:target;
  // пересчитываем drag так, чтобы позиции остались прежними, затем плавно к нулю
  drag=-0;paintFrom(before);
 };
 function paintFrom(before){
  // выставляем позиции «как были», затем в следующем кадре — на место с анимацией
  const now=snapshot();
  cards.forEach((el,i)=>{el.style.transition='none';});
  anim=true;requestAnimationFrame(()=>paint(before));
 }
 stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move,{passive:false});
 stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
 // клик по соседней карточке выводит её в центр, а не открывает
 const click=e=>{
  if(moved){e.stopPropagation();e.preventDefault();moved=false;return;}
  const el=e.target.closest('.reminder');if(!el||!stage.contains(el))return;
  const pos=Number(el.dataset.pos||0);
  if(Math.abs(pos)>.5){e.stopPropagation();e.preventDefault();go(Math.round(pos));}
 };
 box.addEventListener('click',click,true);
 const onResize=()=>{measure();anim=false;paint();requestAnimationFrame(()=>{anim=true;});};
 addEventListener('resize',onResize);
 box._remCleanup=()=>{box.removeEventListener('click',click,true);removeEventListener('resize',onResize);};
}
root.MonoReminderCarousel={mount};
})(window);
