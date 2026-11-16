(function(root){
'use strict';
const D=root.MonoSharedData;let group=null,current=null,base=null,rev=0,dirty=false,busy=false,timer=null,offerBypass=false,conflictOpen=false,lastError='',incoming=[],shownInvites=new Set(),switching=false;
const active=()=>!!current,storageKey=()=>current?'mono-together-'+current:null;
const request=(path,body)=>MonoAccess.togetherRequest(path,body);
const errors={already_paired:'Один из участников уже состоит в паре.',target_not_found:'Этот ID не найден.',invalid_target:'Проверьте ID партнёра.',invitation_limit:'Сегодня отправлено слишком много приглашений.',invitation_expired:'Приглашение уже закрыто или истекло.',not_member:'Доступ к совместному счёту закрыт.'};
function message(e){return errors[e.message]||({unauthorized:'Откройте профиль и проверьте привязку устройства.',wrong_key:'Ключ устройства не подошёл. Проверьте привязку в профиле.',shared_unavailable:'Сервер временно недоступен.'}[e.message])||(e.name==='TypeError'?'Нет связи с сервером. Проверьте сеть.':e.message);}
function display(shared){const copy=structuredClone(shared);copy.reminders=copy.reminders||[];copy.deposits=copy.deposits||[];const personal=JSON.parse(localStorage.getItem(KEY)||'null');for(const k of ['theme','language','profileName','profileAvatar','notifyAsked','notifyGranted','notifications','home'])if(personal?.settings?.[k]!==undefined)copy.settings[k]=structuredClone(personal.settings[k]);copy.settings.onboarded=true;return copy;}
function redraw(){voiceAccount=state.accounts[0].id;selectedCurrency=state.accounts[0].currency;drafts=[];cancelParse();refreshAccounts();renderHomeReminders();root.MonoHome?.render();if(page!=='home')render();window.MonoNative?.refreshReminders();window.MonoNative?.pushWidget?.();decorate();}
async function switchTo(shared){
 if(storageProblem)throw Error('Сначала восстановите личную историю из резервной копии.');
 if(holding||listening)cancelVoice();
 if(shared){if(!group){await poll();if(!group)throw Error('Сначала примите приглашение.');}if(active())return;localStorage.setItem(KEY,JSON.stringify(state));const cache=localStorage.getItem('mono-together-'+group.id);let value=cache?JSON.parse(cache):null;if(value&&(!E.validateState(value.local)||!E.validateState(value.base)||!Number.isSafeInteger(value.rev)||value.rev<0))throw Error('Не удалось прочитать совместную копию.');const previous={state,current,base,rev,dirty};try{current=group.id;base=value?.base||D.wire(group.state);rev=value?.rev??group.rev;state=display(value?.local||group.state);dirty=!!value?.dirty;store();}catch(error){({state,current,base,rev,dirty}=previous);throw error;}}
 else {if(!active())return;if(dirty&&!busy&&!conflictOpen)await sync(true);if(dirty)notify('Изменения «Вместе» сохранены на телефоне. Откройте общий счёт с сетью, чтобы отправить их.');store();const personal=JSON.parse(localStorage.getItem(KEY));if(!E.validateState(personal))throw Error('Не удалось прочитать личную историю.');current=null;state=E.migrate(personal);base=null;dirty=false;}
 redraw();if(active())sync();else MonoAccess.queueSync();
}
// State is kept separately from personal mono-v2, including an offline base revision.
function store(){if(!current)return;localStorage.setItem('mono-together-'+current,JSON.stringify({base,local:D.wire(state),rev,dirty}));}
function saveLocal(next){if(!current)throw Error('Нет совместного пространства');localStorage.setItem('mono-together-'+current,JSON.stringify({base,local:D.wire(next),rev,dirty:true}));}
function queueSync(){dirty=true;store();try{const personal=JSON.parse(localStorage.getItem(KEY));if(personal){for(const k of ['theme','language','profileName','profileAvatar','notifyAsked','notifyGranted','notifications','home'])if(state.settings[k]!==undefined)personal.settings[k]=structuredClone(state.settings[k]);localStorage.setItem(KEY,JSON.stringify(personal));}}catch{notify('Совместная запись сохранена. Личные настройки не удалось обновить.');}clearTimeout(timer);timer=setTimeout(sync,700);}

function apply(remote){state=display(remote.state);base=D.wire(remote.state);rev=remote.rev;dirty=false;group=remote;store();redraw();}
async function resolve(remote,prefer){const merged=D.merge(base,D.wire(state),D.wire(remote.state),prefer);if(!E.validateState(merged.state)){notify('Конфликт связанных записей. Локальная копия сохранена; исправьте записи перед повторной синхронизацией.');return false;}base=D.wire(remote.state);rev=remote.rev;state=display(merged.state);dirty=true;store();redraw();return true;}
async function sync(force=false){if(!current||busy||conflictOpen||document.hidden||!force&&document.querySelector('dialog[open]'))return;busy=true;const id=current;
 try{const status=await request('status');if(id!==current)return;if(!status.group||status.group.id!==id){await switchTo(false);localStorage.removeItem('mono-together-'+id);localStorage.removeItem('mono-together-'+id+'-view');notify('Совместный доступ закрыт. Личная история сохранена.');return;}
 const remote=status.group;group=remote;
 if(!dirty){if(remote.rev!==rev)apply(remote);return;}
 if(remote.rev!==rev){const merged=D.merge(base,D.wire(state),D.wire(remote.state));if(merged.conflicts.length){conflictOpen=true;actionDialog('Одну запись изменили вдвоём',`<p class="muted">Есть ${merged.conflicts.length} конфликтов изменения/удаления. Остальные изменения объединятся. До выбора ваша копия сохранена на телефоне.</p><button class="primary" data-conflict="local">Для конфликтов оставить мои изменения</button><button class="secondary full" data-conflict="remote">Для конфликтов принять изменения партнёра</button>`);document.querySelectorAll('[data-conflict]').forEach(b=>b.onclick=async()=>{conflictOpen=false;$('#actionDialog').close();if(await resolve(remote,b.dataset.conflict))sync();});return;}if(!await resolve(remote,null))return;}
 const sent=D.wire(state),sentRev=rev;const result=await request('save',{groupId:id,rev:sentRev,state:sent});if(id!==current)return;base=sent;rev=result.rev;dirty=!D.equal(sent,D.wire(state));lastError='';store();if(dirty){clearTimeout(timer);timer=setTimeout(sync,600);}
 }catch(e){if(e.status!==409&&lastError!==e.message){lastError=e.message;notify('Совместная синхронизация: '+message(e));}}finally{busy=false;}}
function receive(status){group=status.group;incoming=group?[]:status.incoming||[];}
async function poll(){
 if(busy||document.hidden)return;
 try{const r=await request('status');receive(r);decorate();if(active())sync();return r;}catch{return null;}
}
function modeButton(){return group?`<button type="button" class="secondary together-mode" data-together="toggle" aria-label="Режим: ${active()?'Вместе':'Личный'}. Переключить" aria-pressed="${active()}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/>${active()?'<path d="M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/>':''}</svg> ${active()?'Вместе':'Личный'}</button>`:'';}
// Read-only account summaries for the home sheet, including both private/shared scopes.
function pickerGroups(){
 if(!group)return [{label:'Личные счета',accounts:state.accounts.map(a=>({...a,value:a.id,balance:E.balance(state,a.id)}))}];
 const personal=active()?JSON.parse(localStorage.getItem(KEY)):state;
 const shared=active()?state:(JSON.parse(localStorage.getItem('mono-together-'+group.id)||'null')?.local||group.state);
 return [{key:'personal',label:'Личные счета',value:personal},{key:'shared',label:'Совместный счёт',value:shared}].map(scope=>({label:scope.label,accounts:scope.value.accounts.map(a=>({...a,name:scope.key==='shared'&&a.id==='main'?'Вместе':a.name,value:scope.key+':'+a.id,balance:E.balance(scope.value,a.id)}))}));
}
function decoratePicker(){
 const picker=document.querySelector('#voiceAccount');if(!picker||!group)return;
 const personal=active()?JSON.parse(localStorage.getItem(KEY)):state;
 const shared=active()?state:(JSON.parse(localStorage.getItem('mono-together-'+group.id)||'null')?.local||group.state);
 picker.innerHTML=[{key:'personal',label:'Личный',value:personal},{key:'shared',label:'Вместе',value:shared}].map(scope=>`<optgroup label="${scope.label}">${scope.value.accounts.map(a=>`<option value="${scope.key}:${esc(a.id)}" ${scope.key===(active()?'shared':'personal')&&a.id===voiceAccount?'selected':''}>${scope.key==='shared'&&a.id==='main'?'Вместе':`${esc(a.name)} · ${a.currency}`}</option>`).join('')}</optgroup>`).join('');
}
async function selectAccount(value){
 if(!/^(personal|shared):/.test(value))return false;
 if(switching){refreshAccounts();return true;}
 switching=true;
 try{const split=value.indexOf(':'),shared=value.slice(0,split)==='shared',id=value.slice(split+1);await switchTo(shared);if(state.accounts.some(a=>a.id===id))voiceAccount=id;refreshAccounts();root.MonoHome?.render();if(page!=='home')render();}
 catch(error){notify(message(error));refreshAccounts();}finally{switching=false;}return true;
}
function showInvitation(){
 if(page!=='home'||document.hidden||holding||listening||document.querySelector('dialog[open]'))return;
 const invite=incoming.find(i=>!shownInvites.has(i.id));if(!invite)return;
 shownInvites.add(invite.id);
 actionDialog('Совместный счёт',`<div class="together-invitation"><p>ID <b>${esc(invite.sender)}</b> хочет создать с вами совместный счёт.</p><p class="muted">Личная история останется только у вас. Общий счёт начнётся с нуля.</p><div class="together-invite-actions"><button class="secondary" data-invite="${esc(invite.id)}" data-accept="0">Отказаться</button><button class="primary" data-invite="${esc(invite.id)}" data-accept="1">Согласиться</button></div></div>`);
}
function decorate(){
 const body=document.querySelector('#pageBody');
 body?.querySelectorAll('.together-switch,.together-mode').forEach(el=>el.remove());
 document.querySelector('#together-home')?.remove();document.querySelector('#together-invites')?.remove();
 if(body&&group){
  if(page==='history')body.querySelector('.ops-head .balance-top')?.insertAdjacentHTML('beforeend',modeButton());
  else if(['accounts','goals','limits','payments','categories','deposits','reminders'].includes(page)){
   const add=body.querySelector('[data-action],.limits-add-category,#categoryForm button.primary');
   if(add){if(page==='categories')add.textContent='+ Добавить';let row=add.closest('.section-row,.action-row,.together-toolbar');if(!row){row=document.createElement('div');add.before(row);row.append(add);}row.classList.add('together-toolbar');row.insertAdjacentHTML('beforeend',modeButton());const lock=row.closest('.premium-lock');if(lock)lock.before(row);}
  }
 }
 decoratePicker();showInvitation();
}
async function manage(){try{const r=await request('status');receive(r);actionDialog('Совместный счёт',`<p class="muted">Личная история остаётся личной. После принятия приглашения создаётся пустое общее пространство на двоих.</p>${r.incoming.map(i=>`<div class="card"><p>Приглашение от ID ${esc(i.sender)}</p><button class="primary" data-invite="${esc(i.id)}" data-accept="1">Принять</button><button class="secondary" data-invite="${esc(i.id)}" data-accept="0">Отклонить</button></div>`).join('')}${group?`<p class="muted">Участников: ${group.members.length}. Выход закроет ваш доступ; у второго участника данные останутся.</p><button class="secondary full" data-together="shared">Открыть «Вместе»</button><button class="secondary danger full" data-together-leave>Выйти из пары</button>`:r.incoming.length?'':`<form id="togetherInvite"><label class="field">ID партнёра<input name="target" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6 цифр"></label><button class="primary">Отправить приглашение</button></form>${r.outgoing.map(i=>`<p class="muted">Ожидаем подтверждение ID ${esc(i.target)}.</p>`).join('')}`}`);decorate();}catch(e){notify('Совместный счёт: '+message(e));}}
function withCurrentScope(fn){const before=offerBypass;offerBypass=true;try{return fn();}finally{offerBypass=before;}}
function offerAccount(){if(offerBypass||group)return false;actionDialog('Добавить счёт',`<button class="primary" data-add-personal>Личный счёт</button><button class="secondary full" data-together="manage">Совместный счёт</button>${active()?'<button class="secondary full" data-add-in-space>Добавить счёт «Вместе»</button>':''}`);$('#actionBody [data-add-personal]').onclick=async()=>{try{await switchTo(false);offerBypass=true;accountForm();}catch(e){notify(message(e));}finally{offerBypass=false;}};const sharedButton=$('#actionBody [data-add-in-space]');if(sharedButton)sharedButton.onclick=()=>withCurrentScope(()=>accountForm());return true;}
// Creation uses the mode selected in the section toolbar.
function offer(){return false;}
document.addEventListener('submit',async e=>{if(e.target.id!=='togetherInvite')return;e.preventDefault();try{await request('invite',{target:new FormData(e.target).get('target')});await manage();notify('Приглашение отправлено. Ждём подтверждения.');}catch(error){notify(message(error));}});
document.addEventListener('click',async e=>{const invite=e.target.closest('[data-invite]'),button=e.target.closest('[data-together]');try{if(invite){await request('respond',{id:invite.dataset.invite,accept:invite.dataset.accept==='1'});await poll();$('#actionDialog').close();notify(invite.dataset.accept==='1'?'Совместный счёт создан. Выберите его в счёте для записи.':'Приглашение отклонено.');return;}if(button){if(button.dataset.together==='manage')return manage();$('#actionDialog').close();if(switching)return;switching=true;try{await switchTo(button.dataset.together==='toggle'?!active():button.dataset.together==='shared');}finally{switching=false;}}if(e.target.closest('[data-together-leave]')){actionDialog('Выйти из пары?',`<p class="muted">Вы потеряете доступ к совместному счёту. Личные данные останутся; у партнёра совместные записи сохранятся.</p><button class="primary danger" id="confirmTogetherLeave">Выйти из пары</button>`);$('#confirmTogetherLeave').onclick=async()=>{try{if(active()&&dirty){await sync(true);if(dirty)throw Error('Сначала синхронизируйте последние изменения.');}const id=group.id;await request('leave');if(active())await switchTo(false);localStorage.removeItem('mono-together-'+id);localStorage.removeItem('mono-together-'+id+'-view');group=null;$('#actionDialog').close();decorate();notify('Вы вышли из пары.');}catch(error){notify(message(error));}};}}catch(error){notify(message(error));}});
document.querySelector('#actionDialog').addEventListener('close',()=>{conflictOpen=false;setTimeout(showInvitation,200);});
function otherNotifications(collect){if(!group)return [];const previous=state;try{state=active()?E.migrate(JSON.parse(localStorage.getItem(KEY))):display(JSON.parse(localStorage.getItem('mono-together-'+group.id)||'null')?.local||group.state);const items=collect();return active()?items:items.filter(i=>!/^(daily|smart|subscription)\|/.test(i.id));}catch{return [];}finally{state=previous;}}
root.MonoTogether={pickerGroups,otherNotifications,decoratePicker,selectAccount,saveLocal,active,storageKey:()=>current?storageKey()+'-view':null,queueSync,decorate,offer,offerAccount,manage,withCurrentScope,flush:()=>sync(true)};
new MutationObserver(()=>{if(page==='home')setTimeout(showInvitation,0);}).observe(document.body,{attributes:true,attributeFilter:['data-page']});
setTimeout(poll,2500);setInterval(()=>active()?sync():poll(),12000);addEventListener('online',()=>active()?sync():poll());document.addEventListener('visibilitychange',()=>{if(!document.hidden)active()?sync():poll();});
})(window);
