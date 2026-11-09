(function(root){
 'use strict';
 const panel=document.querySelector('#chartPanel'),chart=document.querySelector('#chartDialog'),picker=document.querySelector('#periodDialog'),form=picker.querySelector('form');
 let monthlyType='',preview='',category='',graphTotal=0,granularity='day';
 const monthlyChart=()=>panel.querySelector('#monthlyChart');
 const isMonthly=()=>Boolean(monthlyType);
 function renderMonthly(){
  const monthly=monthlyChart();
  if(!monthly||!monthlyType)return;
  const locale=state.settings.language==='en'?'en-US':'ru-RU',period=selectedPeriod();
  const entries=selectedEntries().filter(e=>e.type===monthlyType&&inChart(e));
  const categories=[...new Set([...((monthlyType==='income'?state.incomeCategories:state.categories)||[]),...entries.map(e=>e.category)])];
  if(!monthly.querySelector('.chart-gran')){const g=document.createElement('div');g.className='chart-gran';g.setAttribute('role','group');g.setAttribute('aria-label','Группировка');g.innerHTML='<button type="button" data-gran="day">Дни</button><button type="button" data-gran="week">Недели</button><button type="button" data-gran="month">Месяцы</button>';monthly.insertBefore(g,monthly.querySelector('.monthly-category'));}
  const filter=monthly.querySelector('[data-graph-category]');
  filter.innerHTML='<option value="">Все категории</option>'+categories.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
  if(!categories.includes(category))category='';
  filter.value=category;
  const amounts=new Map();
  graphTotal=0;
  for(const entry of entries){
   if(category&&entry.category!==category)continue;
   amounts.set(entry.date,(amounts.get(entry.date)||0)+entry.amount);
   graphTotal+=entry.amount;
  }
  // Группировка: дни / недели (пн–вс) / месяцы внутри выбранного периода.
  const dayMs=86400000,iso=ms=>new Date(ms).toISOString().slice(0,10),at=d=>Date.parse(d+'T12:00:00Z');
  const spanDays=Math.round((at(period.end)-at(period.start))/dayMs)+1;
  const allowed=['day','week','month'].filter(g=>g!=='day'||spanDays<=93);
  if(!allowed.includes(granularity))granularity=allowed[0];
  const makeBuckets=()=>{
   const list=[];
   if(granularity==='day'){for(let i=0;i<spanDays;i++){const d=iso(at(period.start)+i*dayMs);list.push({start:d,end:d});}return list;}
   if(granularity==='week'){let cursor=at(period.start);while(cursor<=at(period.end)){const dow=(new Date(cursor).getUTCDay()+6)%7,endMs=Math.min(at(period.end),cursor+(6-dow)*dayMs);list.push({start:iso(cursor),end:iso(endMs)});cursor=endMs+dayMs;}return list;}
   let cursor=period.start;while(cursor<=period.end){const monthEnd=iso(Date.UTC(Number(cursor.slice(0,4)),Number(cursor.slice(5,7)),0,12));const end=monthEnd<period.end?monthEnd:period.end;list.push({start:cursor,end});cursor=iso(at(end)+dayMs);}
   return list;
  };
  const buckets=makeBuckets(),daily=granularity==='day';
  monthly.querySelector('.chart-gran')?.querySelectorAll('button').forEach(button=>{button.hidden=!allowed.includes(button.dataset.gran);button.setAttribute('aria-pressed',String(button.dataset.gran===granularity));});
  const byDate=[...amounts];
  const totals=buckets.map(({start,end})=>byDate.reduce((total,[date,amount])=>date>=start&&date<=end?total+amount:total,0));
  const max=Math.max(...totals,0),bars=monthly.querySelector('.monthly-bars'),n=buckets.length;
  const positive=totals.filter(v=>v>0),min=positive.length?Math.min(...positive):0;
  const colour=monthlyType==='income'?'var(--green)':'var(--accent)',step=Math.max(1,Math.ceil(n/6));
  const shortDate=new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',timeZone:'UTC'}),monthName=new Intl.DateTimeFormat(locale,{month:'short',timeZone:'UTC'}),monthYear=new Intl.DateTimeFormat(locale,{month:'short',year:'2-digit',timeZone:'UTC'});
  const clean=t=>t.replace(/\.$/,'');
  const caption=({start,end})=>granularity==='day'?clean(shortDate.format(at(start))):granularity==='week'?(start===end?String(Number(start.slice(8))):start.slice(0,7)===end.slice(0,7)?Number(start.slice(8))+'–'+Number(end.slice(8)):clean(shortDate.format(at(start)))):(period.start.slice(0,4)===period.end.slice(0,4)?clean(monthName.format(at(start))):clean(monthYear.format(at(start))));
  const longLabel=({start,end})=>start===end?MonoPeriod.label({start,end},locale,true):MonoPeriod.label({start,end},locale,true);
  const average=n?graphTotal/n:0,peak=totals.indexOf(max),H=92;
  bars.style.setProperty('--columns',n);bars.style.setProperty('--bar-colour',colour);
  const yOf=v=>100-(max?v/max*H:0);
  const svg=`<svg class="line-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line class="grid" x1="0" x2="100" y1="${yOf(max).toFixed(2)}" y2="${yOf(max).toFixed(2)}"/><line class="grid" x1="0" x2="100" y1="${yOf(max/2).toFixed(2)}" y2="${yOf(max/2).toFixed(2)}"/><line class="grid" x1="0" x2="100" y1="100" y2="100"/>${max&&n>1?`<line class="avg" x1="0" x2="100" y1="${yOf(average).toFixed(2)}" y2="${yOf(average).toFixed(2)}"/>`:''}</svg>`;
  const columns=buckets.map((bucket,i)=>{
   const {start}=bucket,amount=totals[i],label=longLabel(bucket),cls=(i===peak&&max>0?' is-max':'')+(amount>0&&amount===min&&positive.length>1?' is-min':'');
   return `<button type="button" class="${cls.trim()}" data-monthly-pick="${start}" data-amount="${amount}" data-label="${esc(label)}"${i%step?' data-skip':''} aria-label="${esc(label+' · '+money(amount,selectedCurrency))}"><span class="monthly-track" aria-hidden="true"><span style="--h:${(max?amount/max*H:0).toFixed(1)}%;--i:${i}"></span></span><span class="monthly-cap">${esc(caption(bucket))}</span></button>`;
  }).join('');
  const peakTag=max>0?`<span class="line-peak" aria-hidden="true" style="left:${((peak+.5)/n*100).toFixed(2)}%;top:calc(4px + var(--track-h) * ${((100-(max?H:0))/100).toFixed(3)})">${money(max,selectedCurrency)}</span>`:'';
  bars.innerHTML=svg+columns+peakTag;
  const unit=granularity==='day'?'день':granularity==='week'?'неделю':'месяц';
  let stats=monthly.querySelector('.monthly-stats');
  if(!stats){stats=document.createElement('div');stats.className='monthly-stats';monthly.append(stats);}
  const maxBucket=buckets[peak],minBucket=buckets[totals.indexOf(min)];
  stats.innerHTML=`<div><small>Итого</small><b>${money(graphTotal,selectedCurrency)}</b></div><div><small>В среднем за ${unit}</small><b>${money(Math.round(average/100)*100,selectedCurrency)}</b></div><div class="stat-max"><small>Больше всего${max>0?' · '+esc(caption(maxBucket)):''}</small><b>${money(max,selectedCurrency)}</b></div><div class="stat-min"><small>Меньше всего${min>0?' · '+esc(caption(minBucket)):''}</small><b>${min>0?money(min,selectedCurrency):'—'}</b></div>`;
  selectPreview(preview);
 }
 function selectPreview(value){
  const monthly=monthlyChart(),bars=[...monthly.querySelectorAll('[data-monthly-pick]')];
  const selected=bars.find(button=>button.dataset.monthlyPick===value);
  preview=selected?.dataset.monthlyPick||'';
  bars.forEach(b=>b.setAttribute('aria-pressed',String(b===selected)));
  monthly.querySelector('.monthly-month').textContent=selected?.dataset.label||'Итого за период';
  panel.querySelector('.monthly-total').textContent=money(selected?Number(selected.dataset.amount):graphTotal,selectedCurrency);
 }
 function toggleMonthly(button){const ring=panel.querySelector('[data-chart-view]');
  if(!chart.open)return;MonoCharts.settle?.();if(moving)cancelMotion();if(MonoCharts.isBusy())return;
  const active=!isMonthly();
  monthlyType=active?button.dataset.monthlyChart:'';
  if(active){cancelMotion();preview='';renderMonthly();}
  panel.querySelector('.chart-details-content').classList.toggle('show-monthly',active);
  button.setAttribute('aria-pressed',String(active));
  ring?.setAttribute('aria-pressed',String(!active));
  monthlyChart().inert=!active;
  for(const selector of ['.chart-ring-stage','.chart-totals>.chart-details-total:not(.monthly-total)','.chart-colour-legend','.chart-category-list','.chart-category-filter','.chart-transaction-list']){
   panel.querySelector(selector).inert=active;
  }
  panel.querySelector('.monthly-total').inert=!active;
 }
 let scrubUntil=0,scrubbing=false;
 function scrub(e){const bars=e.target.closest?.('.monthly-bars')||panel.querySelector('.monthly-bars');const buttons=[...bars.querySelectorAll('[data-monthly-pick]')];if(!buttons.length)return;const r=bars.getBoundingClientRect(),i=Math.max(0,Math.min(buttons.length-1,Math.floor((e.clientX-r.left)/r.width*buttons.length)));if(buttons[i].dataset.monthlyPick!==preview)selectPreview(buttons[i].dataset.monthlyPick);}
 panel.addEventListener('pointerdown',e=>{if(e.button!==0||!isMonthly()||!e.target.closest('.monthly-bars'))return;scrubbing=true;scrubUntil=performance.now()+450;scrub(e);},{passive:true});
 panel.addEventListener('pointermove',e=>{if(!scrubbing||!isMonthly())return;scrubUntil=performance.now()+450;scrub(e);},{passive:true});
 for(const type of ['pointerup','pointercancel'])panel.addEventListener(type,()=>{scrubbing=false;},{passive:true});
 let mode='preset',kind='month',gesture=null,suppressUntil=0,moving=false,epoch=0,animations=[];
 function showMode(value){mode=value;picker.querySelectorAll('[data-period-mode]').forEach(b=>{const on=b.dataset.periodMode===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});picker.querySelector('.period-preset-fields').hidden=mode!=='preset';picker.querySelector('.period-range-fields').hidden=mode!=='range';for(const name of ['from','to']){form.elements[name].required=mode==='range';form.elements[name].disabled=mode!=='range';}form.elements.anchor.disabled=mode!=='preset';form.elements.anchor.required=mode==='preset';picker.querySelector('.form-error').hidden=true;}
 function selectKind(value){kind=value;picker.querySelectorAll('[data-period-kind]').forEach(b=>{const on=b.dataset.periodKind===kind;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});}
 function choose(){
  const p=selectedPeriod();
  form.elements.anchor.value=p.start;
  form.elements.from.value=p.start;
  form.elements.to.value=p.end;
  selectKind(selectedRange?.kind||'month');
  showMode(selectedRange&&!selectedRange.kind?'range':'preset');
  picker.showModal();
 }
 function apply(month,range=null){
  selectedMonth=month;selectedRange=range;preview='';
  if(isMonthly())monthlyChart().querySelector('.monthly-scroll').scrollLeft=0;
  render();MonoCharts.refresh();
 }
 const monthNodes=()=>[...panel.querySelectorAll('.chart-summary,.chart-ring-stage,.chart-colour-legend,.chart-category-list,.chart-transaction-list')];
 function resetMotion(){monthNodes().forEach(el=>{el.style.transform='';el.style.opacity='';el.style.filter='';});}
 function cancelMotion(){epoch++;animations.forEach(a=>a.cancel());animations=[];moving=false;resetMotion();}
 function pullMonth(dx){monthNodes().forEach(el=>{el.style.transform=`translateX(${dx*.35}px)`;el.style.opacity=String(1-Math.min(.25,Math.abs(dx)/450));});}
 async function changeMonth(step){if(!chart.open||picker.open||isMonthly())return;MonoCharts.settle?.();if(moving)cancelMotion();if(MonoCharts.isBusy())return;let month;try{month=MonoPeriod.shift(selectedMonth,step);}catch(e){notify(e.message);return;}if(reducedMotion()){resetMotion();apply(month);return;}moving=true;const token=++epoch,sign=step>0?1:-1,easing='cubic-bezier(.22,1,.36,1)';
 animations=monthNodes().map(el=>el.animate([{transform:el.style.transform||'translateX(0)',opacity:el.style.opacity||1,filter:'blur(0px)'},{transform:`translateX(${-sign*70}px)`,opacity:0,filter:'blur(2px)'}],{duration:200,easing,fill:'forwards'}));await Promise.allSettled(animations.map(a=>a.finished));if(token!==epoch||!chart.open)return;animations.forEach(a=>a.cancel());resetMotion();apply(month);
 animations=monthNodes().map(el=>el.animate([{transform:`translateX(${sign*70}px)`,opacity:0,filter:'blur(2px)'},{transform:'translateX(0)',opacity:1,filter:'blur(0px)'}],{duration:390,easing,fill:'both'}));await Promise.allSettled(animations.map(a=>a.finished));if(token===epoch){animations.forEach(a=>a.cancel());animations=[];moving=false;resetMotion();}}

 panel.addEventListener('click',event=>{if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();return;}const graph=event.target.closest('[data-monthly-chart]');if(graph){if(!isMonthly())toggleMonthly(graph);return;}const view=event.target.closest('[data-chart-view]');if(view){if(isMonthly())toggleMonthly(panel.querySelector('[data-monthly-chart]'));return;}const gran=event.target.closest('[data-gran]');if(gran){granularity=gran.dataset.gran;preview='';renderMonthly();return;}const month=event.target.closest('[data-monthly-pick]');if(month){if(performance.now()<scrubUntil)return;selectPreview(preview===month.dataset.monthlyPick?'':month.dataset.monthlyPick);return;}if(event.target.closest('.chart-period-button')){cancelMotion();choose();}const b=event.target.closest('[data-chart-month]');if(b)changeMonth(Number(b.dataset.chartMonth));},{capture:true});
 panel.addEventListener('change',event=>{if(event.target.matches('[data-graph-category]')){category=event.target.value;preview='';renderMonthly();}});
 picker.querySelector('.period-close').onclick=()=>picker.close();picker.querySelectorAll('[data-period-mode]').forEach(b=>b.onclick=()=>showMode(b.dataset.periodMode));picker.querySelectorAll('[data-period-kind]').forEach(b=>b.onclick=()=>selectKind(b.dataset.periodKind));
 form.onsubmit=event=>{event.preventDefault();try{const p=mode==='range'?MonoPeriod.range(form.elements.from.value,form.elements.to.value):MonoPeriod.preset(kind,form.elements.anchor.value);picker.close();apply(p.start.slice(0,7),mode==='preset'?{...p,kind}:p);}catch(e){const error=picker.querySelector('.form-error');error.textContent=e.message;error.hidden=false;}};
 panel.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0||moving||isMonthly()||MonoCharts.isBusy()||!e.target.closest('.chart-morph-space'))return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,horizontal:false,cancelled:false};},{passive:true});
 panel.addEventListener('pointermove',e=>{const g=gesture;if(!g||g.id!==e.pointerId||g.cancelled)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.horizontal){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){g.cancelled=true;return;}if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.4)return;g.horizontal=true;}g.dx=dx;pullMonth(dx);if(e.cancelable)e.preventDefault();},{passive:false});
 panel.addEventListener('pointerup',e=>{const g=gesture;if(!g||g.id!==e.pointerId)return;gesture=null;if(g.horizontal&&!g.cancelled){suppressUntil=performance.now()+300;if(Math.abs(g.dx)>65){changeMonth(g.dx<0?1:-1);return;}}resetMotion();},{passive:true});panel.addEventListener('pointercancel',()=>{gesture=null;resetMotion();},{passive:true});chart.addEventListener('close',()=>{cancelMotion();gesture=null;if(picker.open)picker.close();monthlyType='';preview='';category='';granularity='day';});
 root.MonoMonthMotion={cancel:cancelMotion,isBusy:()=>moving};root.MonoChartPeriod={changeMonth,isMonthly,refreshMonthly:renderMonthly};
})(window);
