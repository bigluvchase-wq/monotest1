(function(root){
'use strict';
const TRIAL=7*24*60*60*1000;
function trial(start,now=Date.now()){const time=Date.parse(start);return Number.isFinite(time)?{started:true,remaining:Math.max(0,Math.ceil((time+TRIAL-now)/86400000)),ends:new Date(time+TRIAL).toISOString()}:{started:false,remaining:7,ends:null};}
function startTrial(){if(trial(state.settings.profileTrialStartedAt).started||storageProblem)return;const next=structuredClone(state);next.settings.profileTrialStartedAt=new Date().toISOString();persist(next);}
const socialPaths={telegram:'<path d="m3 10 18-7-5 18-5-7-8-4zm8 4 10-11M11 14v5l4-3"/>',vk:'<path d="M3 6h4c0 5 2 8 4 9V6h4v5c2-1 3-3 4-5h3c-1 4-3 6-5 7 2 1 4 3 5 6h-4c-1-2-2-4-3-4v4h-2C6 19 3 13 3 6z"/>',instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>'};
function socials(){return `<div class="support-socials">${Object.entries(socialPaths).map(([key,path])=>`<button type="button" disabled aria-label="${{telegram:'Telegram',vk:'VK',instagram:'Instagram'}[key]} — ссылка пока не добавлена" title="Ссылка пока не добавлена"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg></button>`).join('')}</div><p class="tiny muted">Ссылки на соцсети скоро появятся.</p>`;}
function codeBlock(){
 const code=MonoAccess.codeText();
 const hint=code?'Это твой личный код.':'Код появится, когда приложение подключится к серверу.';
 return `<section class="card profile-code"><h3>Код привязки</h3><div class="code-row"><strong class="profile-code-value">${esc(code||'··· ···')}</strong><button type="button" class="secondary" data-profile-copy ${code?'':'disabled'}>Копировать</button></div><p class="tiny muted">${hint}</p></section>`;
}
function premiumLink(){
 const url=new URL(CFG.premiumUrl);
 if(acc.code&&!acc.provisional)url.searchParams.set('code',acc.code);
 return `<a class="primary premium-button" href="${esc(url.href)}" ${window.MonoNative?'':'target="_blank" rel="noopener"'}>Премиум <span aria-hidden="true">↗</span></a>`;
}
function renderProfile(){
 const days=MonoAccess.trialDays();
 const status=MonoAccess.isPremium()?'Премиум активен':days?'Пробный доступ':'Пробный доступ завершён';
 const details=!MonoAccess.isPremium()&&days?`Осталось дней: ${days}`:'';
 return `<div class="profile-layout">
  <section class="card profile-intro"><button type="button" class="profile-avatar" data-profile-edit aria-label="Изменить аватарку">${avatar()}</button><div class="profile-identity"><h2>${esc(profileName())}</h2></div><button type="button" class="profile-edit" data-profile-edit aria-label="Изменить имя и аватарку"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16 11-11 4 4L8 20H4zm9-9 4 4m-1-7 2-2 4 4-2 2"/></svg></button></section>
  <section class="card profile-subscription"><h3>Доступ</h3><p class="profile-access-status">${status}</p>${details?`<p class="tiny muted">${details}</p>`:''}${premiumLink()}</section>
  ${codeBlock()}
  <button type="button" class="secondary profile-invite" data-profile-invite>Пригласить друга <span aria-hidden="true">↗</span></button>
 </div>`;
}
async function invite(){if(window.MonoNative){MonoNative.invite();return;}const url=location.origin;try{if(navigator.share){await navigator.share({title:'моно',text:'Просто скажи, сколько. Учёт денег голосом.',url});return;}if(navigator.clipboard){await navigator.clipboard.writeText(url);notify('Ссылка на моно скопирована');return;}}catch(e){if(e.name==='AbortError')return;}actionDialog('Пригласить друга',`<p class="muted">Поделитесь ссылкой на моно:</p><label class="field">Ссылка<input readonly value="${esc(url)}"></label>`);}
document.addEventListener('click',e=>{if(e.target.closest('[data-profile-edit]'))editProfile();if(e.target.closest('[data-profile-copy]'))MonoAccess.copyCode();if(e.target.closest('[data-profile-invite]'))invite();});
const person='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3"/><path d="M5 20a7 6 0 0 1 14 0"/></svg>';
function profileName(){return typeof state.settings.profileName==='string'?Array.from(state.settings.profileName).slice(0,20).join(''):'Ваш профиль';}
function safeAvatar(value){return typeof value==='string'&&value.length<180000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';}
function avatar(){const src=safeAvatar(state.settings.profileAvatar);return src?`<img src="${src}" alt="Аватарка">`:person;}
function decorate(){const button=document.querySelector('#helpButton');if(button)button.innerHTML=avatar();}
function resizeAvatar(file){return new Promise((resolve,reject)=>{if(!file||!file.type.startsWith('image/')||file.size>8*1024*1024){reject(Error('Выберите изображение размером до 8 МБ.'));return;}const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{const size=Math.min(img.naturalWidth,img.naturalHeight);if(!size)throw Error();const canvas=document.createElement('canvas');canvas.width=canvas.height=256;canvas.getContext('2d').drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,256,256);const value=canvas.toDataURL('image/jpeg',.85);if(!safeAvatar(value))throw Error();resolve(value);}catch{reject(Error('Не удалось прочитать фото. Попробуйте JPG или PNG.'));}finally{URL.revokeObjectURL(url);}};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Не удалось открыть фото. Попробуйте JPG или PNG.'));};img.src=url;});}
function editProfile(){let image=safeAvatar(state.settings.profileAvatar);actionDialog('Ваш профиль',`<form class="profile-edit-form"><div class="profile-avatar profile-avatar-preview">${avatar()}</div><label class="secondary avatar-upload">Выбрать фото<input type="file" accept="image/*" class="sr-only" name="avatar"></label><button type="button" class="secondary" data-avatar-reset>Убрать фото</button><label class="field">Имя · до 20 символов<input name="name" maxlength="20" required value="${esc(profileName())}" autocomplete="nickname"></label><p class="form-error" role="alert" hidden></p><button type="submit" class="primary">Сохранить</button></form>`,(f,form)=>{const name=f.get('name').trim();if(!name||Array.from(name).length>20)throw Error('Введите имя — до 20 символов.');if(commit(s=>{s.settings.profileName=name;s.settings.profileAvatar=image;},'Профиль сохранён')){decorate();document.querySelector('#actionDialog').close();}});
 const form=document.querySelector('.profile-edit-form'),button=form.querySelector('[type=submit]'),error=form.querySelector('.form-error');let revision=0;
 form.querySelector('[name=avatar]').onchange=async event=>{const ticket=++revision;button.disabled=true;error.hidden=true;try{const result=await resizeAvatar(event.target.files[0]);if(ticket!==revision)return;image=result;form.querySelector('.profile-avatar-preview').innerHTML=`<img src="${result}" alt="Аватарка">`;}catch(e){if(ticket===revision){error.textContent=e.message;error.hidden=false;}}finally{if(ticket===revision)button.disabled=false;}};
 form.querySelector('[data-avatar-reset]').onclick=()=>{revision++;image='';button.disabled=false;error.hidden=true;form.querySelector('[name=avatar]').value='';form.querySelector('.profile-avatar-preview').innerHTML=person;};
}
// No billing or Telegram verification service is configured yet. Never trust local flags as paid access.
// ---------- Доступ: пробный период, Премиум, код, синхронизация ----------
const CFG=root.MONO_CONFIG||{},AK='mono-access',SK='mono-sync',hex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
let acc={},premium=false,syncTimer=null,syncing=false;
try{acc=JSON.parse(localStorage.getItem(AK))||{};}catch{}
const save=()=>{try{localStorage.setItem(AK,JSON.stringify(acc));}catch{}};
if(!acc.deviceId){acc.deviceId=hex(16);acc.secret=hex(32);save();}
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const call=(path,opt={})=>fetch(CFG.apiBase+path,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+acc.deviceId+'.'+acc.secret,...(opt.headers||{})}});
const redraw=()=>{if(typeof page==='string'&&page==='profile')render();};
function localCode(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(100000+a[0]%900000);}
async function ensureCode(){
 if(acc.code&&!acc.provisional)return;
 if(CFG.apiBase){try{const r=await call('/v1/register',{method:'POST',body:JSON.stringify({deviceId:acc.deviceId,secretHash:await sha(acc.secret)})});if(r.ok){const j=await r.json();acc.code=String(j.code);acc.provisional=false;save();redraw();return;}}catch{}return;}
 if(!acc.code){acc.code=localCode();acc.provisional=true;save();redraw();}
}
async function verifyToken(t){
 try{if(!t||t.deviceId!==acc.deviceId||!CFG.publicKey||Date.parse(t.premiumUntil)<=Date.now())return false;
  const key=await crypto.subtle.importKey('jwk',CFG.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const sig=Uint8Array.from(atob(t.sig),c=>c.charCodeAt(0));
  return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,sig,new TextEncoder().encode(t.deviceId+'.'+t.premiumUntil));
 }catch{return false;}
}
async function refresh(force=false){
 if(CFG.apiBase&&(force||!acc.checkedAt||Date.now()-acc.checkedAt>12*3600e3)){
  try{const r=await call('/v1/entitlement');if(r.ok){const j=await r.json();if(j.code&&(!acc.code||acc.provisional)){acc.code=String(j.code);acc.provisional=false;}acc.token=j.token||null;acc.checkedAt=Date.now();save();}}catch{}
 }
 const was=premium;premium=(await verifyToken(acc.token))||!!(CFG.devMode&&acc.devUntil>Date.now());
 if(premium&&!was)reconcile();if(was!==premium||page==='profile'||page==='settings')render?.();
}
const meta=()=>{try{return JSON.parse(localStorage.getItem(SK))||{};}catch{return {};}};
const setMeta=m=>{try{localStorage.setItem(SK,JSON.stringify(m));}catch{}};
function queueSync(){const m=meta();m.updatedAt=new Date().toISOString();setMeta(m);if(!premium||!CFG.apiBase)return;clearTimeout(syncTimer);syncTimer=setTimeout(push,1500);}
async function push(){
 if(syncing){queueSync();return;}syncing=true;
 try{const m=meta(),r=await call('/v1/state',{method:'PUT',body:JSON.stringify({updatedAt:m.updatedAt||new Date().toISOString(),state})});if(r.ok){const j=await r.json();m.revision=j.revision;m.syncedAt=new Date().toISOString();setMeta(m);}}catch{}finally{syncing=false;}
}
async function reconcile(){
 if(!premium||!CFG.apiBase)return;
 try{const r=await call('/v1/state');if(r.status===404){push();return;}if(!r.ok)return;
  const j=await r.json(),m=meta();
  if(!m.updatedAt||Date.parse(j.updatedAt)>Date.parse(m.updatedAt)){
   if(!E.validateState(j.state))return;
   try{localStorage.setItem('mono-backup-before-sync',JSON.stringify(state));}catch{}
   const wasProblem=storageProblem;storageProblem=false;
   if(!persist(E.migrate(j.state),{remote:true})){storageProblem=wasProblem;return;}
   m.updatedAt=j.updatedAt;m.revision=j.revision;m.syncedAt=new Date().toISOString();setMeta(m);
   refreshAccounts();applyTheme();renderHomeReminders();if(page!=='home')render();notify('Данные загружены с сервера');
  }else if(Date.parse(m.updatedAt)>Date.parse(j.updatedAt))push();
 }catch{}
}
async function copyCode(){
 const c=acc.code;if(!c)return;
 try{await navigator.clipboard.writeText(c);}catch{const t=document.createElement('textarea');t.value=c;t.setAttribute('readonly','');t.style.cssText='position:fixed;opacity:0;top:0';document.body.append(t);t.select();try{document.execCommand('copy');}catch{}t.remove();}
 notify('Код скопирован',true);
}
function premiumDialog(reason){
 const text={voice:'Голосовой ввод доступен в пробной версии (7 дней) и в Премиум.',export:'Выгрузка данных доступна только в Премиум.'}[reason]||'';
 actionDialog('Премиум',`${text?`<p class="muted">${esc(text)}</p>`:''}${codeBlock()}${premiumLink()}`);
}
const trialLeft=()=>trial(state.settings.profileTrialStartedAt);
root.MonoAccess={
 canSetPIN:()=>false,
 isPremium:()=>premium,
 canUseVoice:()=>premium||trialLeft().remaining>0,
 canExport:()=>premium,
 trialDays:()=>trialLeft().remaining,
 codeText:()=>acc.code?acc.code.slice(0,3)+' '+acc.code.slice(3):'',
 copyCode,queueSync,refresh,
 devGrant:days=>{if(!CFG.devMode)return false;acc.devUntil=Date.now()+days*864e5;save();refresh();return true;}
};
root.MonoProfile={render:renderProfile,startTrial,socials,trial,decorate,safeAvatar,profileName,premiumDialog};decorate();
startTrial();
ensureCode().then(()=>refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden){ensureCode().then(()=>refresh(true));}});
addEventListener('online',()=>{ensureCode().then(()=>refresh(true));});
})(window);
