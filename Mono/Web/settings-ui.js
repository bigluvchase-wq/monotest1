/* Stack navigation inspired by Kokonut UI Stack Panel (MIT), adapted to Mono's existing controls. */
(function(root){
'use strict';let route=[],moving=null;
function section(key,title,body){return `<section class="settings-section" data-settings-key="${key}"><button type="button" class="settings-toggle" data-settings-section="${key}" aria-expanded="false" aria-controls="settings-${key}"><span>${title}</span><span aria-hidden="true">›</span></button><div class="settings-reveal" id="settings-${key}" hidden inert aria-hidden="true"><div class="settings-overflow"><div class="settings-content">${body}</div></div></div></section>`;}
function decorate(){
 if(page!=='settings')return;const body=document.querySelector('#pageBody');if(body.querySelector('.settings-stack'))return;
 const shell=document.createElement('div');shell.className='settings-stack';const sections=[...body.querySelectorAll('.settings-section')];sections.forEach(s=>shell.append(s));body.prepend(shell);
 const bar=document.createElement('div');bar.className='settings-stack-bar';bar.innerHTML='<button type="button" class="settings-stack-back" aria-label="Назад в настройки"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m10 3-5 5 5 5"/></svg><span>Настройки</span></button><h2 tabindex="-1"></h2>';shell.prepend(bar);
 const choice=document.createElement('div');choice.className='settings-choice-page';choice.hidden=true;shell.append(choice);
 const titleFor=key=>sections.find(s=>s.dataset.settingsKey===key)?.querySelector('.settings-toggle>span').textContent||'Настройки';
 function draw(direction=0){
  moving?.cancel();bar.hidden=!route.length;choice.hidden=true;
  sections.forEach(s=>{const active=s.dataset.settingsKey===route[0],panel=s.querySelector('.settings-reveal'),button=s.querySelector('.settings-toggle');s.hidden=route.length>0&&!active;s.classList.toggle('is-open',active);button.hidden=route.length>0;button.setAttribute('aria-expanded',String(active));panel.hidden=!active||route.length>1;panel.inert=panel.hidden;panel.setAttribute('aria-hidden',String(panel.hidden));});
  let surface=route.length?shell.querySelector(`#settings-${CSS.escape(route[0])}`):shell;
  if(route.length){bar.querySelector('button>span:last-child').textContent=route.length>1?titleFor(route[0]):'Настройки';bar.querySelector('h2').textContent=titleFor(route[0]);}
  if(route.length>1){
   const select=shell.querySelector('#'+CSS.escape(route[1]));if(!select){route=route.slice(0,1);draw();return;}
   const label=select.closest('label'),name=select.getAttribute('aria-label')||[...label.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('')||'Выберите вариант';bar.querySelector('h2').textContent=name;
   choice.replaceChildren();choice.hidden=false;surface=choice;
   for(const option of select.options){const row=document.createElement('button');row.type='button';row.className='settings-choice';row.dataset.settingsValue=option.value;row.disabled=option.disabled;row.setAttribute('role','radio');row.setAttribute('aria-checked',String(option.selected));row.tabIndex=option.selected?0:-1;const text=document.createElement('span');text.textContent=option.text;const check=document.createElement('span');check.className='settings-choice-check';check.setAttribute('aria-hidden','true');check.textContent='✓';row.append(text,check);row.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));if(shell.isConnected)draw();if(window.MonoFocus?.isKeyboard())requestAnimationFrame(()=>document.querySelector('.settings-choice[aria-checked=true]')?.focus({preventScroll:true}));};choice.append(row);}
   choice.setAttribute('role','radiogroup');choice.setAttribute('aria-label',name);
  }
  if(direction&&!reducedMotion()){moving=surface.animate([{opacity:0,transform:`translateX(${direction*20}px)`},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});}
 }
 function go(next,direction){route=next;draw(direction);window.scrollTo(0,0);if(window.MonoFocus?.isKeyboard())requestAnimationFrame(()=>{if(route.length)bar.querySelector('h2').focus({preventScroll:true});else shell.querySelector('.settings-toggle')?.focus({preventScroll:true});});}
 sections.forEach(s=>{s.querySelector('.settings-toggle').onclick=()=>go([s.dataset.settingsKey],1);});
 for(const select of shell.querySelectorAll('select[id]')){
  select.hidden=true;const label=select.closest('label');label.querySelector('.sr-only')?.classList.remove('sr-only');const button=document.createElement('button');button.type='button';button.className='settings-value-button';button.dataset.settingsSelect=select.id;button.innerHTML='<span></span><span aria-hidden="true">›</span>';button.firstChild.textContent=select.selectedOptions[0]?.text||'Выбрать';button.onclick=()=>go([select.closest('[data-settings-key]').dataset.settingsKey,select.id],1);select.after(button);
 }
 bar.querySelector('button').onclick=()=>go(route.slice(0,-1),-1);draw();
 shell.addEventListener('keydown',e=>{if(e.key==='Escape'&&route.length&&!document.querySelector('dialog[open]')){e.preventDefault();e.stopPropagation();go(route.slice(0,-1),-1);}if(route.length>1&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){const rows=[...choice.querySelectorAll('button:not(:disabled)')],i=rows.indexOf(document.activeElement);if(i<0)return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?rows.length-1:(i+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;rows[next].focus();rows[next].click();}});
}
new MutationObserver(()=>{if(document.body.dataset.page!=='settings'){route=[];moving?.cancel();}}).observe(document.body,{attributes:true,attributeFilter:['data-page']});
root.MonoSettings={section,decorate};
})(window);
