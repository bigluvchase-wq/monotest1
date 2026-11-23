(function(root){
'use strict';
// Производительность без изменения внешнего вида.
// Фон с плавающими пятнами движется очень медленно (26–40 с на цикл), но пока он движется,
// iPhone на каждом кадре заново размывает все «стеклянные» элементы поверх него.
// Поэтому на время касаний, прокрутки и переходов фон ставится на паузу — на глаз это незаметно.
const html=document.documentElement,delay=1400;let timer=0,last=0;
function resume(){
 const remaining=last+delay-performance.now();
 if(remaining>0){timer=setTimeout(resume,remaining);return;}
 timer=0;html.classList.remove('motion-busy');
}
function busy(){
 last=performance.now();
 if(timer)return;
 html.classList.add('motion-busy');timer=setTimeout(resume,delay);
}
for(const type of ['touchstart','touchmove','pointerdown','wheel','keydown'])document.addEventListener(type,busy,{passive:true,capture:true});
addEventListener('scroll',busy,{passive:true,capture:true});
// Окно или поиск открыты — фон не виден целиком, держим его на паузе
new MutationObserver(()=>{if(document.querySelector('dialog[open]')||html.classList.contains('search-open'))busy();}).observe(document.body,{attributes:true,subtree:true,attributeFilter:['open']});
})(window);
