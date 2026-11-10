(function(root){
'use strict';
// Награды: пост или видео о моно в соцсетях — дни Премиума в благодарность.
// Заявка уходит на сервер (он пересылает её на почту); без связи — открывается письмо на почту.
const MAIL='monofinapp@gmail.com';
const REWARD_URL='https://api.monoapp.ru/api/reward';
const icons={
 threads:'<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z"/><path d="M8 9h8M8 12.5h5"/>',
 telegram:'<path d="m3 10.5 17.5-7-3 17-5.5-5-3 3v-5l9-8-11.5 7z"/>',
 instagram:'<rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 10 4-2.5v9L17 14"/><path d="m8.5 9.5 4 2.5-4 2.5z"/>',
 vk:'<path d="M3 6.5h3.6c.4 4.8 2.4 7.3 4.4 7.9V6.5h3.4v4.6c1.8-.4 3.4-2.3 4-4.6h3.3c-.6 3-2.6 5.2-4.2 6.2 1.6.8 3.6 2.7 4.5 5.8h-3.7c-.8-2.1-2.4-3.8-3.9-4v4H14C7.4 18.5 3.4 14 3 6.5z"/>'
};
const networks=[
 {id:'threads',name:'Threads*',what:'Пост в Threads*',days:7},
 {id:'telegram',name:'Telegram',what:'Пост в Telegram-канале',days:7},
 {id:'instagram',name:'Instagram*',what:'Рилс в Instagram*',days:30},
 {id:'vk',name:'ВКонтакте',what:'Пост во ВКонтакте',days:7}
];
const svg=id=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]}</svg>`;
const gift='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="8.5" width="17" height="4" rx="1.2"/><path d="M5 12.5v7.5h14v-7.5M12 8.5V20M12 8.5c-1.6-3.4-6-3.8-6-1.3 0 1.4 2 1.3 6 1.3zm0 0c1.6-3.4 6-3.8 6-1.3 0 1.4-2 1.3-6 1.3z"/></svg>';
let chosen='threads',sending=false,draft={code:'',link:''};
// Заявку можно отправить только один раз и только на одну награду. Отметка хранится в данных
// (синхронизируется между устройствами), а сервер дополнительно не примет вторую заявку с того же кода.
const sentInfo=()=>state.settings?.rewardSent||null;
function markSent(net,code,link){const next=structuredClone(state);next.settings.rewardSent={network:net.id,code,link,date:new Date().toISOString()};persist(next);}
function myCode(){return (root.MonoAccess?.codeText()||'').replace(/\s+/g,'');}
function render(){
 const code=draft.code||myCode(),sent=sentInfo(),sentNet=sent&&networks.find(n=>n.id===sent.network);
 return `<div class="rewards">
 <section class="card rewards-hero"><span class="rewards-gift">${gift}</span><h2>Спасибо, что вы с нами</h2><p>Если хотите нас поддержать — мы будем этому очень рады! Вот как мы готовы вас отблагодарить:</p></section>
 <section class="card rewards-list">${networks.map(n=>`<div class="reward-row reward-${n.id}"><span class="reward-icon">${svg(n.id)}</span><span class="reward-copy"><b>${n.what}</b><small>${n.name}</small></span><span class="reward-days">+${n.days} дней</span></div>`).join('')}</section>
 <section class="card rewards-how"><h3>Что опубликовать</h3><p>Расскажите о своём опыте с моно: как вы ведёте учёт голосом, что стало проще. Можно пост, сторис или короткое видео — главное, чтобы было видно приложение.</p><ol><li>Опубликуйте пост или видео.</li><li>Скопируйте ссылку на публикацию.</li><li>Отправьте заявку ниже — мы проверим и начислим дни Премиума на ваш код.</li></ol></section>
 <section class="card rewards-form-card"><h3>Отправить заявку</h3>${sent?`<div class="rewards-sent"><span>✓</span><b>Заявка отправлена</b><p>${sentNet?esc(sentNet.what)+' · +'+sentNet.days+' дней. ':''}Мы проверим публикацию и начислим дни Премиума на код ${esc(sent.code||code)}. Обычно это занимает до двух дней.</p><p class="tiny muted">Награду можно получить один раз.</p></div>`:`<form class="rewards-form" novalidate>
  <span class="field-label">Где опубликовали</span>
  <div class="reward-networks" role="radiogroup" aria-label="Соцсеть">${networks.map(n=>`<button type="button" role="radio" class="reward-net ${n.id===chosen?'on':''}" data-reward-net="${n.id}" aria-checked="${n.id===chosen}">${svg(n.id)}<span>${n.name}</span></button>`).join('')}</div>
  <label class="field">Ваш код привязки<input name="code" inputmode="numeric" maxlength="7" autocomplete="off" placeholder="000000" value="${esc(code)}"></label>
  <label class="field">Ссылка на публикацию<input name="link" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://" value="${esc(draft.link)}"></label>
  <p class="form-error rewards-error" role="alert" hidden></p>
  <button class="primary" type="submit" ${sending?'disabled':''}>${sending?'Отправляем…':'Отправить заявку'}</button>
  <p class="tiny muted">Выберите что-то одно: заявку можно отправить только один раз. Она придёт к нам на почту ${MAIL}.</p>
 </form>`}</section>
 <p class="meta-note">* Instagram и Threads принадлежат компании Meta Platforms Inc., которая признана экстремистской организацией, её деятельность запрещена на территории Российской Федерации.</p>
 </div>`;
}
function showError(form,text){const e=form.querySelector('.rewards-error');e.textContent=text;e.hidden=false;}
async function submit(form){
 if(sending||sentInfo())return;
 const code=form.elements.code.value.replace(/\D/g,''),link=form.elements.link.value.trim(),net=networks.find(n=>n.id===chosen);
 if(code.length!==6){showError(form,'Код привязки — 6 цифр. Он есть в профиле.');return;}
 if(!/^https?:\/\/\S+\.\S+/i.test(link)){showError(form,'Вставьте ссылку на публикацию — она начинается с https://');return;}
 draft={code,link};sending=true;window.render();
 let ok=false,already=false,offline=false;
 try{const r=await fetch(REWARD_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,network:net.id,networkName:net.name,link,days:net.days})});const j=await r.json().catch(()=>({}));ok=r.ok&&j.ok!==false;already=j.error==='already_sent';}catch{offline=true;}
 sending=false;
 if(already){sending=false;markSent(net,code,link);window.render();notify('Заявка с этого кода уже была отправлена');return;}
 if(!ok&&!offline){window.render();const f=document.querySelector('.rewards-form');if(f)showError(f,'Не удалось отправить заявку. Попробуйте позже.');return;}
 if(!ok){
  // нет связи с сервером — открываем готовое письмо
  const subject=`Награда моно: ${net.what} · код ${code}`,body=`Соцсеть: ${net.name}\nКод привязки: ${code}\nСсылка: ${link}\nНаграда: +${net.days} дней Премиума`;
  location.href=`mailto:${MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  markSent(net,code,link);window.render();return;
 }
 markSent(net,code,link);draft={code:'',link:''};window.render();notify('Заявка отправлена',true);
}
document.addEventListener('click',e=>{
 if(page!=='rewards')return;
 const net=e.target.closest('[data-reward-net]');if(net){chosen=net.dataset.rewardNet;document.querySelectorAll('[data-reward-net]').forEach(b=>{const on=b===net;b.classList.toggle('on',on);b.setAttribute('aria-checked',String(on));});return;}
});
document.addEventListener('submit',e=>{const f=e.target.closest('.rewards-form');if(!f)return;e.preventDefault();submit(f);});
document.addEventListener('input',e=>{const f=e.target.closest('.rewards-form');if(!f)return;draft={code:f.elements.code.value,link:f.elements.link.value};f.querySelector('.rewards-error').hidden=true;});
root.MonoRewards={render};
})(window);
