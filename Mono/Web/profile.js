(function(root){
'use strict';
const DAY=86400000;
function startTrial(){
 if(acc.trialUntil||!accessAvailable)return;
 const oldStart=Date.parse(state.settings.profileTrialStartedAt);
 acc.trialUntil=Number.isFinite(oldStart)?oldStart+7*DAY:Date.now()+3*DAY;
 saveIdentity();
}
const daysLeft=end=>Math.max(0,Math.ceil((end-Date.now())/DAY));
const socialPaths={telegram:'<path d="m3 10 18-7-5 18-5-7-8-4zm8 4 10-11M11 14v5l4-3"/>',vk:'<path d="M3 6h4c0 5 2 8 4 9V6h4v5c2-1 3-3 4-5h3c-1 4-3 6-5 7 2 1 4 3 5 6h-4c-1-2-2-4-3-4v4h-2C6 19 3 13 3 6z"/>',instagram:'<rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 10 4-2.5v9L17 14"/><path d="m8.5 9.5 4 2.5-4 2.5z"/>'};
const META_NOTE='* Instagram и Threads принадлежат компании Meta Platforms Inc., которая признана экстремистской организацией, её деятельность запрещена на территории Российской Федерации.';
function socials(){const names={telegram:'Telegram',vk:'VK',instagram:'Instagram*'};return `<div class="support-socials">${Object.entries(socialPaths).map(([key,path])=>`<span class="support-social"><button type="button" disabled aria-label="${names[key]} — ссылка пока не добавлена" title="Ссылка пока не добавлена"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg></button><small>${names[key]}</small></span>`).join('')}</div><p class="tiny muted">Ссылки на соцсети скоро появятся.</p><p class="meta-note">* Instagram принадлежит компании Meta Platforms Inc., которая признана экстремистской организацией, её деятельность запрещена на территории Российской Федерации.</p>`;}
function codeBlock(){
 const code=MonoAccess.codeText();
 const hint=code?'Ваш личный код. Укажите его при оформлении Премиума на сайте — Премиум включится сам.':accessAvailable?'Код появится, когда приложение подключится к серверу.':'Откройте моно снова, чтобы загрузить ваш код.';
 return `<section class="card profile-code"><h3>Код привязки</h3><div class="code-row"><strong class="profile-code-value">${esc(code||'··· ···')}</strong><button type="button" class="secondary" data-profile-copy ${code?'':'disabled'}>Копировать</button></div><p class="tiny muted">${hint}</p></section>`;
}

// ---------- Код привязки друга: +7 дней Премиума обоим ----------
// Проверку выполняет сервер: код существует, это не свой код, аккаунт ещё не получал бонус,
// и друг не получал бонус по вашему коду (чтобы нельзя было обменяться кодами дважды).
const REFERRAL_URL='https://api.monoapp.ru/api/referral';
const referralErrors={not_found:'Такого кода нет. Проверьте цифры.',self:'Это ваш собственный код.',already_used:'Бонус за код друга уже получен на этом аккаунте.',mutual:'Этот друг уже получил бонус по вашему коду.',no_code:'Ваш код ещё не готов. Попробуйте чуть позже.'};
let friendStatus=null,friendDraft='';
function friendBlock(){
 const used=acc.referralUsed;
 const status=used?'ok':friendStatus?.kind||'';
 return `<section class="card profile-friend"><h3>Код привязки друга</h3><form class="friend-row" data-friend-form novalidate><input name="friend" inputmode="numeric" maxlength="7" size="7" autocomplete="off" placeholder="000 000" aria-label="Код друга, 6 цифр" value="${esc(used?used.slice(0,3)+' '+used.slice(3):friendDraft)}" ${used?'disabled':''}><button type="submit" class="friend-check ${status==='ok'?'is-ok':status==='bad'?'is-bad':''}" aria-label="Проверить код друга" ${used?'disabled':''}>${status==='bad'?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>'}</button></form><p class="tiny muted friend-hint">${used?'Код друга применён — вам обоим начислено 7 дней Премиума.':friendStatus?.text?esc(friendStatus.text):'Введите код друга — вы оба получите 7 дней Премиума.'}</p></section>`;
}
async function applyFriendCode(raw){
 const friendCode=String(raw||'').replace(/\D/g,'');
 if(acc.referralUsed)return;
 if(friendCode.length!==6){friendStatus={kind:'bad',text:'Код друга — 6 цифр.'};redraw();return;}
 if(!acc.code){friendStatus={kind:'bad',text:referralErrors.no_code};redraw();return;}
 if(friendCode===acc.code){friendStatus={kind:'bad',text:referralErrors.self};redraw();return;}
 friendStatus={kind:'wait',text:'Проверяем код…'};redraw();
 try{
  const r=await fetch(REFERRAL_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:acc.code,friendCode})});
  let j={};try{j=await r.json();}catch{}
  if(r.ok&&j.ok){
   acc.referralUsed=friendCode;save();friendStatus={kind:'ok',text:''};
   const until=expiryMillis(j.premiumUntil);if(Number.isFinite(until)&&until>Date.now()){paidUntil=until;activeWithoutDate=false;}
   redraw();notify('Код друга принят: +7 дней Премиума вам обоим',true);refresh(true);
  }else{
   friendStatus={kind:'bad',text:referralErrors[j.error]||'Не удалось проверить код. Попробуйте ещё раз.'};redraw();
  }
 }catch{friendStatus={kind:'bad',text:'Нет связи с сервером. Попробуйте ещё раз.'};redraw();}
}
document.addEventListener('submit',e=>{const f=e.target.closest('[data-friend-form]');if(!f)return;e.preventDefault();f.querySelector('input').blur();applyFriendCode(f.elements.friend.value);});
document.addEventListener('input',e=>{const i=e.target.closest('[data-friend-form] input');if(!i)return;const d=i.value.replace(/\D/g,'').slice(0,6);i.value=d.length>3?d.slice(0,3)+' '+d.slice(3):d;friendDraft=i.value;if(friendStatus?.kind==='bad'){friendStatus=null;const b=i.form.querySelector('.friend-check');b.classList.remove('is-bad');b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';i.form.parentElement.querySelector('.friend-hint').textContent='Введите код друга — вы оба получите 7 дней Премиума.';}});

function premiumLink(){
 const isPrem = MonoAccess.isPremium();
 const deviceCode = acc.code ? acc.code.replace(/\s+/g, '') : '';
 const payUrl = deviceCode ? `http://monoapp.ru/?code=${deviceCode}` : 'http://monoapp.ru/';
 if (isPrem) {
  // Активный Премиум тоже ведёт на страницу оплаты — там подписку можно продлить
  return `<a class="primary premium-button premium-active" href="${payUrl}"><span>Премиум активен ✓</span><small>Продлить <span aria-hidden="true">↗</span></small></a>`;
 }
 return `<a class="primary premium-button" href="${payUrl}">Премиум <span aria-hidden="true">↗</span></a>`;
}

function renderProfile(){
 return `<div class="profile-layout">
  <section class="card profile-intro"><button type="button" class="profile-avatar" data-profile-edit aria-label="Изменить аватарку">${avatar()}</button><div class="profile-identity"><h2>${esc(profileName())}</h2></div><button type="button" class="profile-edit" data-profile-edit aria-label="Изменить имя и аватарку"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16 11-11 4 4L8 20H4zm9-9 4 4m-1-7 2-2 4 4-2 2"/></svg></button></section>
  <button type="button" class="primary premium-button profile-premium" data-go-premium><span class="premium-spark" aria-hidden="true">✦</span><span>Премиум</span><span aria-hidden="true">›</span></button>
  <section class="card profile-invite-card"><h3>Пригласите друга</h3><p class="muted">Расскажите друзьям о моно — учёт денег голосом пригодится и им.</p><button type="button" class="secondary profile-invite" data-profile-invite>Пригласить друга <span aria-hidden="true">↗</span></button></section>
 </div>`;
}
// Экран «Премиум»: что даёт, личный код и ссылка на сайт. Без цен и оплаты внутри приложения.
const PREMIUM_FEATURES=[
 ['accounts','Дополнительные счета','Наличные, карты и валюты — отдельно'],
 ['goals','Цели','Копите на мечты и следите за прогрессом'],
 ['limits','Лимиты','Контроль расходов по категориям'],
 ['payments','Обязательные платежи','Даты, календарь и напоминания о платежах'],
 ['reminders','Напоминания','Свои напоминания с повтором'],
 ['deposits','Вклады','Проценты сами попадают в доходы']
];
function payUrl(){const c=acc.code?acc.code.replace(/\s+/g,''):'';return c?`http://monoapp.ru/?code=${c}`:'http://monoapp.ru/';}
function renderPremium(){
 const trial=!isPremium()&&daysLeft(acc.trialUntil)>0?daysLeft(acc.trialUntil):0;
 const icon=k=>`<span class="menu-symbol"><svg viewBox="0 0 24 24" aria-hidden="true">${(window.MonoMenuMarks||{})[k]||''}</svg></span>`;
 return `<div class="premium-page">
  <p class="premium-lead">Всё, чем вы пользуетесь сейчас, останется бесплатным. С Премиумом откроются:</p>
  ${trial?`<p class="premium-trial">Пробный доступ ко всем функциям: осталось ${trial} ${trial===1?'день':trial<5?'дня':'дней'}.</p>`:''}
  <section class="card premium-features">${PREMIUM_FEATURES.map(([k,t,d])=>`<div class="premium-feature">${icon(k)}<span><b>${t}</b><small>${d}</small></span></div>`).join('')}</section>
  ${codeBlock()}
  <p class="premium-site">Оформить Премиум можно на <a href="${payUrl()}">monoapp.ru</a>. Премиум включится сам, перезапускать приложение не нужно.</p>
 </div>`;
}
function inviteText(){return 'Попробуй моно — учёт денег голосом. Просто скажи, сколько потратил.';}
async function invite(){if(window.MonoNative){MonoNative.invite(inviteText());return;}const url=location.origin;try{if(navigator.share){await navigator.share({title:'моно',text:inviteText(),url});return;}if(navigator.clipboard){await navigator.clipboard.writeText(url);notify('Ссылка на моно скопирована');return;}}catch(e){if(e.name==='AbortError')return;}actionDialog('Пригласить друга',`<p class="muted">Поделитесь ссылкой на моно:</p><label class="field">Ссылка<input readonly value="${esc(url)}"></label>`);}

document.addEventListener('click',e=>{
 if(e.target.closest('[data-profile-edit]'))editProfile();
 if(e.target.closest('[data-profile-copy]'))MonoAccess.copyCode();
 if(e.target.closest('[data-profile-invite]'))invite();
 if(e.target.closest('[data-go-premium]'))navigate('premium');
});

const person='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3"/><path d="M5 20a7 6 0 0 1 14 0"/></svg>';
function profileName(){return typeof state.settings.profileName==='string'?Array.from(state.settings.profileName).slice(0,20).join(''):'Ваш профиль';}
function safeAvatar(value){return typeof value==='string'&&value.length<180000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';}
function avatar(){const src=safeAvatar(state.settings.profileAvatar);return src?`<img src="${src}" alt="Аватарка">`:person;}
function decorate(){const button=document.querySelector('#helpButton');if(button)button.innerHTML=avatar();}
function resizeAvatar(file){return new Promise((resolve,reject)=>{if(!file||!file.type.startsWith('image/')||file.size>20*1024*1024){reject(Error('Фото слишком большое — выберите изображение до 20 МБ.'));return;}const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{const size=Math.min(img.naturalWidth,img.naturalHeight);if(!size)throw Error();const canvas=document.createElement('canvas');canvas.width=canvas.height=256;canvas.getContext('2d').drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,256,256);const value=canvas.toDataURL('image/jpeg',.85);if(!safeAvatar(value))throw Error();resolve(value);}catch{reject(Error('Не удалось прочитать фото. Попробуйте JPG মাতৃчасть или PNG.'));}finally{URL.revokeObjectURL(url);}};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Не удалось открыть фото. Попробуйте JPG или PNG.'));};img.src=url;});}
function editProfile(){let image=safeAvatar(state.settings.profileAvatar);actionDialog('Ваш профиль',`<form class="profile-edit-form"><div class="profile-avatar profile-avatar-preview">${avatar()}</div><label class="secondary avatar-upload">Выбрать фото<input type="file" accept="image/*" class="sr-only" name="avatar"></label><button type="button" class="secondary" data-avatar-reset>Убрать фото</button><label class="field">Имя · до 20 символов<input name="name" maxlength="20" required value="${esc(profileName())}" autocomplete="nickname"></label><p class="form-error" role="alert" hidden></p><button type="submit" class="primary">Сохранить</button></form>`,(f,form)=>{const name=f.get('name').trim();if(!name||Array.from(name).length>20)throw Error('Введите имя — до 20 символов.');if(commit(s=>{s.settings.profileName=name;s.settings.profileAvatar=image;},'Профиль сохранён')){decorate();document.querySelector('#actionDialog').close();}});
 const form=document.querySelector('.profile-edit-form'),button=form.querySelector('[type=submit]'),error=form.querySelector('.form-error');let revision=0;
 form.querySelector('[name=avatar]').onchange=async event=>{const ticket=++revision;button.disabled=true;error.hidden=true;try{const result=await resizeAvatar(event.target.files[0]);if(ticket!==revision)return;image=result;form.querySelector('.profile-avatar-preview').innerHTML=`<img src="${result}" alt="Аватарка">`;}catch(e){if(ticket===revision){error.textContent=e.message;error.hidden=false;}}finally{if(ticket===revision)button.disabled=false;}};
 form.querySelector('[data-avatar-reset]').onclick=()=>{revision++;image='';button.disabled=false;error.hidden=true;form.querySelector('[name=avatar]').value='';form.querySelector('.profile-avatar-preview').innerHTML=person;};
}

// ---------- Доступ: пробный период, Премиум, код, синхронизация ----------
const CFG=root.MONO_CONFIG||{},AK='mono-access',SK='mono-sync',hex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
let pendingPush=false,acc={},paidUntil=0,activeWithoutDate=false,syncTimer=null,syncing=false,refreshTask=null;
const isPremium=()=>activeWithoutDate||paidUntil>Date.now();
try{acc=JSON.parse(localStorage.getItem(AK))||{};}catch{}
const stored=root.monoStoredAccess;
delete root.monoStoredAccess;
const accessAvailable=stored!==false;
if(stored)acc={...(acc.deviceId===stored.deviceId?acc:{}),...stored};
const save=()=>{try{localStorage.setItem(AK,JSON.stringify(acc));}catch{}};
const saveIdentity=()=>{
 save();
 if(accessAvailable&&acc.trialUntil){
  const {deviceId,secret,code,provisional,trialUntil}=acc;
  root.MonoNative?.storeAccess?.({deviceId,secret,code:code||'',provisional:Boolean(provisional),trialUntil});
 }
};
if(accessAvailable&&(!acc.deviceId||!acc.secret)){acc.deviceId=hex(16);acc.secret=hex(32);save();}
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const call=(path,opt={})=>fetch(CFG.apiBase+path,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+acc.deviceId+'.'+acc.secret,...(opt.headers||{})}});
const redraw=()=>{if(typeof page==='string'&&page==='profile')render();};
function localCode(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(100000+a[0]%900000);}

async function ensureCode(){
 if(!accessAvailable||acc.code&&(!acc.provisional||!CFG.apiBase))return;
 if(CFG.apiBase){try{const r=await call('/v1/register',{method:'POST',body:JSON.stringify({deviceId:acc.deviceId,secretHash:await sha(acc.secret)})});if(r.ok){const j=await r.json();if(/^\d{6}$/.test(String(j.code))){acc.code=String(j.code);acc.provisional=false;saveIdentity();redraw();return;}}}catch{}return;}
 if(!acc.code){
  acc.code=localCode();
  acc.provisional=true;
  saveIdentity();
  redraw();
  
  try {
   await fetch('https://api.monoapp.ru/api/registerUser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Mono-Key': acc.secret || '' },
    body: JSON.stringify({ code: acc.code })
   });
  } catch(e) {}
 }
}

async function verifyToken(t){
 try{if(!t||t.deviceId!==acc.deviceId||!CFG.publicKey||Date.parse(t.premiumUntil)<=Date.now())return false;
  const key=await crypto.subtle.importKey('jwk',CFG.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const sig=Uint8Array.from(atob(t.sig),c=>c.charCodeAt(0));
  return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,sig,new TextEncoder().encode(t.deviceId+'.'+t.premiumUntil));
 }catch{return false;}
}
function expiryMillis(value){
 if(value==null||value==='')return NaN;
 const seconds=value?.seconds??value?._seconds;
 if(typeof seconds==='number')return seconds*1000;
 if(typeof value==='number'||/^\d{10,13}$/.test(value)){
  const timestamp=Number(value);
  return timestamp<1e12?timestamp*1000:timestamp;
 }
 return Date.parse(value);
}
function refresh(force=false){
 if(refreshTask)return refreshTask;
 refreshTask=refreshAccess(force).finally(()=>{refreshTask=null;});
 return refreshTask;
}
async function refreshAccess(force){
 const was=isPremium();
 if(accessAvailable&&CFG.apiBase&&(force||!acc.checkedAt||Date.now()-acc.checkedAt>12*3600e3)){
  try{const r=await call('/v1/entitlement');if(r.ok){const j=await r.json();if(/^\d{6}$/.test(String(j.code))&&(!acc.code||acc.provisional)){acc.code=String(j.code);acc.provisional=false;saveIdentity();}acc.token=j.token||null;acc.checkedAt=Date.now();save();}}catch{}
 }
 
 if(await verifyToken(acc.token)){
  paidUntil=Date.parse(acc.token.premiumUntil);activeWithoutDate=false;
 }else if(CFG.devMode&&acc.devUntil>Date.now()){
  paidUntil=acc.devUntil;activeWithoutDate=false;
 }

 if (acc.code) {
  try {
   const checkRes = await fetch(`https://api.monoapp.ru/api/check?code=${acc.code}`);
   if (checkRes.ok) {
    const result = await checkRes.json();
    if (result.premium) {
     const expiry = expiryMillis(result.premiumUntil);
     paidUntil = Number.isFinite(expiry) ? expiry : 0;
     activeWithoutDate = !Number.isFinite(expiry);
    } else {
     paidUntil = 0;
     activeWithoutDate = false;
    }
   }
  } catch(e) {}
 }

 if(isPremium()&&!was)reconcile();
 if(page==='profile')render();
 root.MonoNative?.refreshReminders?.();
 subscriptionNotice();
 if(pendingPush&&isPremium()){pendingPush=false;push();}
}
// ---------- Напоминание о конце подписки: за 3 дня и за 1 день ----------
const dayKey=ms=>{const d=new Date(ms);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function daysUntilEnd(){if(!isPremium()||!paidUntil)return null;const a=new Date();a.setHours(12,0,0,0);const b=new Date(paidUntil);b.setHours(12,0,0,0);return Math.round((b-a)/DAY);}
const endText=left=>left===1?'Завтра закончится подписка Премиум. Продлите её в профиле, чтобы не потерять доступ.':'Подписка Премиум закончится через 3 дня. Продлить можно в профиле.';
function subscriptionNotice(){
 const left=daysUntilEnd();if(left!==3&&left!==1)return;
 if(document.hidden||document.querySelector('dialog[open]'))return;
 const key=dayKey(paidUntil)+'|'+left;let seen={};try{seen=JSON.parse(localStorage.getItem('mono-sub-notice'))||{};}catch{}
 if(seen[key])return;seen={[key]:Date.now()};try{localStorage.setItem('mono-sub-notice',JSON.stringify(seen));}catch{}
 notify(endText(left),false,{duration:6000});
}
// Для уведомлений iPhone: за 3 дня и за 1 день до конца, в 10:00
function nativeItems(){
 if(!isPremium()||!paidUntil)return [];
 const end=new Date(paidUntil),items=[];
 for(const left of [3,1]){const d=new Date(end);d.setDate(d.getDate()-left);d.setHours(10,0,0,0);if(d.getTime()>Date.now())items.push({id:'sub|'+dayKey(paidUntil)+'|'+left,date:dayKey(d.getTime()),time:'10:00',text:endText(left)});}
 return items;
}
const meta=()=>{try{return JSON.parse(localStorage.getItem(SK))||{};}catch{return {};}};
const setMeta=m=>{try{localStorage.setItem(SK,JSON.stringify(m));}catch{}};

// ---------- Синхронизация Премиума: тихо, без уведомлений ----------
// rev — счётчик локальных изменений, pushedRev — до какого изменения сервер подтвердил сохранение.
// Пока есть неотправленные изменения (rev > pushedRev), данные с сервера их не перезаписывают —
// поэтому удалённые операции и напоминания не возвращаются.
const SYNC_URL='https://api.monoapp.ru/api/sync';
// Секретный ключ устройства (из Keychain) — без него сервер не отдаёт и не меняет историю
const keyHeaders=(json=true)=>({...(json?{'Content-Type':'application/json'}:{}),'X-Mono-Key':acc.secret||''});
const toMs=v=>{const n=expiryMillis(v);return Number.isFinite(n)?n:0;};
function syncMeta(){const m=meta();if(typeof m.rev!=='number'){m.rev=m.updatedAt&&(!m.syncedAt||m.updatedAt>m.syncedAt)?1:0;m.pushedRev=0;setMeta(m);}return m;}
let pushAgain=false;
// Аватарка хранится только на телефоне и на сервер не отправляется: она может много весить
function withoutAvatar(s){const copy={...s,settings:{...(s.settings||{})}};delete copy.settings.profileAvatar;return copy;}
function queueSync(){const m=syncMeta();m.rev+=1;m.updatedAt=new Date().toISOString();setMeta(m);if(!isPremium())return;clearTimeout(syncTimer);syncTimer=setTimeout(push,1200);}
async function push(options={}){
 if(!isPremium()||!acc.code)return;
 if(syncing){pushAgain=true;return;}
 syncing=true;pushAgain=false;
 const m=syncMeta(),rev=m.rev;
 try{
  const response=await fetch(SYNC_URL,{method:'POST',headers:keyHeaders(),keepalive:!!options.keepalive,body:JSON.stringify({code:acc.code,state:withoutAvatar(state),updatedAt:m.updatedAt,rev})});
  if(!response.ok){pendingPush=true;return;}
  let serverMs=0;try{const j=await response.json();serverMs=toMs(j?.updatedAt);}catch{}
  if(!serverMs){try{const r=await fetch(`${SYNC_URL}?code=${acc.code}`,{headers:keyHeaders(false)});if(r.ok)serverMs=toMs((await r.json())?.updatedAt);}catch{}}
  const now=syncMeta();now.pushedRev=Math.max(now.pushedRev||0,rev);now.syncedAt=new Date().toISOString();if(serverMs)now.serverMs=serverMs;setMeta(now);
 }catch(e){pendingPush=true;}
 // изменения, сделанные во время отправки, уходят следующей отправкой; ошибки сети — при появлении связи
 finally{syncing=false;if(pushAgain&&!pendingPush){pushAgain=false;clearTimeout(syncTimer);syncTimer=setTimeout(push,800);}}
}
const unsynced=()=>{const m=syncMeta();return m.rev>(m.pushedRev||0);};
async function reconcile(){
 if(!isPremium()||!acc.code||syncing)return;
 try{
  const r=await fetch(`${SYNC_URL}?code=${acc.code}`,{headers:keyHeaders(false)});
  if(!r.ok)return;
  const j=await r.json();
  if(j.empty||!j.state){push();return;}
  const m=syncMeta(),serverMs=toMs(j.updatedAt);
  // новое устройство без операций берёт данные с сервера, а не затирает их
  const freshDevice=!m.syncedAt&&!state.entries.length;
  if(!freshDevice&&unsynced()){push();return;}
  // сервер не менялся с прошлой синхронизации — ничего не делаем
  if(!freshDevice&&m.serverMs&&serverMs&&serverMs<=m.serverMs)return;
  if(!E.validateState(j.state))return;
  try{localStorage.removeItem('mono-backup-before-sync');}catch{}
  if(state.settings){
   j.state.settings=j.state.settings||{};
   if(!j.state.settings.profileName&&state.settings.profileName)j.state.settings.profileName=state.settings.profileName;
   // аватарка всегда своя, с этого телефона
   if(state.settings.profileAvatar)j.state.settings.profileAvatar=state.settings.profileAvatar;else delete j.state.settings.profileAvatar;
   for(const k of ['notifyAsked','notifyGranted'])if(state.settings[k]!==undefined)j.state.settings[k]=state.settings[k];
   j.state.settings.language='ru';
  }
  // пока шёл запрос, пользователь мог что-то изменить — тогда оставляем его изменения
  if(unsynced()){push();return;}
  const wasProblem=storageProblem;storageProblem=false;
  if(!persist(E.migrate(j.state),{remote:true})){storageProblem=wasProblem;return;}
  const after=syncMeta();after.syncedAt=new Date().toISOString();after.serverMs=serverMs||Date.now();after.pushedRev=after.rev;setMeta(after);
  refreshAccounts();applyTheme();renderHomeReminders();if(page!=='home')render();decorate();
 }catch(e){console.error('Ошибка синхронизации',e);}
}
// Перед уходом приложения в фон отправляем несохранённые изменения
document.addEventListener('visibilitychange',()=>{if(document.hidden&&unsynced()&&isPremium()){clearTimeout(syncTimer);push({keepalive:true});}else if(!document.hidden&&isPremium())setTimeout(reconcile,1200);});

// ---------- Удаление данных пользователя ----------
// Сначала сервер (копия истории, обращения, заявки), потом телефон. Код и Премиум остаются.
const DELETE_URL='https://api.monoapp.ru/api/deleteData';
function confirmDeleteData(){
 actionDialog('Удалить мои данные?',`<div class="delete-data-sheet"><p>Будут удалены <b>все операции, счета, цели, лимиты, платежи, вклады, напоминания, свои категории, обращения в поддержку, имя и аватар</b> — на этом телефоне и на сервере.</p><p class="muted">Код привязки и оплаченный Премиум сохранятся. Отменить удаление нельзя.</p><p class="form-error delete-data-error" role="alert" hidden></p><button type="button" class="primary danger-primary" id="deleteDataConfirm">Удалить навсегда</button><button type="button" class="secondary full" id="deleteDataCancel">Отмена</button></div>`);
 document.querySelector('#deleteDataCancel').onclick=()=>document.querySelector('#actionDialog').close();
 document.querySelector('#deleteDataConfirm').onclick=deleteMyData;
}
async function deleteMyData(){
 const btn=document.querySelector('#deleteDataConfirm'),err=document.querySelector('.delete-data-error');
 btn.disabled=true;btn.textContent='Удаляем…';err.hidden=true;
 const m=syncMeta(),onServer=!!m.syncedAt||isPremium();
 clearTimeout(syncTimer);
 if(acc.code&&onServer){
  try{
   const r=await fetch(DELETE_URL,{method:'POST',headers:keyHeaders(),body:JSON.stringify({code:acc.code})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok||j.ok===false)throw Error();
  }catch{
   btn.disabled=false;btn.textContent='Удалить навсегда';
   err.textContent='Нет связи с сервером — данные не удалены. Попробуйте ещё раз, когда появится интернет.';err.hidden=false;
   return;
  }
 }else if(acc.code){
  // без Премиума на сервере только обращения и заявки — удаляем, но не ждём
  fetch(DELETE_URL,{method:'POST',headers:keyHeaders(),body:JSON.stringify({code:acc.code})}).catch(()=>{});
 }
 // телефон: чистые данные, без повторного обучения и запроса уведомлений
 const fresh=E.initialState();fresh.reminders=[];fresh.deposits=[];
 for(const k of ['onboarded','notifyAsked','notifyGranted','theme'])if(state.settings[k]!==undefined)fresh.settings[k]=state.settings[k];
 fresh.settings.onboarded=true;
 const wasProblem=storageProblem;storageProblem=false;
 if(!persist(fresh,{remote:true})){storageProblem=wasProblem;btn.disabled=false;btn.textContent='Удалить навсегда';return;}
 for(const key of ['mono-sync','mono-notes-seen','mono-reminders-seen','mono-sub-notice','mono-backup-before-v2','mono-backup-before-sync'])try{localStorage.removeItem(key);}catch{}
 document.querySelector('#actionDialog').close();
 refreshAccounts();applyTheme();decorate();renderHomeReminders();
 setTimeout(()=>{navigate('home');notify('Данные удалены',true);},320);
}
async function copyCode(){
 const c=acc.code;if(!c)return;
 try{await navigator.clipboard.writeText(c);}catch{const t=document.createElement('textarea');t.value=c;t.setAttribute('readonly','');t.style.cssText='position:fixed;opacity:0;top:0';document.body.append(t);t.select();try{document.execCommand('copy');}catch{}t.remove();}
 notify('Код скопирован',true);
}
function premiumDialog(){
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());
 setTimeout(()=>navigate('premium'),document.querySelector('dialog[open]')?320:0);
}
root.MonoAccess={
 isPremium,
 canUse:()=>isPremium()||daysLeft(acc.trialUntil)>0,
 codeText:()=>acc.code?acc.code.slice(0,3)+' '+acc.code.slice(3):'',
 copyCode,queueSync,refresh,confirmDeleteData,nativeItems,daysUntilEnd,
 devGrant:days=>{if(!CFG.devMode)return false;acc.devUntil=Date.now()+days*864e5;save();refresh();return true;}
};
root.MonoProfile={render:renderProfile,renderPremium,startTrial,socials,decorate,safeAvatar,profileName,premiumDialog};decorate();
if(acc.trialUntil)saveIdentity();else startTrial();
ensureCode().then(()=>refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden){ensureCode().then(()=>refresh(true));setTimeout(subscriptionNotice,1500);}});
addEventListener('online',()=>{ensureCode().then(()=>refresh(true));if(pendingPush&&isPremium()){pendingPush=false;push();}});
try{localStorage.removeItem('mono-backup-before-sync');}catch{}
if(root.MonoNative)addEventListener('focus',()=>refresh(true));
})(window);
