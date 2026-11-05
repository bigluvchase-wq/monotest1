(function(){
'use strict';const form=document.querySelector('#unlockForm'),input=document.querySelector('#unlockPin'),submit=form.querySelector('[type=submit]');
function press(key){if(!document.querySelector('#lockDialog').open||document.querySelector('#recoveryDialog')?.open||submit.disabled)return;const limit=Number(input.maxLength)||4;if(key==='Backspace')input.value=input.value.slice(0,-1);else if(/^\d$/.test(key)&&input.value.length<limit)input.value+=key;else if(key==='Enter'){form.requestSubmit();return;}if(input.value.length===limit)form.requestSubmit();}
form.addEventListener('click',e=>{const key=e.target.closest('[data-pin-key]');if(key)press(key.dataset.pinKey);});
document.querySelector('#legacyUnlock').onclick=()=>form.requestSubmit();
document.addEventListener('keydown',e=>{if(!document.querySelector('#lockDialog').open||document.querySelector('#recoveryDialog')?.open||e.ctrlKey||e.metaKey||e.altKey)return;if(/^\d$/.test(e.key)||['Backspace','Enter'].includes(e.key)){e.preventDefault();press(e.key);}});
})();
