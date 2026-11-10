(function(root){
'use strict';
// Напоминания: название, текст, дата и время. Приходят уведомлением iPhone (через native-bridge)
// и внутри приложения, пока оно открыто.
const pad=x=>String(x).padStart(2,'0');
const stamp=r=>r.date+'T'+r.time;
const nowStamp=()=>{const d=new Date();return E.dateString(d)+'T'+pad(d.getHours())+':'+pad(d.getMinutes());};
const list=()=>Array.isArray(state.reminders)?state.reminders:[];
function defaults(){const d=new Date();d.setMinutes(0,0,0);d.setHours(d.getHours()+1);if(d.getDate()!==new Date().getDate()){d.setDate(new Date().getDate()+1);d.setHours(9);}return {date:E.dateString(d),time:pad(d.getHours())+':00'};}
function dayWord(date){const today=E.dateString(new Date()),t=new Date();t.setDate(t.getDate()+1);if(date===today)return 'Сегодня';if(date===E.dateString(t))return 'Завтра';return fmtDate(date);}
function group(r){const now=nowStamp();if(r.done)return 'done';if(stamp(r)<now)return 'late';const today=E.dateString(new Date());if(r.date===today)return 'today';const t=new Date();t.setDate(t.getDate()+1);if(r.date===E.dateString(t))return 'tomorrow';return 'later';}
const titles={late:'Просрочено',today:'Сегодня',tomorrow:'Завтра',later:'Позже',done:'Выполнено'};
function card(r){
 const g=group(r);
 return `<div class="card reminder-card ${g==='late'?'is-late':''} ${r.done?'is-done':''}" data-reminder-id="${esc(r.id)}"><button class="reminder-check" data-toggle-reminder="${esc(r.id)}" aria-label="${r.done?'Вернуть в список':'Отметить выполненным'}" aria-pressed="${r.done?'true':'false'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button><button class="reminder-main" data-edit-reminder="${esc(r.id)}"><strong>${esc(r.title)}</strong>${r.text?`<span class="reminder-text">${esc(r.text)}</span>`:''}<small>${esc(dayWord(r.date))} · ${esc(r.time)}${g==='late'?' · просрочено':''}</small></button></div>`;
}
function render(){
 const items=list().slice().sort((a,b)=>stamp(a).localeCompare(stamp(b)));
 const groups={late:[],today:[],tomorrow:[],later:[],done:[]};
 for(const r of items)groups[group(r)].push(r);
 groups.done.reverse();groups.done=groups.done.slice(0,15);
 const body=['late','today','tomorrow','later','done'].filter(k=>groups[k].length).map(k=>`<section class="reminder-group"><h2 class="reminder-group-title">${titles[k]}</h2><div class="reminder-list">${groups[k].map(card).join('')}</div></section>`).join('');
 return `<div class="section-row"><button class="secondary" data-action="reminder">+ Добавить</button></div><p class="muted">Скажите: «напомни завтра в девять утра позвонить врачу» — Моно создаст напоминание.</p>${body||empty('Напоминаний пока нет','Потяните вниз для добавления или скажите голосом.',false)}`;
}
function form(id,pre={}){
 const r=list().find(x=>x.id===id),def=defaults();
 const date=r?.date||pre.date||def.date,time=r?.time||pre.time||def.time;
 actionDialog(r?'Изменить напоминание':'Новое напоминание',`<form class="reminder-form"><label class="field">Название<input name="title" maxlength="120" required value="${esc(r?.title??pre.title??'')}" placeholder="Позвонить врачу"></label><label class="field">Текст напоминания<textarea name="text" rows="3" maxlength="1000" placeholder="Что именно напомнить">${esc(r?.text??pre.text??'')}</textarea></label><div class="form-grid">${pickerField('Дата','date','date',date)}${pickerField('Время','time','time',time)}</div><p class="tiny muted">Напоминание придёт уведомлением. Чтобы оно приходило, когда Моно закрыто, разрешите уведомления в настройках.</p><button class="primary">Сохранить напоминание</button>${r?'<button type="button" class="secondary danger" id="deleteReminder">Удалить</button>':''}</form>`,f=>{
  const title=f.get('title').trim(),text=(f.get('text')||'').trim(),date=f.get('date'),time=f.get('time');
  if(!title)throw Error('Введите название.');
  if(!date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||''))throw Error('Проверьте дату и время.');
  const value={id:r?.id||uid(),title,text,date,time,done:r&&stamp(r)===date+'T'+time?!!r.done:false,createdAt:r?.createdAt||new Date().toISOString()};
  if(commit(s=>{s.reminders=s.reminders||[];const i=s.reminders.findIndex(x=>x.id===value.id);if(i<0)s.reminders.push(value);else s.reminders[i]=value;},'Напоминание сохранено')){
   try{const seen=JSON.parse(localStorage.getItem('mono-notes-seen')||'{}');delete seen[value.id];localStorage.setItem('mono-notes-seen',JSON.stringify(seen));}catch{}
   $('#actionDialog').close();}
 });
 const del=$('#deleteReminder');if(del)del.onclick=()=>{$('#actionDialog').close();root.MonoDeleteUI.remove({kind:'reminder',id});};
}
function toggle(id){commit(s=>{const r=(s.reminders||[]).find(x=>x.id===id);if(r)r.done=!r.done;});}
function homeHTML(){
 const today=E.dateString(new Date());
 return list().filter(r=>!r.done&&r.date<=today).sort((a,b)=>stamp(a).localeCompare(stamp(b))).slice(0,3).map(r=>`<button class="reminder note-reminder" data-home-note="${esc(r.id)}"><span>${esc(r.title)}<small>${r.date<today?'Просрочено · ':''}${esc(r.time)}${r.text?' · '+esc(r.text):''}</small></span><span>›</span></button>`).join('');
}
// Напоминания внутри приложения, пока оно открыто
let seen={};try{seen=JSON.parse(localStorage.getItem('mono-notes-seen'))||{};}catch{}
function check(){
 if(typeof state!=='object'||document.hidden||document.body.classList.contains('offscreen-locked')||holding||listening||tourActive||document.querySelector('dialog[open]'))return;
 const now=Date.now(),due=list().filter(r=>{if(r.done||seen[r.id])return false;const t=new Date(r.date+'T'+r.time+':00').getTime();return t<=now&&now-t<36*3600e3;});
 if(!due.length)return;
 due.forEach(r=>seen[r.id]=Date.now());
 seen=Object.fromEntries(Object.entries(seen).sort((a,b)=>b[1]-a[1]).slice(0,300));
 try{localStorage.setItem('mono-notes-seen',JSON.stringify(seen));}catch{}
 notify(due.length===1?'Напоминание: '+due[0].title+(due[0].text?' — '+due[0].text:''):'Напоминание: '+due[0].title+' и ещё '+(due.length-1),false,{duration:9000});
 if(page==='reminders')window.render?.();renderHomeReminders();
}
setInterval(check,15000);document.addEventListener('visibilitychange',check);setTimeout(check,1200);
root.MonoReminders={render,form,toggle,homeHTML,list};
})(window);
