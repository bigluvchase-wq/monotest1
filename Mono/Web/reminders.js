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
// Повтор напоминаний — как у платежей. anchor — исходная дата, от неё считаются повторы;
// date — ближайшее ещё не выполненное напоминание.
const repeats=()=>MonoSchedule.label;
const isRepeat=r=>r.repeat&&r.repeat!=='once';
const anchorOf=r=>({date:r.anchor||r.date,repeat:r.repeat});
// следующее напоминание строго после даты day
function nextAfter(r,day){return MonoSchedule.next(anchorOf(r),MonoSchedule.addDays(day,1));}
// все даты повторов в месяце, начиная с текущего напоминания
function datesIn(r,month){if(!isRepeat(r))return r.date.startsWith(month)?[r.date]:[];return MonoSchedule.datesInMonth(anchorOf(r),month).filter(d=>d>=r.date);}
// прошедшие дни повторяющихся напоминаний переносим на ближайший день
function roll(){
 const today=E.dateString(new Date()),stale=list().filter(r=>isRepeat(r)&&r.date<today);
 if(!stale.length)return;
 const next=structuredClone(state);
 for(const r of next.reminders)if(isRepeat(r)&&r.date<today){r.anchor=r.anchor||r.date;r.date=MonoSchedule.next(anchorOf(r),today);r.done=false;}
 persist(next);
}
function defaults(){const d=new Date();d.setMinutes(0,0,0);d.setHours(d.getHours()+1);if(E.dateString(d)!==E.dateString(new Date())){d.setHours(9);}return {date:E.dateString(d),time:pad(d.getHours())+':00'};}
function dayWord(date){if(date===E.dateString(new Date()))return 'Сегодня';if(date===tomorrow())return 'Завтра';return fmtDate(date);}
function group(r){if(r.done)return 'done';if(stamp(r)<nowStamp())return 'late';if(r.date===E.dateString(new Date()))return 'today';if(r.date===tomorrow())return 'tomorrow';return 'later';}
const titles={late:'Просрочено',today:'Сегодня',tomorrow:'Завтра',later:'Позже',done:'Выполнено'};
function card(r){
 const g=group(r);
 return `<div class="card goal-card reminder-card ${g==='late'?'is-late':''} ${r.done?'is-done':''}" data-reminder-id="${esc(r.id)}"><button type="button" class="reminder-check" data-toggle-reminder="${esc(r.id)}" aria-label="${r.done?'Вернуть в список':'Отметить выполненным'}" aria-pressed="${r.done?'true':'false'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button><button type="button" class="reminder-main" data-edit-reminder="${esc(r.id)}"><strong>${esc(r.title)}</strong>${r.text?`<span class="reminder-text">${esc(r.text)}</span>`:''}<small>${bell}${esc(dayWord(r.date))} · ${esc(r.time)}${isRepeat(r)?' · '+esc(repeats()[r.repeat].toLowerCase()):''}${g==='late'?' · просрочено':''}</small></button></div>`;
}
// Календарь напоминаний — как у платежей: раскрывается по нажатию на значок календаря
const CAL='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M8 3v4m8-4v4M3.5 10h17M8 14h2m4 0h2M8 17.2h2"/></svg>';
let calMonth=E.dateString(new Date()).slice(0,7),calDay=E.dateString(new Date()),calOpen=false;
const longDate=d=>new Date(d+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
function dayRow(r){return `<button type="button" class="agenda-payment" data-open-reminder="${esc(r.id)}"><span>${esc(r.title)}${r.done||r.text?`<small>${r.done?'Выполнено':esc(r.text)}</small>`:''}</span><strong>${esc(r.time)}</strong><span aria-hidden="true">›</span></button>`;}
function calendar(){
 const period=MonoPeriod.month(calMonth),count=Number(period.end.slice(8)),offset=(new Date(period.start+'T12:00:00').getDay()+6)%7,today=E.dateString(new Date());
 const days=Array.from({length:offset},()=>'<span class="agenda-day-space"></span>');
 for(let n=1;n<=count;n++){const date=calMonth+'-'+String(n).padStart(2,'0'),items=list().filter(r=>datesIn(r,calMonth).includes(date));
  days.push(`<button type="button" class="agenda-day ${date===calDay?'selected':''} ${date===today?'today':''}" data-rem-day="${date}" aria-pressed="${date===calDay}" aria-label="${esc(longDate(date))}${items.length?', напоминаний: '+items.length:''}"><span>${n}</span><i class="agenda-dots">${items.slice(0,3).map(r=>`<b class="${r.done?'paid':''}"></b>`).join('')}</i></button>`);}
 const dayItems=calDay?.startsWith(calMonth)?list().filter(r=>datesIn(r,calMonth).includes(calDay)).sort((a,b)=>a.time.localeCompare(b.time)):[];
 return `<div class="agenda-calendar-head"><button class="icon-btn" type="button" data-rem-month="-1" aria-label="Предыдущий месяц">‹</button><strong>${esc(new Date(period.start+'T12:00:00').toLocaleDateString('ru-RU',{month:'long',year:'numeric'}))}</strong><button class="icon-btn" type="button" data-rem-month="1" aria-label="Следующий месяц">›</button></div><div class="agenda-weekdays">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<span>${d}</span>`).join('')}</div><div class="agenda-grid">${days.join('')}</div><div class="agenda-day-details">${calDay?.startsWith(calMonth)?`<p class="agenda-selected-date">${esc(longDate(calDay))}</p>${dayItems.map(dayRow).join('')||'<p class="muted tiny">Нет напоминаний</p>'}`:''}</div>`;
}
function agenda(){
 const today=E.dateString(new Date()),items=list().filter(r=>r.date===today),pending=items.filter(r=>!r.done).length;
 const status=!items.length?'Нет напоминаний':!pending?'Все напоминания выполнены':pending===1?'Есть напоминание на сегодня':'Есть напоминания на сегодня';
 return `<section class="card payments-agenda reminders-agenda ${calOpen?'is-open':''}"><button type="button" class="agenda-toggle" aria-expanded="${calOpen}" aria-controls="reminderCalendar"><span><strong>${esc(longDate(today))}</strong><small>${status}</small></span><span class="agenda-chevron agenda-cal-icon" aria-hidden="true">${CAL}</span></button><div class="agenda-calendar-reveal" id="reminderCalendar" ${calOpen?'':'inert'} aria-hidden="${!calOpen}"><div class="agenda-calendar-inner">${calendar()}</div></div></section>`;
}
function refreshCalendar(){const inner=document.querySelector('.reminders-agenda .agenda-calendar-inner');if(inner)inner.innerHTML=calendar();}
document.addEventListener('click',e=>{
 if(page!=='reminders')return;const t=e.target;
 const open=t.closest('[data-open-reminder]');if(open){form(open.dataset.openReminder);return;}
 const day=t.closest('[data-rem-day]');if(day){calDay=day.dataset.remDay;refreshCalendar();return;}
 const nav=t.closest('[data-rem-month]');if(nav){try{calMonth=MonoPeriod.shift(calMonth,Number(nav.dataset.remMonth));calDay=null;refreshCalendar();}catch(error){notify(error.message);}return;}
 const card=t.closest('.reminders-agenda');
 if(card&&(t.closest('.agenda-toggle')||!t.closest('button,.agenda-calendar-reveal'))){calOpen=!calOpen;const reveal=card.querySelector('.agenda-calendar-reveal');card.classList.toggle('is-open',calOpen);card.querySelector('.agenda-toggle').setAttribute('aria-expanded',String(calOpen));reveal.inert=!calOpen;reveal.setAttribute('aria-hidden',String(!calOpen));}
});
function render(){
 roll();
 const items=list().slice().sort((a,b)=>stamp(a).localeCompare(stamp(b)));
 const groups={late:[],today:[],tomorrow:[],later:[],done:[]};
 for(const r of items)groups[group(r)].push(r);
 groups.done.reverse();groups.done=groups.done.slice(0,20);
 const body=['late','today','tomorrow','later','done'].filter(k=>groups[k].length).map(k=>`<section class="reminder-group"><h2 class="reminder-group-title">${titles[k]}</h2><div class="goal-list reminder-list">${groups[k].map(card).join('')}</div></section>`).join('');
 return `<div class="section-row"><button class="secondary" data-action="reminder">+ Добавить</button></div><p class="muted">Скажите: «напомни накормить кота сегодня в 6 вечера» — моно создаст напоминание.</p>${agenda()}${body||empty('Пока нет напоминаний','Потяните вниз, чтобы добавить.',false)}`;
}
function form(id,pre={}){
 if(!requireAccess('reminders'))return;
 const r=list().find(x=>x.id===id),def=defaults();
 const date=r?.date||pre.date||(calOpen&&calDay&&calDay>=E.dateString(new Date())?calDay:def.date),time=r?.time||pre.time||def.time;
 actionDialog(r?'Изменить напоминание':'Новое напоминание',`<form class="reminder-form"><label class="field">Название<input name="title" maxlength="120" required value="${esc(r?.title??pre.title??'')}" placeholder="Накормить кота"></label><label class="field">Текст<textarea name="text" rows="3" maxlength="1000" placeholder="Что именно напомнить">${esc(r?.text??pre.text??'')}</textarea></label><div class="form-grid">${pickerField('Когда напомнить','date','date',date)}${pickerField('Во сколько','time','time',time)}</div><label class="field">Повтор<select name="repeat">${Object.entries(repeats()).map(([v,t])=>`<option value="${v}" ${(r?.repeat||pre.repeat||'once')===v?'selected':''}>${t}</option>`).join('')}</select></label><p class="tiny muted">Напоминание придёт уведомлением iPhone. Включите уведомления в настройках моно, чтобы оно приходило и при закрытом приложении.</p><button class="primary">Сохранить напоминание</button>${r?'<button type="button" class="secondary danger" id="deleteReminder">Удалить напоминание</button>':''}</form>`,f=>{
  const title=f.get('title').trim(),text=(f.get('text')||'').trim(),date=f.get('date'),time=f.get('time'),repeat=Object.hasOwn(repeats(),f.get('repeat'))?f.get('repeat'):'once';
  if(!title)throw Error('Введите название.');
  if(!date||!validTime(time))throw Error('Проверьте дату и время.');
  const value={id:r?.id||uid(),title:title.slice(0,120),text:text.slice(0,1000),date,time,repeat,anchor:date,done:r&&stamp(r)===date+'T'+time&&r.repeat===repeat?!!r.done:false,createdAt:r?.createdAt||new Date().toISOString()};
  if(commit(s=>{s.reminders=Array.isArray(s.reminders)?s.reminders:[];const i=s.reminders.findIndex(x=>x.id===value.id);if(i<0)s.reminders.push(value);else s.reminders[i]=value;},'Напоминание сохранено')){
   delete seen[value.id+'|'+value.date];saveSeen();
   $('#actionDialog').close();
  }
 });
 const del=$('#deleteReminder');
 if(del)del.onclick=()=>{if(!confirm('Удалить напоминание?'))return;if(commit(s=>{s.reminders=(s.reminders||[]).filter(x=>x.id!==id);},'Напоминание удалено'))$('#actionDialog').close();};
}
function toggle(id){
 const cur=list().find(x=>x.id===id);
 if(cur&&isRepeat(cur)&&!cur.done){const nextDate=nextAfter(cur,cur.date);if(commit(s=>{const r=s.reminders.find(x=>x.id===id);r.anchor=r.anchor||r.date;r.date=nextDate;r.done=false;}))notify('Готово. Следующее: '+dayWord(nextDate).toLowerCase()+' в '+cur.time,true);return;}
 commit(s=>{const r=(s.reminders||[]).find(x=>x.id===id);if(r)r.done=!r.done;});
}
// Для главного экрана: сегодняшние и просроченные невыполненные
function forHome(){roll();const today=E.dateString(new Date());return list().filter(r=>!r.done&&r.date<=today).sort((a,b)=>stamp(a).localeCompare(stamp(b)));}
// Подсветить карточку после перехода с главного экрана
function focus(id){const el=document.querySelector(`[data-reminder-id="${CSS.escape(id)}"]`);if(!el)return;const y=el.getBoundingClientRect().top+scrollY-innerHeight/3;if(y>0)scrollTo({top:y,behavior:reducedMotion()?'auto':'smooth'});el.classList.add('reminder-flash');setTimeout(()=>el.classList.remove('reminder-flash'),1600);}
// Уведомления iPhone
function nativeItems(){
 const now=nowStamp();
 const items=[];
 for(const r of list()){
  if(!validTime(r.time))continue;const text='Напоминание: '+r.title+(r.text?' — '+r.text:'');
  if(!isRepeat(r)){if(!r.done&&stamp(r)>now)items.push({id:'note|'+r.id,date:r.date,time:r.time,text});continue;}
  let d=r.date;for(let i=0;i<8&&d;i++){if(d+'T'+r.time>now)items.push({id:'note|'+r.id+'|'+d,date:d,time:r.time,text});d=nextAfter(r,d);}
 }
 return items;
}
// Напоминания внутри приложения, пока оно открыто
let seen={};try{seen=JSON.parse(localStorage.getItem('mono-notes-seen'))||{};}catch{}
function saveSeen(){seen=Object.fromEntries(Object.entries(seen).sort((a,b)=>b[1]-a[1]).slice(0,300));try{localStorage.setItem('mono-notes-seen',JSON.stringify(seen));}catch{}}
function check(){
 if(typeof state!=='object'||state.settings.notifications?.reminders===false||document.hidden||holding||listening||tourActive||document.querySelector('dialog[open]'))return;
 const now=Date.now(),key=r=>r.id+'|'+r.date,due=list().filter(r=>{if(r.done||seen[key(r)])return false;const t=new Date(r.date+'T'+r.time+':00').getTime();return t<=now&&now-t<36*3600e3;});
 if(!due.length)return;
 due.forEach(r=>seen[key(r)]=Date.now());saveSeen();
 notify(due.length===1?'Напоминание: '+due[0].title+(due[0].text?' — '+due[0].text:''):'Напоминание: '+due[0].title+' и ещё '+(due.length-1));
 if(page==='reminders')window.render();renderHomeReminders();
}
setInterval(check,15000);document.addEventListener('visibilitychange',check);setTimeout(check,2500);
root.MonoReminders={render,form,toggle,forHome,focus,nativeItems,list,bell};
})(window);
