(function(root){
 'use strict';
 const panel=document.querySelector('#chartPanel'),chart=document.querySelector('#chartDialog'),picker=document.querySelector('#periodDialog'),form=picker.querySelector('form');
 const monthly=document.querySelector('#monthlyDialog');
 let monthlyType='expense',year=0;
 function renderMonthly(){
  const locale=state.settings.language==='en'?'en-US':'ru-RU';
  const format=new Intl.DateTimeFormat(locale,{month:'short',timeZone:'UTC'});
  const full=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'});
  const totals=Array(12).fill(0),prefix=String(year).padStart(4,'0');
  for(const e of state.entries)if(e.type===monthlyType&&inChart(e)&&e.date.slice(0,4)===prefix&&entryCurrency(e)===selectedCurrency)totals[Number(e.date.slice(5,7))-1]+=e.amount;
  const max=Math.max(...totals);
  monthly.querySelector('#monthlyTitle').textContent=monthlyType==='income'?'Доходы по месяцам':'Расходы по месяцам';
  monthly.querySelector('.monthly-year-value').textContent=year;
  monthly.querySelector('[data-monthly-year="-1"]').disabled=year===1;
  monthly.querySelector('[data-monthly-year="1"]').disabled=year===9999;
  monthly.querySelector('.monthly-scale').textContent=max?'Максимум за месяц: '+money(max,selectedCurrency):'За этот год операций нет · '+selectedCurrency;
  const bars=totals.map((amount,i)=>{
   const month=prefix+'-'+String(i+1).padStart(2,'0'),date=new Date(month+'-01T12:00:00Z');
   const label=full.format(date)+' · '+money(amount,selectedCurrency),height=max?amount/max*100:0;
   return `<button type="button" data-monthly-pick="${month}" aria-label="${esc(label)}" aria-current="${month===selectedMonth?'date':'false'}"><span class="monthly-track" aria-hidden="true"><span style="--height:${height}%;--bar-colour:var(--${monthlyType==='income'?'green':'accent'})"></span></span><span>${esc(format.format(date).replace(/\.$/,''))}</span></button>`;
  });
  monthly.querySelector('.monthly-bars').innerHTML=bars.join('');
 }
 monthly.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.classList.contains('monthly-close'))monthly.close();
  if(button.dataset.monthlyYear){year+=Number(button.dataset.monthlyYear);renderMonthly();}
  if(button.dataset.monthlyPick){monthly.close();panel.scrollTop=0;apply(button.dataset.monthlyPick);}
 });
 function openMonthly(type){
  if(!chart.open||monthly.open||MonoCharts.isBusy())return;
  cancelMotion();monthlyType=type;year=Number(selectedPeriod().start.slice(0,4));renderMonthly();monthly.showModal();
 }
 let mode='preset',kind='month',gesture=null,suppressUntil=0,moving=false,epoch=0,animations=[];
 function showMode(value){mode=value;picker.querySelectorAll('[data-period-mode]').forEach(b=>{const on=b.dataset.periodMode===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});picker.querySelector('.period-preset-fields').hidden=mode!=='preset';picker.querySelector('.period-range-fields').hidden=mode!=='range';for(const name of ['from','to']){form.elements[name].required=mode==='range';form.elements[name].disabled=mode!=='range';}form.elements.anchor.disabled=mode!=='preset';form.elements.anchor.required=mode==='preset';picker.querySelector('.form-error').hidden=true;}
 function selectKind(value){kind=value;picker.querySelectorAll('[data-period-kind]').forEach(b=>{const on=b.dataset.periodKind===kind;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});}
 function choose(){const p=selectedPeriod(),today=E.dateString(new Date()),anchor=today>=p.start&&today<=p.end?today:p.start;form.elements.anchor.value=anchor;form.elements.from.value=p.start;form.elements.to.value=p.end;const match=['week','month','year'].find(k=>{const r=MonoPeriod.preset(k,anchor);return r.start===p.start&&r.end===p.end;});selectKind(match||'month');showMode(match?'preset':'range');picker.showModal();}
 function apply(month,range=null){selectedMonth=month;selectedRange=range;render();MonoCharts.refresh();}
 const monthNodes=()=>[...panel.querySelectorAll('.chart-summary,.chart-ring-stage,.chart-colour-legend,.chart-category-list,.chart-transaction-list')];
 function resetMotion(){monthNodes().forEach(el=>{el.style.transform='';el.style.opacity='';el.style.filter='';});}
 function cancelMotion(){epoch++;animations.forEach(a=>a.cancel());animations=[];moving=false;resetMotion();}
 function pullMonth(dx){monthNodes().forEach(el=>{el.style.transform=`translateX(${dx*.35}px)`;el.style.opacity=String(1-Math.min(.25,Math.abs(dx)/450));});}
 async function changeMonth(step){if(!chart.open||picker.open||moving||MonoCharts.isBusy())return;let month;try{month=MonoPeriod.shift(selectedMonth,step);}catch(e){notify(e.message);return;}if(reducedMotion()){resetMotion();apply(month);return;}moving=true;const token=++epoch,sign=step>0?1:-1,easing='cubic-bezier(.22,1,.36,1)';
 animations=monthNodes().map(el=>el.animate([{transform:el.style.transform||'translateX(0)',opacity:el.style.opacity||1,filter:'blur(0px)'},{transform:`translateX(${-sign*70}px)`,opacity:0,filter:'blur(2px)'}],{duration:200,easing,fill:'forwards'}));await Promise.allSettled(animations.map(a=>a.finished));if(token!==epoch||!chart.open)return;animations.forEach(a=>a.cancel());resetMotion();apply(month);
 animations=monthNodes().map(el=>el.animate([{transform:`translateX(${sign*70}px)`,opacity:0,filter:'blur(2px)'},{transform:'translateX(0)',opacity:1,filter:'blur(0px)'}],{duration:390,easing,fill:'both'}));await Promise.allSettled(animations.map(a=>a.finished));if(token===epoch){animations.forEach(a=>a.cancel());animations=[];moving=false;resetMotion();}}

 panel.addEventListener('click',event=>{if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();return;}const graph=event.target.closest('[data-monthly-chart]');if(graph){openMonthly(graph.dataset.monthlyChart);return;}if(event.target.closest('.chart-period-button')){cancelMotion();choose();}const b=event.target.closest('[data-chart-month]');if(b)changeMonth(Number(b.dataset.chartMonth));},{capture:true});
 picker.querySelector('.period-close').onclick=()=>picker.close();picker.querySelectorAll('[data-period-mode]').forEach(b=>b.onclick=()=>showMode(b.dataset.periodMode));picker.querySelectorAll('[data-period-kind]').forEach(b=>b.onclick=()=>selectKind(b.dataset.periodKind));
 form.onsubmit=event=>{event.preventDefault();try{const p=mode==='range'?MonoPeriod.range(form.elements.from.value,form.elements.to.value):MonoPeriod.preset(kind,form.elements.anchor.value);picker.close();apply(p.start.slice(0,7),mode==='preset'&&kind==='month'?null:p);}catch(e){const error=picker.querySelector('.form-error');error.textContent=e.message;error.hidden=false;}};
 panel.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0||moving||MonoCharts.isBusy()||!e.target.closest('.chart-morph-space'))return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,horizontal:false,cancelled:false};},{passive:true});
 panel.addEventListener('pointermove',e=>{const g=gesture;if(!g||g.id!==e.pointerId||g.cancelled)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.horizontal){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){g.cancelled=true;return;}if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.4)return;g.horizontal=true;}g.dx=dx;pullMonth(dx);if(e.cancelable)e.preventDefault();},{passive:false});
 panel.addEventListener('pointerup',e=>{const g=gesture;if(!g||g.id!==e.pointerId)return;gesture=null;if(g.horizontal&&!g.cancelled){suppressUntil=performance.now()+300;if(Math.abs(g.dx)>65){changeMonth(g.dx<0?1:-1);return;}}resetMotion();},{passive:true});panel.addEventListener('pointercancel',()=>{gesture=null;resetMotion();},{passive:true});chart.addEventListener('close',()=>{cancelMotion();gesture=null;if(picker.open)picker.close();if(monthly.open)monthly.close();});
 root.MonoMonthMotion={cancel:cancelMotion,isBusy:()=>moving};root.MonoChartPeriod={changeMonth};
})(window);
