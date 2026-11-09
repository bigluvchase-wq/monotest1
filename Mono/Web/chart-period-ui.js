(function(root){
 'use strict';
 const panel=document.querySelector('#chartPanel'),chart=document.querySelector('#chartDialog'),picker=document.querySelector('#periodDialog'),form=picker.querySelector('form');
 let monthlyType='',preview='',category='',graphTotal=0;
 const monthlyChart=()=>panel.querySelector('#monthlyChart');
 const isMonthly=()=>Boolean(monthlyType);
 function renderMonthly(){
  const monthly=monthlyChart();
  if(!monthly||!monthlyType)return;
  const locale=state.settings.language==='en'?'en-US':'ru-RU',period=selectedPeriod();
  const entries=selectedEntries().filter(e=>e.type===monthlyType&&inChart(e));
  const categories=[...new Set([...((monthlyType==='income'?state.incomeCategories:state.categories)||[]),...entries.map(e=>e.category)])];
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
  const buckets=MonoPeriod.buckets(period),daily=buckets.every(b=>b.start===b.end);
  const byDate=[...amounts];
  const totals=buckets.map(({start,end})=>byDate.reduce((total,[date,amount])=>date>=start&&date<=end?total+amount:total,0));
  const max=Math.max(...totals),bars=monthly.querySelector('.monthly-bars');
  const format=new Intl.DateTimeFormat(locale,{month:'short',...(daily?{day:'numeric'}:{}),timeZone:'UTC'});
  bars.style.setProperty('--columns',buckets.length);
  bars.innerHTML=buckets.map((bucket,i)=>{
   const {start,end}=bucket,amount=totals[i],label=MonoPeriod.label(bucket,locale,true);
   const date=new Date(start+'T12:00:00Z'),short=format.format(date).replace(/\.$/,'');
   const endMonth=format.format(new Date(end+'T12:00:00Z')).replace(/\.$/,'');
   const caption=!daily&&start.slice(0,7)!==end.slice(0,7)?short+'–'+endMonth:short;
   return `<button type="button" data-monthly-pick="${start}" data-amount="${amount}" data-label="${esc(label)}" aria-label="${esc(label+' · '+money(amount,selectedCurrency))}"><span class="monthly-track" aria-hidden="true"><span style="--height:${max?amount/max*100:0}%;--bar-colour:var(--${monthlyType==='income'?'green':'accent'})"></span></span><span>${esc(caption)}</span></button>`;
  }).join('');
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
 function toggleMonthly(button){
  if(!chart.open||MonoCharts.isBusy()||moving)return;
  const active=!isMonthly();
  monthlyType=active?button.dataset.monthlyChart:'';
  if(active){cancelMotion();preview='';renderMonthly();}
  panel.querySelector('.chart-details-content').classList.toggle('show-monthly',active);
  button.setAttribute('aria-pressed',String(active));
  button.textContent=active?'Категории':'График';
  monthlyChart().inert=!active;
  for(const selector of ['.chart-ring-stage','.chart-totals>.chart-details-total:not(.monthly-total)','.chart-colour-legend','.chart-category-list','.chart-category-filter','.chart-transaction-list']){
   panel.querySelector(selector).inert=active;
  }
  panel.querySelector('.monthly-total').inert=!active;
 }
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
 async function changeMonth(step){if(!chart.open||picker.open||moving||isMonthly()||MonoCharts.isBusy())return;let month;try{month=MonoPeriod.shift(selectedMonth,step);}catch(e){notify(e.message);return;}if(reducedMotion()){resetMotion();apply(month);return;}moving=true;const token=++epoch,sign=step>0?1:-1,easing='cubic-bezier(.22,1,.36,1)';
 animations=monthNodes().map(el=>el.animate([{transform:el.style.transform||'translateX(0)',opacity:el.style.opacity||1,filter:'blur(0px)'},{transform:`translateX(${-sign*70}px)`,opacity:0,filter:'blur(2px)'}],{duration:200,easing,fill:'forwards'}));await Promise.allSettled(animations.map(a=>a.finished));if(token!==epoch||!chart.open)return;animations.forEach(a=>a.cancel());resetMotion();apply(month);
 animations=monthNodes().map(el=>el.animate([{transform:`translateX(${sign*70}px)`,opacity:0,filter:'blur(2px)'},{transform:'translateX(0)',opacity:1,filter:'blur(0px)'}],{duration:390,easing,fill:'both'}));await Promise.allSettled(animations.map(a=>a.finished));if(token===epoch){animations.forEach(a=>a.cancel());animations=[];moving=false;resetMotion();}}

 panel.addEventListener('click',event=>{if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();return;}const graph=event.target.closest('[data-monthly-chart]');if(graph){toggleMonthly(graph);return;}const month=event.target.closest('[data-monthly-pick]');if(month){selectPreview(preview===month.dataset.monthlyPick?'':month.dataset.monthlyPick);return;}if(event.target.closest('.chart-period-button')){cancelMotion();choose();}const b=event.target.closest('[data-chart-month]');if(b)changeMonth(Number(b.dataset.chartMonth));},{capture:true});
 panel.addEventListener('change',event=>{if(event.target.matches('[data-graph-category]')){category=event.target.value;preview='';renderMonthly();}});
 picker.querySelector('.period-close').onclick=()=>picker.close();picker.querySelectorAll('[data-period-mode]').forEach(b=>b.onclick=()=>showMode(b.dataset.periodMode));picker.querySelectorAll('[data-period-kind]').forEach(b=>b.onclick=()=>selectKind(b.dataset.periodKind));
 form.onsubmit=event=>{event.preventDefault();try{const p=mode==='range'?MonoPeriod.range(form.elements.from.value,form.elements.to.value):MonoPeriod.preset(kind,form.elements.anchor.value);picker.close();apply(p.start.slice(0,7),mode==='preset'?{...p,kind}:p);}catch(e){const error=picker.querySelector('.form-error');error.textContent=e.message;error.hidden=false;}};
 panel.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0||moving||isMonthly()||MonoCharts.isBusy()||!e.target.closest('.chart-morph-space'))return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,horizontal:false,cancelled:false};},{passive:true});
 panel.addEventListener('pointermove',e=>{const g=gesture;if(!g||g.id!==e.pointerId||g.cancelled)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.horizontal){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){g.cancelled=true;return;}if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.4)return;g.horizontal=true;}g.dx=dx;pullMonth(dx);if(e.cancelable)e.preventDefault();},{passive:false});
 panel.addEventListener('pointerup',e=>{const g=gesture;if(!g||g.id!==e.pointerId)return;gesture=null;if(g.horizontal&&!g.cancelled){suppressUntil=performance.now()+300;if(Math.abs(g.dx)>65){changeMonth(g.dx<0?1:-1);return;}}resetMotion();},{passive:true});panel.addEventListener('pointercancel',()=>{gesture=null;resetMotion();},{passive:true});chart.addEventListener('close',()=>{cancelMotion();gesture=null;if(picker.open)picker.close();monthlyType='';preview='';category='';});
 root.MonoMonthMotion={cancel:cancelMotion,isBusy:()=>moving};root.MonoChartPeriod={changeMonth,isMonthly,refreshMonthly:renderMonthly};
})(window);
