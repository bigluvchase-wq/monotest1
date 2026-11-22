(function(){
'use strict';
let keyboard=false;window.MonoFocus={isKeyboard:()=>keyboard};document.body.classList.add('pointer-navigation');document.addEventListener('pointerdown',()=>{keyboard=false;document.body.classList.add('pointer-navigation');},{passive:true,capture:true});document.addEventListener('keydown',e=>{if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keyboard=true;document.body.classList.remove('pointer-navigation');}},{capture:true});
// Only close a sheet when a complete pointer gesture starts and ends on its backdrop.
for(const dialog of document.querySelectorAll('dialog:not(#onboarding):not(#chartDialog):not(#homeAccountDialog)')){
 let start=null;
 function outside(e){const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;}
 dialog.addEventListener('pointerdown',e=>{start=e.target===dialog&&outside(e)?{x:e.clientX,y:e.clientY}:null;});
 dialog.addEventListener('click',e=>{if(start&&e.target===dialog&&outside(e)&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<10)dialog.close();start=null;});
 dialog.addEventListener('pointercancel',()=>start=null);
}
})();

// Prevent vertical rubber-banding on the home canvas, preserving modal scrolling.
document.addEventListener('touchmove',event=>{
 if(document.body.dataset.page==='home'&&!window.MonoSearch?.isOpen()&&!document.querySelector('dialog[open]')&&event.cancelable)event.preventDefault();
},{passive:false});

// iOS can pan the page under a modal even with overflow:hidden. Preserve its scroll position.
(()=>{
 const html=document.documentElement;let locked=false,savedY=0,savedPage='',lastY=null;
 function sync(){const modal=!!document.querySelector('dialog[open]');if(modal===locked)return;locked=modal;if(modal){savedY=scrollY;savedPage=document.body.dataset.page;html.style.setProperty('--modal-scroll-top',-savedY+'px');html.classList.add('modal-scroll-locked');}else{html.classList.remove('modal-scroll-locked');html.style.removeProperty('--modal-scroll-top');window.scrollTo(0,document.body.dataset.page===savedPage?savedY:0);}}
 new MutationObserver(sync).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 document.addEventListener('touchstart',e=>{lastY=e.touches.length===1?e.touches[0].clientY:null;},{passive:true});
 document.addEventListener('touchmove',e=>{if(!locked||e.touches.length!==1||lastY===null)return;const y=e.touches[0].clientY,dy=y-lastY;lastY=y;let node=e.target,canScroll=false;const dialog=node.closest('dialog[open]');if(dialog){for(;node&&node!==document.body;node=node.parentElement){const overflow=getComputedStyle(node).overflowY;if(/auto|scroll/.test(overflow)&&node.scrollHeight>node.clientHeight+1&&((dy>0&&node.scrollTop>0)||(dy<0&&node.scrollTop+node.clientHeight<node.scrollHeight-1))){canScroll=true;break;}if(node===dialog)break;}}if(!canScroll&&e.cancelable)e.preventDefault();},{passive:false});
 document.addEventListener('touchend',()=>lastY=null,{passive:true});sync();
})();
