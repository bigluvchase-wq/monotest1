(function(root){
'use strict';
// Напоминания и платежи на главной: если их несколько — горизонтальная лента со «снэпом»,
// центральная карточка видна целиком, соседние частично и бледнее; по бокам стрелки.
const chev=d=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
function mount(box){
 if(!box)return;
 const cards=[...box.querySelectorAll(':scope>.reminder')];
 if(cards.length<2){box.classList.remove('has-carousel');return;}
 box.classList.add('has-carousel');
 const wrap=document.createElement('div');wrap.className='rem-carousel';
 const prev=document.createElement('button');prev.type='button';prev.className='rem-arrow prev';prev.setAttribute('aria-label','Предыдущее напоминание');prev.innerHTML=chev('M15 5l-7 7 7 7');
 const next=document.createElement('button');next.type='button';next.className='rem-arrow next';next.setAttribute('aria-label','Следующее напоминание');next.innerHTML=chev('M9 5l7 7-7 7');
 const track=document.createElement('div');track.className='rem-track';
 cards.forEach(c=>track.append(c));
 wrap.append(track,prev,next);box.append(wrap);
 let raf=0;
 function paint(){
  raf=0;
  const w=track.clientWidth,c=track.scrollLeft+w/2;
  let nearest=0,best=1e9;
  cards.forEach((el,i)=>{
   const mid=el.offsetLeft+el.offsetWidth/2,d=Math.min(1.4,Math.abs(mid-c)/(el.offsetWidth+10));
   if(Math.abs(mid-c)<best){best=Math.abs(mid-c);nearest=i;}
   el.style.opacity=String(1-.62*Math.min(1,d));
   el.style.transform=`scale(${1-.07*Math.min(1,d)})`;
  });
  prev.classList.toggle('off',nearest===0);next.classList.toggle('off',nearest===cards.length-1);
  track.dataset.index=nearest;
 }
 const schedule=()=>{if(!raf)raf=requestAnimationFrame(paint);};
 track.addEventListener('scroll',schedule,{passive:true});
 const go=step=>{const i=Math.max(0,Math.min(cards.length-1,Number(track.dataset.index||0)+step)),el=cards[i];track.scrollTo({left:el.offsetLeft+el.offsetWidth/2-track.clientWidth/2,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});};
 prev.onclick=e=>{e.stopPropagation();go(-1);};next.onclick=e=>{e.stopPropagation();go(1);};
 requestAnimationFrame(paint);
}
root.MonoReminderCarousel={mount};
})(window);
