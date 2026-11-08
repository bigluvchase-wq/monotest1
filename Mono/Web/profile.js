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
const socialPaths={telegram:'<path d="m3 10 18-7-5 18-5-7-8-4zm8 4 10-11M11 14v5l4-3"/>',vk:'<path d="M3 6h4c0 5 2 8 4 9V6h4v5c2-1 3-3 4-5h3c-1 4-3 6-5 7 2 1 4 3 5 6h-4c-1-2-2-4-3-4v4h-2C6 19 3 13 3 6z"/>',instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>'};
function socials(){return `<div class="support-socials">${Object.entries(socialPaths).map(([key,path])=>`<button type="button" disabled aria-label="${{telegram:'Telegram',vk:'VK',instagram:'Instagram'}[key]} — ссылка пока не добавлена" title="Ссылка пока не добавлена"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg></button>`).join('')}</div><p class="tiny muted">Ссылки на соцсети скоро появятся.</p>`;}
function codeBlock(){
 const code=MonoAccess.codeText();
 const hint=code?'Это твой личный код.':accessAvailable?'Код появится, когда приложение подключится к серверу.':'Откройте Моно снова, чтобы загрузить ваш код.';
 return `<section class="card profile-code"><h3>Код привязки</h3><div class="code-row"><strong class="profile-code-value">${esc(code||'··· ···')}</strong><button type="button" class="secondary" data-profile-copy ${code?'':'disabled'}>Копировать</button></div><p class="tiny muted">${hint}</p></section>`;
}

// 🛒 Функция создания платежа через сервер на VPS
async function handlePaymentClick(price = 129, planTitle = 'Месяц') {
 const deviceCode = acc.code ? acc.code.replace(/\s+/g, '') : '';
 if (!deviceCode) {
