(function(root){
'use strict';
// Напоминания: название, текст, дата и время. Приходят уведомлением iPhone (через native-bridge)
// и внутри приложения, пока оно открыто. Напоминания на сегодня дублируются на главный экран.
const pad=x=>String(x).padStart(2,'0');
const stamp=r=>r.date+'T'+r.time;
const nowStamp=()=>{const d=new Date();return E.dateString(d)+'T'+pad(d.getHours())+':'+pad(d.getMinutes());};
const list=()=>Array.isArray(state.reminders)?state.reminders:[];
const validTime=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||'');
const tomorrow=()=>{const t=new Date();t.setDate(t.getDate()+1);return E.dateString(t);};
const bell='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>';
function defaults(){const d=new Date();d.setMinutes(0,0,0);d.setHours(d.getHours()+1);if(E.dateString(d)!==E.dateString(new Date())){d.setHours(9);}return {date:E.dateString(d),time:pad(d.getHours())+':00'};}
function dayWord(date){if(date===E.dateString(new Date()))return 'Сегодня';if(date===tomorrow())return 'Завтра';return fmtDate(date);}
function group(r){if(r.done)return 'done';if(stamp(r)<nowStamp())return 'late';if(r.date===E.dateString(new Date()))return 'today';if(r.date===tomorrow())return 'tomorrow';return 'later';}
const titles={late:'Просрочено',today:'Сегодня',tomorrow:'Завтра',later:'Позже',done:'Выполнено'};
function card(r){
 const g=group(r);
 return `<div class="card goal-card reminder-card ${g==='late'?'is-late':''} ${r.done?'is-done':''}" data-reminder-id="${esc(r.id)}"><button type="button" class="reminder-check" data-toggle-reminder="${esc(r.id)}" aria-label="${r.done?'Вернуть в список':'Отметить выполненным'}" aria-pressed="${r.done?'true':'false'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button><button type="button" class="reminder-main" data-edit-reminder="${esc(r.id)}"><strong>${esc(r.title)}</strong>${r.text?`<span class="reminder-text">${esc(r.text)}</span>`:''}<small>${bell}${esc(dayWord(r.date))} · ${esc(r.time)}${g==='late'?' · просрочено':''}</small></button></div>`;
}
function render(){
 const items=list().slice().sort((a,b)=>stamp(a).localeCompare(stamp(b)));
 const groups={late:[],today:[],tomorrow:[],later:[],done:[]};
 for(const r of items)groups[group(r)].push(r);
 groups.done.reverse();groups.done=groups.done.slice(0,20);
 const body=['late','today','tomorrow','later','done'].filter(k=>groups[k].length).map(k=>`<section class="reminder-group"><h2 class="reminder-group-title">${titles[k]}</h2><div class="goal-list reminder-list">${groups[k].map(card).join('')}</div></section>`).join('');
 return `<div class="section-row"><button class="secondary" data-action="reminder">+ Добавить</button></div><p class="muted">Скажите: «напомни накормить кота сегодня в 6 вечера» — моно создаст напоминание.</p>${body||empty('Пока нет напоминаний','Потяните вниз, чтобы добавить.',false)}`;
}
function form(id,pre={}){
 const r=list().find(x=>x.id===id),def=defaults();
 const date=r?.date||pre.date||def.date,time=r?.time||pre.time||def.time;
 actionDialog(r?'Изменить напоминание':'Новое напоминание',`<form class="reminder-form"><label class="field">Название<input name="title" maxlength="120" required value="${esc(r?.title??pre.title??'')}" placeholder="Накормить кота"></label><label class="field">Текст<textarea name="text" rows="3" maxlength="1000" placeholder="Что именно напомнить">${esc(r?.text??pre.text??'')}</textarea></label><div class="form-grid">${pickerField('Когда напомнить','date','date',date)}${pickerField('Во сколько','time','time',time)}</div><p class="tiny muted">Напоминание придёт уведомлением iPhone. Включите уведомления в настройках Моно, чтобы оно приходило и при закрытом приложении.</p><button class="primary">Сохранить напоминание</button>${r?'<button type="button" class="secondary danger" id="deleteReminder">Удалить напоминание</button>':''}</form>`,f=>{
  const title=f.get('title').trim(),text=(f.get('text')||'').trim(),date=f.get('date'),time=f.get('time');
  if(!title)throw Error('Введите название.');
  if(!date||!validTime(time))throw Error('Проверьте дату и время.');
  const value={id:r?.id||uid(),title:title.slice(0,120),text:text.slice(0,1000),date,time,done:r&&stamp(r)===date+'T'+time?!!r.done:false,createdAt:r?.createdAt||new Date().toISOString()};
  if(commit(s=>{s.reminders=Array.isArray(s.reminders)?s.reminders:[];const i=s.reminders.findIndex(x=>x.id===value.id);if(i<0)s.reminders.push(value);else s.reminders[i]=value;},'Напоминание сохранено')){
   delete seen[value.id];saveSeen();
   $('#actionDialog').close();
  }
 });
 const del=$('#deleteReminder');
 if(del)del.onclick=()=>{if(!confirm('Удалить напоминание?'))return;if(commit(s=>{s.reminders=(s.reminders||[]).filter(x=>x.id!==id);},'Напоминание удалено'))$('#actionDialog').close();};
}
function toggle(id){commit(s=>{const r=(s.reminders||[]).find(x=>x.id===id);if(r)r.done=!r.done;});}
// Для главного экрана: сегодняшние и просроченные невыполненные
function forHome(){const today=E.dateString(new Date());return list().filter(r=>!r.done&&r.date<=today).sort((a,b)=>stamp(a).localeCompare(stamp(b)));}
// Подсветить карточку после перехода с главного экрана
function focus(id){const el=document.querySelector(`[data-reminder-id="${CSS.escape(id)}"]`);if(!el)return;const y=el.getBoundingClientRect().top+scrollY-innerHeight/3;if(y>0)scrollTo({top:y,behavior:reducedMotion()?'auto':'smooth'});el.classList.add('reminder-flash');setTimeout(()=>el.classList.remove('reminder-flash'),1600);}
// Уведомления iPhone
function nativeItems(){
 const now=nowStamp();
 return list().filter(r=>!r.done&&validTime(r.time)&&stamp(r)>now).map(r=>({id:'note|'+r.id,date:r.date,time:r.time,text:'Напоминание: '+r.title+(r.text?' — '+r.text:'')}));
}
// Напоминания внутри приложения, пока оно открыто
let seen={};try{seen=JSON.parse(localStorage.getItem('mono-notes-seen'))||{};}catch{}
function saveSeen(){seen=Object.fromEntries(Object.entries(seen).sort((a,b)=>b[1]-a[1]).slice(0,300));try{localStorage.setItem('mono-notes-seen',JSON.stringify(seen));}catch{}}
function check(){
 if(typeof state!=='object'||document.hidden||holding||listening||tourActive||document.querySelector('dialog[open]'))return;
 const now=Date.now(),due=list().filter(r=>{if(r.done||seen[r.id])return false;const t=new Date(r.date+'T'+r.time+':00').getTime();return t<=now&&now-t<36*3600e3;});
 if(!due.length)return;
 due.forEach(r=>seen[r.id]=Date.now());saveSeen();
 notify(due.length===1?'Напоминание: '+due[0].title+(due[0].text?' — '+due[0].text:''):'Напоминание: '+due[0].title+' и ещё '+(due.length-1));
 if(page==='reminders')window.render();renderHomeReminders();
}
setInterval(check,15000);document.addEventListener('visibilitychange',check);setTimeout(check,2500);
root.MonoReminders={render,form,toggle,forHome,focus,nativeItems,list,bell};
})(window);
