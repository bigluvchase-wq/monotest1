(function(){
'use strict';
let keyboard=false;window.MonoFocus={isKeyboard:()=>keyboard};document.body.classList.add('pointer-navigation');document.addEventListener('pointerdown',()=>{keyboard=false;document.body.classList.add('pointer-navigation');},{passive:true,capture:true});document.addEventListener('keydown',e=>{if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keyboard=true;document.body.classList.remove('pointer-navigation');}},{capture:true});
// Only close a sheet when a complete pointer gesture starts and ends on its backdrop.
for(const dialog of document.querySelectorAll('dialog:not(#lockDialog):not(#onboarding):not(#chartDialog)')){
 let start=null;
 function outside(e){const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;}
 dialog.addEventListener('pointerdown',e=>{start=e.target===dialog&&outside(e)?{x:e.clientX,y:e.clientY}:null;});
 dialog.addEventListener('click',e=>{if(start&&e.target===dialog&&outside(e)&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<10)dialog.close();start=null;});
 dialog.addEventListener('pointercancel',()=>start=null);
}
const recovery=document.querySelector('#recoveryDialog');
document.querySelector('#forgotPin').onclick=()=>{if(!document.querySelector('#lockDialog').open)return;recovery.showModal();};
document.querySelector('#closeRecovery').onclick=()=>recovery.close();
document.querySelector('#recoveryForm').onsubmit=e=>{e.preventDefault();if(!document.querySelector('#lockDialog').open)return;const data=new FormData(e.target);download('mono-support.txt','Тема: Не могу войти в моно\nПочта для ответа: '+data.get('email')+'\n\n'+data.get('message'),'text/plain;charset=utf-8');};
})();
