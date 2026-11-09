(function(root){
 'use strict';
 const panel=document.querySelector('#chartPanel'),chart=document.querySelector('#chartDialog'),picker=document.querySelector('#periodDialog'),form=picker.querySelector('form');
 let monthlyType='',preview='',category='',accountId='',graph=null;
 const monthlyChart=()=>panel.querySelector('#monthlyChart');
 const isMonthly=()=>Boolean(monthlyType);
 const listDialog=document.querySelector('#graphListDialog');
 listDialog.querySelector('button').onclick=()=>listDialog.close();
 const totalOf=rows=>rows.reduce((total,entry)=>total+entry.amount,0);
 const newest=(a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||'');
 function renderMonthly(){
  const monthly=monthlyChart();
  if(!monthly||!monthlyType)return;
  const period=selectedPeriod(),today=E.dateString(new Date()),locale=state.settings.language==='en'?'en-US':'ru-RU';
  const typeLabel=monthlyType==='income'?'Доходы':'Расходы';
  const categories=monthlyType==='income'?state.incomeCategories:state.categories;
  const accounts=state.accounts.filter(a=>a.currency===selectedCurrency);
  if(!accounts.some(a=>a.id===accountId))accountId='';
  if(!categories.includes(category))category='';
  const categoryFilter=monthly.querySelector('[data-graph-category]');
  categoryFilter.innerHTML='<option value="">Все категории</option>'+categories.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
  categoryFilter.value=category;
  const accountFilter=monthly.querySelector('[data-graph-account]');
  accountFilter.parentElement.hidden=accounts.length<2;
  accountFilter.innerHTML='<option value="">Все счета</option>'+accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
  accountFilter.value=accountId;
  const history=state.entries.filter(e=>e.type===monthlyType&&inChart(e)&&entryCurrency(e)===selectedCurrency&&(!accountId||e.account===accountId));
  const matching=history.filter(e=>!category||e.category===category);
  const rows=MonoPeriod.filter(matching,period,e=>e.date<=today).sort(newest),total=totalOf(rows);
  panel.querySelector('.monthly-total').textContent=money(total,selectedCurrency);
  const empty=monthly.querySelector('.graph-empty');
  empty.textContent=monthlyType==='income'?'За этот период доходов нет':'За этот период расходов нет';
  empty.hidden=rows.length>0;
  monthly.querySelector('[data-graph-clear-category]').hidden=rows.length>0||!category;
  monthly.querySelector('.graph-data').hidden=!rows.length;
  const bars=monthly.querySelector('.monthly-bars');
  if(!rows.length){graph=null;bars.replaceChildren();return;}
  let cursor=rows.length-1;
  const buckets=MonoPeriod.buckets(period).map(bucket=>{
   const end=cursor+1;
   while(cursor>=0&&rows[cursor].date<=bucket.end)cursor--;
   const entries=rows.slice(cursor+1,end);
   return {...bucket,entries,amount:totalOf(entries)};
  });
  graph={buckets,rows,locale};
  const max=buckets.reduce((value,b)=>Math.max(value,b.amount),0);
  const unit=10**Math.floor(Math.log10(max/2));
  const scale=2*Math.ceil(max/2/unit)*unit;
  monthly.querySelector('.graph-scale').innerHTML=[scale,scale/2,0].map(n=>`<span>${esc(money(n,selectedCurrency))}</span>`).join('');
  bars.style.setProperty('--columns',buckets.length);
  const daily=MonoPeriod.daysBetween(period.start,period.end)<35;
  const format=new Intl.DateTimeFormat(locale,{month:'short',...(daily||MonoPeriod.daysBetween(period.start,period.end)<90?{day:'numeric'}:{}),timeZone:'UTC'});
  const labels=new Set(Array.from({length:Math.min(4,buckets.length)},(_,i)=>Math.round(i*(buckets.length-1)/Math.max(1,Math.min(4,buckets.length)-1))));
  bars.innerHTML=buckets.map((bucket,i)=>{
   const {start,amount,entries}=bucket,label=MonoPeriod.label(bucket,locale,true);
   const caption=labels.has(i)?format.format(new Date(start+'T12:00:00Z')).replace(/\.$/,''):'';
   const future=start>today;
   return `<div class="graph-bin"><button type="button" data-monthly-pick="${start}" aria-label="${esc(label+' · '+(future?'Будущий период':money(amount,selectedCurrency)+' · операций: '+entries.length))}" ${future?'disabled':''}><span class="monthly-track" aria-hidden="true">${future?'':`<span style="--height:${amount/scale*100}%;--bar-colour:var(--${monthlyType==='income'?'green':'accent'})"></span>`}</span></button><span class="graph-tick" aria-hidden="true">${esc(caption)}</span></div>`;
  }).join('');
  const end=period.end<today?period.end:today,length=MonoPeriod.daysBetween(period.start,end)+1;
  const previous={start:MonoPeriod.dateAfter(period.start,-length),end:MonoPeriod.dateAfter(period.start,-1)};
  const qualifier=category?` по категории «${category}»`:'';
  const largest=rows.reduce((max,e)=>e.amount>max.amount?e:max);
  const prior=MonoPeriod.filter(matching,previous);
  const canCompare=MonoPeriod.validDate(previous.start)&&(prior.length>0||history.some(e=>e.date<=previous.start));
  const delta=total-totalOf(prior);
  monthly.querySelector('.graph-insight').textContent=canCompare
   ?`${typeLabel}${qualifier} ${delta?`на ${money(Math.abs(delta),selectedCurrency)} ${delta>0?'больше':'меньше'}`:'без изменений'} по сравнению с периодом ${MonoPeriod.label(previous,locale).replace(/\.$/,'')}.`
   :`Крупнейшая операция${qualifier} — ${largest.title}, ${money(largest.amount,selectedCurrency)}.`;
  selectPreview(preview);
 }
 function selectPreview(value){
  if(!graph)return;
  const monthly=monthlyChart(),selected=graph.buckets.find(bucket=>bucket.start===value);
  preview=selected?.start||'';
  monthly.querySelectorAll('[data-monthly-pick]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.monthlyPick===preview)));
  const detail=monthly.querySelector('.graph-selection'),rows=selected?.entries||graph.rows;
  detail.hidden=!selected;
  if(selected){
   detail.querySelector('strong').textContent=MonoPeriod.label(selected,graph.locale,true);
   detail.querySelector('span').textContent=money(selected.amount,selectedCurrency)+' · операций: '+rows.length;
  }
  monthly.querySelector('.graph-operations').innerHTML=rows.slice(0,3).map(e=>entryHTML(e,true,false)).join('');
  const link=monthly.querySelector('[data-graph-list]');
  link.textContent=selected?'Операции за '+MonoPeriod.label(selected,graph.locale,true):'Все операции за период';
 }
 function openList(){
  if(!graph)return;
  const selected=graph.buckets.find(bucket=>bucket.start===preview),rows=selected?.entries||graph.rows;
  listDialog.querySelector('h2').textContent=monthlyChart().querySelector('[data-graph-list]').textContent;
  listDialog.querySelector('.graph-full-list').innerHTML=rows.length?groupedEntriesHTML(rows,false):'<p class="muted">Операций нет</p>';
  listDialog.showModal();
 }
 function toggleMonthly(button){
  if(!chart.open||MonoCharts.isBusy()||moving)return;
  const active=!isMonthly();
  monthlyType=active?button.dataset.monthlyChart:'';
  if(active){cancelMotion();preview='';renderMonthly();}
  panel.querySelector('.chart-details-content').classList.toggle('show-monthly',active);
  button.setAttribute('aria-pressed',String(active));
  button.textContent=active?'Круг':'График';
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
  render();MonoCharts.refresh();
 }
 const monthNodes=()=>[...panel.querySelectorAll('.chart-summary,.chart-ring-stage,.chart-colour-legend,.chart-category-list,.chart-transaction-list')];
 function resetMotion(){monthNodes().forEach(el=>{el.style.transform='';el.style.opacity='';el.style.filter='';});}
 function cancelMotion(){epoch++;animations.forEach(a=>a.cancel());animations=[];moving=false;resetMotion();}
 function pullMonth(dx){monthNodes().forEach(el=>{el.style.transform=`translateX(${dx*.35}px)`;el.style.opacity=String(1-Math.min(.25,Math.abs(dx)/450));});}
 async function changeMonth(step){if(!chart.open||picker.open||moving||isMonthly()||MonoCharts.isBusy())return;let month;try{month=MonoPeriod.shift(selectedMonth,step);}catch(e){notify(e.message);return;}if(reducedMotion()){resetMotion();apply(month);return;}moving=true;const token=++epoch,sign=step>0?1:-1,easing='cubic-bezier(.22,1,.36,1)';
 animations=monthNodes().map(el=>el.animate([{transform:el.style.transform||'translateX(0)',opacity:el.style.opacity||1,filter:'blur(0px)'},{transform:`translateX(${-sign*70}px)`,opacity:0,filter:'blur(2px)'}],{duration:200,easing,fill:'forwards'}));await Promise.allSettled(animations.map(a=>a.finished));if(token!==epoch||!chart.open)return;animations.forEach(a=>a.cancel());resetMotion();apply(month);
 animations=monthNodes().map(el=>el.animate([{transform:`translateX(${sign*70}px)`,opacity:0,filter:'blur(2px)'},{transform:'translateX(0)',opacity:1,filter:'blur(0px)'}],{duration:390,easing,fill:'both'}));await Promise.allSettled(animations.map(a=>a.finished));if(token===epoch){animations.forEach(a=>a.cancel());animations=[];moving=false;resetMotion();}}

 panel.addEventListener('click',event=>{if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();return;}const graph=event.target.closest('[data-monthly-chart]');if(graph){toggleMonthly(graph);return;}if(event.target.closest('[data-graph-clear]')){selectPreview('');return;}if(event.target.closest('[data-graph-clear-category]')){category='';preview='';renderMonthly();return;}if(event.target.closest('[data-graph-list]')){openList();return;}const month=event.target.closest('[data-monthly-pick]');if(month){selectPreview(preview===month.dataset.monthlyPick?'':month.dataset.monthlyPick);return;}if(event.target.closest('.chart-period-button')){cancelMotion();choose();}const b=event.target.closest('[data-chart-month]');if(b)changeMonth(Number(b.dataset.chartMonth));},{capture:true});
 panel.addEventListener('change',event=>{if(event.target.matches('[data-graph-category],[data-graph-account]')){if(event.target.matches('[data-graph-category]'))category=event.target.value;else accountId=event.target.value;preview='';renderMonthly();}});
 picker.querySelector('.period-close').onclick=()=>picker.close();picker.querySelectorAll('[data-period-mode]').forEach(b=>b.onclick=()=>showMode(b.dataset.periodMode));picker.querySelectorAll('[data-period-kind]').forEach(b=>b.onclick=()=>selectKind(b.dataset.periodKind));
 form.onsubmit=event=>{event.preventDefault();try{const p=mode==='range'?MonoPeriod.range(form.elements.from.value,form.elements.to.value):MonoPeriod.preset(kind,form.elements.anchor.value);picker.close();apply(p.start.slice(0,7),mode==='preset'?{...p,kind}:p);}catch(e){const error=picker.querySelector('.form-error');error.textContent=e.message;error.hidden=false;}};
 panel.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0||moving||isMonthly()||MonoCharts.isBusy()||!e.target.closest('.chart-morph-space'))return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,horizontal:false,cancelled:false};},{passive:true});
 panel.addEventListener('pointermove',e=>{const g=gesture;if(!g||g.id!==e.pointerId||g.cancelled)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.horizontal){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){g.cancelled=true;return;}if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.4)return;g.horizontal=true;}g.dx=dx;pullMonth(dx);if(e.cancelable)e.preventDefault();},{passive:false});
 panel.addEventListener('pointerup',e=>{const g=gesture;if(!g||g.id!==e.pointerId)return;gesture=null;if(g.horizontal&&!g.cancelled){suppressUntil=performance.now()+300;if(Math.abs(g.dx)>65){changeMonth(g.dx<0?1:-1);return;}}resetMotion();},{passive:true});panel.addEventListener('pointercancel',()=>{gesture=null;resetMotion();},{passive:true});chart.addEventListener('close',()=>{cancelMotion();gesture=null;if(picker.open)picker.close();monthlyType='';preview='';category='';accountId='';graph=null;});
 root.MonoMonthMotion={cancel:cancelMotion,isBusy:()=>moving};root.MonoChartPeriod={changeMonth,isMonthly,refreshMonthly:renderMonthly};
})(window);
