(function(root){
'use strict';let openKey='';
function section(key,title,body){const open=openKey===key;return `<section class="settings-section ${open?'is-open':''}"><button type="button" class="settings-toggle" data-settings-section="${key}" aria-expanded="${open}" aria-controls="settings-${key}"><span>${title}</span><span aria-hidden="true">⌄</span></button><div class="settings-reveal" id="settings-${key}" ${open?'':'inert'} aria-hidden="${!open}"><div class="settings-overflow"><div class="settings-content">${body}</div></div></div></section>`;}
function decorate(){if(page!=='settings')return;document.querySelectorAll('[data-settings-section]').forEach(button=>button.onclick=()=>{openKey=openKey===button.dataset.settingsSection?'':button.dataset.settingsSection;document.querySelectorAll('.settings-section').forEach(s=>{const b=s.querySelector('.settings-toggle'),on=b.dataset.settingsSection===openKey,panel=s.querySelector('.settings-reveal');s.classList.toggle('is-open',on);b.setAttribute('aria-expanded',String(on));panel.inert=!on;panel.setAttribute('aria-hidden',String(!on));});});}
root.MonoSettings={section,decorate};
})(window);
