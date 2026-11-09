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
  const max=Math.max(...totals,0),bars=monthly.querySelector('.monthly-bars'),n=buckets.length;
  const format=new Intl.DateTimeFormat(locale,{month:'short',...(daily?{day:'numeric'}:{}),timeZone:'UTC'});
  const colour=monthlyType==='income'?'var(--green)':'var(--accent)',step=Math.max(1,Math.ceil(n/6));
  const yOf=v=>max?100-(6+v/max*88):94,xOf=i=>(i+.5)/n*100;
  const points=totals.map((v,i)=>[xOf(i),yOf(v)]);
  // Плавная кривая (Catmull–Rom → Безье), значения не уходят ниже нуля.
  const curve=pts=>{const k=pts.length;if(k===1)return `M0 ${pts[0][1].toFixed(2)} L100 ${pts[0][1].toFixed(2)}`;
   const dx=[],m=[],t=new Array(k);for(let i=0;i<k-1;i++){dx[i]=pts[i+1][0]-pts[i][0];m[i]=(pts[i+1][1]-pts[i][1])/dx[i];}
   t[0]=m[0];t[k-1]=m[k-2];for(let i=1;i<k-1;i++)t[i]=m[i-1]*m[i]<=0?0:(m[i-1]+m[i])/2;
   for(let i=0;i<k-1;i++){if(m[i]===0){t[i]=t[i+1]=0;continue;}const A=t[i]/m[i],B=t[i+1]/m[i],S=A*A+B*B;if(S>9){const q=3/Math.sqrt(S);t[i]=q*A*m[i];t[i+1]=q*B*m[i];}}
   let d=`M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
   for(let i=0;i<k-1;i++){const h=dx[i]/3;d+=` C${(pts[i][0]+h).toFixed(2)} ${(pts[i][1]+t[i]*h).toFixed(2)} ${(pts[i+1][0]-h).toFixed(2)} ${(pts[i+1][1]-t[i+1]*h).toFixed(2)} ${pts[i+1][0].toFixed(2)} ${pts[i+1][1].toFixed(2)}`;}
   return d;};
  const line=curve(points),areaPath=n>1?`${line} L${points[n-1][0].toFixed(2)} 100 L${points[0][0].toFixed(2)} 100 Z`:`${line} L100 100 L0 100 Z`;
  const average=n?graphTotal/n:0,peak=totals.indexOf(max);
  bars.style.setProperty('--columns',n);bars.style.setProperty('--bar-colour',colour);
  const svg=`<svg class="line-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${colour};stop-opacity:.34"/><stop offset="1" style="stop-color:${colour};stop-opacity:0"/></linearGradient></defs><line class="grid" x1="0" x2="100" y1="6" y2="6"/><line class="grid" x1="0" x2="100" y1="50" y2="50"/><line class="grid" x1="0" x2="100" y1="94" y2="94"/>${max&&n>1?`<line class="avg" x1="0" x2="100" y1="${yOf(average).toFixed(2)}" y2="${yOf(average).toFixed(2)}"/>`:''}<path class="area" d="${areaPath}" fill="url(#lineGrad)"/><path class="line" d="${line}"/></svg>`;
  const caption=(bucket,start,end)=>{const short=format.format(new Date(start+'T12:00:00Z')).replace(/\.$/,''),endMonth=format.format(new Date(end+'T12:00:00Z')).replace(/\.$/,'');return !daily&&start.slice(0,7)!==end.slice(0,7)?short+'–'+endMonth:short;};
  const columns=buckets.map((bucket,i)=>{
   const {start,end}=bucket,amount=totals[i],label=MonoPeriod.label(bucket,locale,true);
   return `<button type="button" data-monthly-pick="${start}" data-amount="${amount}" data-label="${esc(label)}"${i%step?' data-skip':''} aria-label="${esc(label+' · '+money(amount,selectedCurrency))}"><span class="monthly-track" aria-hidden="true"><span style="--h:${(max?6+amount/max*88:6).toFixed(1)}%"></span></span><span class="monthly-cap">${esc(caption(bucket,start,end))}</span></button>`;
  }).join('');
  const peakTag=max>0?`<span class="line-peak" aria-hidden="true" style="left:${xOf(peak).toFixed(2)}%;top:calc(4px + var(--track-h) * ${(yOf(max)/100).toFixed(3)})">${money(max,selectedCurrency)}</span>`:'';
  bars.innerHTML=svg+columns+peakTag;
  let stats=monthly.querySelector('.monthly-stats');
  if(!stats){stats=document.createElement('div');stats.className='monthly-stats';monthly.append(stats);}
  stats.innerHTML=`<div><small>Итого</small><b>${money(graphTotal,selectedCurrency)}</b></div><div><small>${daily?'В день':'За интервал'}</small><b>${money(Math.round(average/100)*100,selectedCurrency)}</b></div><div><small>Максимум</small><b>${money(max,selectedCurrency)}</b></div>`;
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
  if(!chart.open||MonoCharts.isBusy()||moving)return;
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
 async function changeMonth(step){if(!chart.open||picker.open||moving||isMonthly()||MonoCharts.isBusy())return;let month;try{month=MonoPeriod.shift(selectedMonth,step);}catch(e){notify(e.message);return;}if(reducedMotion()){resetMotion();apply(month);return;}moving=true;const token=++epoch,sign=step>0?1:-1,easing='cubic-bezier(.22,1,.36,1)';
 animations=monthNodes().map(el=>el.animate([{transform:el.style.transform||'translateX(0)',opacity:el.style.opacity||1,filter:'blur(0px)'},{transform:`translateX(${-sign*70}px)`,opacity:0,filter:'blur(2px)'}],{duration:200,easing,fill:'forwards'}));await Promise.allSettled(animations.map(a=>a.finished));if(token!==epoch||!chart.open)return;animations.forEach(a=>a.cancel());resetMotion();apply(month);
 animations=monthNodes().map(el=>el.animate([{transform:`translateX(${sign*70}px)`,opacity:0,filter:'blur(2px)'},{transform:'translateX(0)',opacity:1,filter:'blur(0px)'}],{duration:390,easing,fill:'both'}));await Promise.allSettled(animations.map(a=>a.finished));if(token===epoch){animations.forEach(a=>a.cancel());animations=[];moving=false;resetMotion();}}

 panel.addEventListener('click',event=>{if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();return;}const graph=event.target.closest('[data-monthly-chart]');if(graph){if(!isMonthly())toggleMonthly(graph);return;}const view=event.target.closest('[data-chart-view]');if(view){if(isMonthly())toggleMonthly(panel.querySelector('[data-monthly-chart]'));return;}const month=event.target.closest('[data-monthly-pick]');if(month){if(performance.now()<scrubUntil)return;selectPreview(preview===month.dataset.monthlyPick?'':month.dataset.monthlyPick);return;}if(event.target.closest('.chart-period-button')){cancelMotion();choose();}const b=event.target.closest('[data-chart-month]');if(b)changeMonth(Number(b.dataset.chartMonth));},{capture:true});
 panel.addEventListener('change',event=>{if(event.target.matches('[data-graph-category]')){category=event.target.value;preview='';renderMonthly();}});
 picker.querySelector('.period-close').onclick=()=>picker.close();picker.querySelectorAll('[data-period-mode]').forEach(b=>b.onclick=()=>showMode(b.dataset.periodMode));picker.querySelectorAll('[data-period-kind]').forEach(b=>b.onclick=()=>selectKind(b.dataset.periodKind));
 form.onsubmit=event=>{event.preventDefault();try{const p=mode==='range'?MonoPeriod.range(form.elements.from.value,form.elements.to.value):MonoPeriod.preset(kind,form.elements.anchor.value);picker.close();apply(p.start.slice(0,7),mode==='preset'?{...p,kind}:p);}catch(e){const error=picker.querySelector('.form-error');error.textContent=e.message;error.hidden=false;}};
 panel.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0||moving||isMonthly()||MonoCharts.isBusy()||!e.target.closest('.chart-morph-space'))return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,horizontal:false,cancelled:false};},{passive:true});
 panel.addEventListener('pointermove',e=>{const g=gesture;if(!g||g.id!==e.pointerId||g.cancelled)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.horizontal){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){g.cancelled=true;return;}if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.4)return;g.horizontal=true;}g.dx=dx;pullMonth(dx);if(e.cancelable)e.preventDefault();},{passive:false});
 panel.addEventListener('pointerup',e=>{const g=gesture;if(!g||g.id!==e.pointerId)return;gesture=null;if(g.horizontal&&!g.cancelled){suppressUntil=performance.now()+300;if(Math.abs(g.dx)>65){changeMonth(g.dx<0?1:-1);return;}}resetMotion();},{passive:true});panel.addEventListener('pointercancel',()=>{gesture=null;resetMotion();},{passive:true});chart.addEventListener('close',()=>{cancelMotion();gesture=null;if(picker.open)picker.close();monthlyType='';preview='';category='';});
 root.MonoMonthMotion={cancel:cancelMotion,isBusy:()=>moving};root.MonoChartPeriod={changeMonth,isMonthly,refreshMonthly:renderMonthly};
})(window);
