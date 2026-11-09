/* A shared surface opens from the chosen card; its actual coloured paths bend into a ring. */
(function(root){
 'use strict';
 const dialog=document.querySelector('#chartDialog'),panel=document.querySelector('#chartPanel'),NS='http://www.w3.org/2000/svg';
 let current=null,frame=null,running=false,closed=false,closeQueued=false,animations=[];
 const categoryWord=n=>n%10===1&&n%100!==11?'категория':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'категории':'категорий';
 const duration=680,easing='cubic-bezier(.22,1,.36,1)',closeDuration=460,closeEasing='cubic-bezier(.45,0,.2,1)';
 const bez=(x1,y1,x2,y2)=>{const cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by,X=t=>((ax*t+bx)*t+cx)*t,Y=t=>((ay*t+by)*t+cy)*t,dX=t=>(3*ax*t+2*bx)*t+cx;return x=>{if(x<=0)return 0;if(x>=1)return 1;let t=x;for(let i=0;i<8;i++){const e=X(t)-x;if(Math.abs(e)<1e-5)break;const d=dX(t);if(Math.abs(d)<1e-6)break;t-=e/d;}return Y(Math.min(1,Math.max(0,t)));};};
 const ease=bez(.22,1,.36,1),closeEase=bez(.45,0,.2,1),lerp=(a,b,t)=>a+(b-a)*t;
 function rect(el){const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};}
 function cancelAnimations(){cancelAnimationFrame(frame);frame=null;animations.forEach(a=>a.cancel());animations=[];running=false;}
 function surfaceAnimation(from,to,closing){const clipFor=(r,off=0,radius=23)=>`inset(${(r.top-off).toFixed(1)}px ${(innerWidth-r.left-r.width).toFixed(1)}px ${(innerHeight-(r.top-off)-r.height).toFixed(1)}px ${r.left.toFixed(1)}px round ${radius}px)`,full=clipFor({left:0,top:0,width:innerWidth,height:innerHeight},0,0);
  const frames=closing?[{translate:`0px ${from.top||0}px`,clipPath:full},{translate:'0px 0px',clipPath:clipFor(to)}]:[{clipPath:clipFor(from)},{clipPath:full}];
  const a=panel.animate(frames,{duration:closing?closeDuration:duration,easing:closing?closeEasing:easing,fill:'both'});animations.push(a);const content=panel.querySelector('.chart-details-content'),origin=panel.querySelector('.chart-origin');animations.push(content.animate(closing?[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(12px)'}]:[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:closing?180:370,delay:closing?0:160,fill:'both',easing:'ease-out'}));animations.push(origin.animate(closing?[{opacity:0},{opacity:1}]:[{opacity:1},{opacity:0}],{duration:closing?closeDuration*.45:160,delay:closing?closeDuration*.55:0,fill:'both'}));return a;}
 function svgLayer(){const svg=document.createElementNS(NS,'svg');svg.setAttribute('aria-hidden','true');svg.classList.add('chart-morph-layer');svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);dialog.append(svg);return svg;}
 function drawPath(svg,items,bar,circle,t){
  const total=items.reduce((sum,v)=>sum+v.n,0),parts=items.length?items:[{n:1}];
  if(!svg.childElementCount){
   // The continuous backing follows the same curve and covers antialiasing at the joins.
   const colours=items.length?[palette[(items.length-1)%palette.length],...items.map((_,i)=>palette[i%palette.length])]:['var(--bar)'];
   for(const colour of colours){
    const path=document.createElementNS(NS,'path');
    path.setAttribute('fill','none');path.setAttribute('stroke-linejoin','round');
    path.setAttribute('stroke',colour);svg.append(path);
   }
  }
  const thickness=lerp(bar.height,circle.stroke,t),loop=(1-t)*bar.width<1;
  const point=u=>{
   const angle=-Math.PI/2+2*Math.PI*u;
   const x=lerp(bar.left+bar.width*u,circle.cx+circle.r*Math.cos(angle),t);
   const y=lerp(bar.top+bar.height/2,circle.cy+circle.r*Math.sin(angle),t);
   return `${x.toFixed(2)},${y.toFixed(2)}`;
  };
  const trace=[],overlap=.85/lerp(bar.width,2*Math.PI*circle.r,t);
  let cursor=0;
  parts.forEach((v,i)=>{
   const share=total?v.n/total:1,start=cursor,points=[];
   cursor+=share;
   const count=Math.max(2,Math.ceil(120*share));
   for(let j=0;j<=count;j++)points.push(point(start+share*j/count));
   trace.push(...(i?points.slice(1):points));
   if(items.length){
    if(i<parts.length-1)points.push(point(cursor+Math.min(overlap,parts[i+1].n/total/2)));
    const path=svg.children[i+1];
    path.setAttribute('d','M'+points.join(' L')+(loop&&parts.length===1?' Z':''));
    path.setAttribute('stroke-width',thickness);
   }
  });
  const backing=svg.firstElementChild;
  backing.setAttribute('d','M'+trace.join(' L')+(loop?' Z':''));
  backing.setAttribute('stroke-width',thickness);
 }
 function circleAt(r){return {cx:r.left+r.width/2,cy:r.top+r.height/2,r:r.width*MonoChartRing.radius/MonoChartRing.size,stroke:r.width*MonoChartRing.stroke/MonoChartRing.size};}
 function animatePaths(items,bar,circle,opening,done){
  const svg=svgLayer(),started=performance.now(),length=opening?duration:closeDuration;
  running=true;
  function step(time){
   if(!current||closed)return;
   const t=Math.min(1,(time-started)/length);
   if(t===1){running=false;done();return;}
   drawPath(svg,items,bar,circle,opening?ease(t):1-closeEase(t));
   if(opening&&current.labels)current.labels.style.opacity=String(Math.max(0,Math.min(1,(t-.43)/.38)));
   frame=requestAnimationFrame(step);
  }
  drawPath(svg,items,bar,circle,opening?0:1);frame=requestAnimationFrame(step);
 }
 function showRing(){
  const space=panel.querySelector('.chart-morph-space');
  space.classList.add('ring-ready');
  current.labels?.remove();current.labels=null;
  dialog.querySelector('.chart-morph-layer')?.remove();
 }
 function categoryLegend(values){
  return values.map((v,i)=>`<li><button type="button" class="chart-legend-button" data-chart-category="${i}" aria-pressed="false"><i class="chart-legend-icon" aria-hidden="true" style="color:${palette[i%palette.length]}">${MonoCategoryIcons.category(v.name,current.type)}</i><span>${esc(v.name)}</span></button></li>`).join('');
 }
 function categoryList(values,total){
  return values.map((v,i)=>`<button type="button" class="chart-category-item" data-chart-category="${i}" aria-pressed="false"><i class="category-report-icon" style="color:${palette[i%palette.length]}">${MonoCategoryIcons.category(v.name,current.type)}</i><span>${esc(v.name)}<small>${(v.n/total*100).toFixed(1).replace('.',',')}%</small></span><strong>${money(v.n,selectedCurrency)}</strong></button>`).join('')||'<p class="muted chart-no-data">Пока нет операций</p>';
 }
 function showTransactions(){
  const selected=current.values.find(v=>v.name===current.category),list=panel.querySelector('.chart-transaction-list');
  const rows=selected?current.rows.filter(e=>e.category===selected.name):current.rows;
  const filter=panel.querySelector('.chart-category-filter');
  filter.hidden=!selected;
  filter.querySelector('strong').textContent=selected?.name||'';
  panel.querySelector('.chart-details-total').textContent=money(selected?.n??current.total,selectedCurrency);
  panel.querySelectorAll('[data-chart-category]').forEach(button=>button.setAttribute('aria-pressed',String(current.values[Number(button.dataset.chartCategory)]===selected)));
  list.innerHTML=groupedEntriesHTML(rows);
  root.MonoSwipe?.decorate(list);
 }

 function open(type,button){
  if(dialog.open||running)return;
  const items=selectedEntries().filter(inChart),values=categoryValues(items,type),total=sum(items,type),source=rect(button),bar=rect(button.querySelector('.mini-chart'));
  const rows=items.filter(e=>e.type===type).slice().sort((a,b)=>b.date.localeCompare(a.date));
  current={type,values,rows,total,category:null,closing:false};closed=false;closeQueued=false;
  panel.innerHTML=`<div class="chart-origin summary-pair" aria-hidden="true" style="left:${source.left}px;top:${source.top}px;width:${source.width}px;height:${source.height}px"><div class="operation-card">${button.innerHTML}</div></div>`+`<div class="chart-details-content chart-static-view chart-animated-view"><div class="chart-details-head"><h1 id="chartDetailsTitle">${current.type==='income'?'Доходы':'Расходы'}</h1><button class="chart-close icon-btn" aria-label="Закрыть подробности">×</button></div><div class="chart-summary"><div class="chart-totals"><div class="chart-details-total ${current.type==='income'?'positive':''}">${money(total,selectedCurrency)}</div><div class="monthly-total chart-details-total ${current.type==='income'?'positive':''}" aria-live="polite" inert></div></div><div class="chart-period-actions"><button class="chart-period-button" aria-label="Выбрать период: ${esc(periodLabel())}" aria-haspopup="dialog">${esc(periodLabel(true))}<span aria-hidden="true">⌄</span></button><button type="button" class="chart-period-button" data-monthly-chart="${type}" aria-pressed="false" aria-controls="monthlyChart">График</button></div></div><div class="chart-visual"><div class="chart-ring-stage"><button class="chart-side-arrow" data-chart-month="-1" aria-label="Предыдущий месяц">‹</button><div class="chart-morph-space">${MonoChartRing.render(values,palette,current.type)}<div class="chart-ring-label"><strong>${values.length}</strong><span>${categoryWord(values.length)}</span></div></div><button class="chart-side-arrow" data-chart-month="1" aria-label="Следующий месяц">›</button></div><section class="monthly-chart" id="monthlyChart" aria-label="График за выбранный период" inert><div class="graph-filters"><label class="monthly-category">Категория<select data-graph-category></select></label><label class="monthly-category" hidden>Счёт<select data-graph-account></select></label></div><p class="graph-empty" hidden></p><button type="button" class="secondary" data-graph-clear-category hidden>Все категории</button><div class="graph-data" hidden><div class="graph-plot"><div class="graph-scale" aria-hidden="true"></div><div class="monthly-bars" aria-label="Столбики графика"></div></div><div class="graph-selection" aria-live="polite" hidden><strong></strong><span></span><button type="button" class="secondary" data-graph-clear>Весь период</button></div><p class="graph-insight"></p><div class="graph-operations"></div><button type="button" class="secondary" data-graph-list></button></div></section></div><ul class="chart-colour-legend" aria-label="Цвета категорий">${categoryLegend(values)}</ul><div class="chart-category-list">${categoryList(values,total)}</div><div class="chart-category-filter" hidden><strong></strong><button type="button" class="secondary" data-chart-all>Все категории</button></div><div class="chart-transaction-list"></div></div>`;
  panel.style.cssText='';panel.scrollTop=0;dialog.showModal();document.body.classList.add('chart-detail-open');button.setAttribute('aria-expanded','true');
  panel.querySelector('.chart-close').onclick=close;
  // Removing an operation is handled by the existing guarded deletion flow after closing.
  showTransactions();
  const space=rect(panel.querySelector('.chart-morph-space')),circle=circleAt(space);
  if(reducedMotion()){panel.querySelector('.chart-origin').style.opacity='0';showRing();return;}
  const labelLayer=document.createElementNS(NS,'svg');labelLayer.classList.add('chart-morph-labels');labelLayer.setAttribute('viewBox',`0 0 ${MonoChartRing.size} ${MonoChartRing.size}`);labelLayer.setAttribute('aria-hidden','true');labelLayer.style.cssText=`left:${space.left}px;top:${space.top}px;width:${space.width}px;height:${space.height}px;opacity:0`;const staticRing=panel.querySelector('.chart-static-ring');for(const group of staticRing.querySelectorAll('.chart-ring-icons,.chart-ring-percentages'))labelLayer.append(group.cloneNode(true));dialog.append(labelLayer);current.labels=labelLayer;
  surfaceAnimation(source,null,false);
  animatePaths(values,bar,circle,true,()=>{if(!current)return;cancelAnimations();panel.querySelector('.chart-origin').style.opacity='0';showRing();if(closeQueued){closeQueued=false;close();}});
 }
 function close(options={}){
  if(!current||!dialog.open||current.closing)return;root.MonoMonthMotion?.cancel();if(running){if(!current.closing)closeQueued=true;return;}
  const type=current.type,button=document.querySelector(`[data-operation="${type}"]`);
  if(!button){finish();return;}
  panel.scrollTop=0;
  const source=rect(button),bar=rect(button.querySelector('.mini-chart')),circle=circleAt(rect(panel.querySelector('.chart-morph-space'))),values=current.values;
  const dragOffset=Number(options.dragOffset)||0;panel.style.transform='';
  if(reducedMotion()){finish();return;}
  current.closing=true;panel.querySelector('.chart-morph-space').classList.remove('ring-ready');
  const origin=panel.querySelector('.chart-origin');origin.style.left=source.left+'px';origin.style.top=source.top+'px';origin.style.width=source.width+'px';origin.style.height=source.height+'px';origin.style.opacity='0';
  const transition=surfaceAnimation({left:0,top:dragOffset,width:innerWidth,height:innerHeight},source,true);
  if(root.MonoChartPeriod?.isMonthly()){
   transition.finished.then(finish,()=>{});
   return;
  }
  animatePaths(values,bar,circle,false,()=>finish());
 }
 function finish(){current?.labels?.remove();closed=true;closeQueued=false;const type=current?.type;cancelAnimations();dialog.querySelectorAll('.chart-morph-layer').forEach(el=>el.remove());if(dialog.open)dialog.close();document.body.classList.remove('chart-detail-open');const button=document.querySelector(`[data-operation="${type}"]`);button?.setAttribute('aria-expanded','false');if(root.MonoFocus?.isKeyboard())button?.focus({preventScroll:true});else button?.blur();current=null;panel.innerHTML='';}
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',()=>{if(current)finish();});
 window.addEventListener('pagehide',()=>{if(current)finish();});
 // Keep a static ring attached to the scrollable page after rotation or viewport resizing.
 window.addEventListener('resize',()=>{if(!current)return;if(running){if(current.closing){finish();return;}cancelAnimations();panel.querySelector('.chart-origin').style.opacity='0';showRing();if(closeQueued){closeQueued=false;close();}}});
 function refresh(){
  if(!current||!dialog.open||current.closing)return;
  const items=selectedEntries().filter(inChart),values=categoryValues(items,current.type),total=sum(items,current.type);
  const rows=items.filter(e=>e.type===current.type).sort((a,b)=>b.date.localeCompare(a.date));
  if(running){cancelAnimations();panel.querySelector('.chart-origin').style.opacity='0';}
  Object.assign(current,{values,rows,total});
  if(!values.some(v=>v.name===current.category))current.category=null;
  const originButton=document.querySelector(`[data-operation="${current.type}"]`);if(originButton)panel.querySelector('.chart-origin .operation-card').innerHTML=originButton.innerHTML;
  panel.querySelector('.chart-period-button').innerHTML=esc(periodLabel(true))+'<span aria-hidden="true">⌄</span>';
  panel.querySelector('.chart-period-button').setAttribute('aria-label','Выбрать период: '+periodLabel());
  panel.querySelector('.chart-colour-legend').innerHTML=categoryLegend(values);
  panel.querySelector('.chart-ring-label strong').textContent=values.length;panel.querySelector('.chart-ring-label span').textContent=categoryWord(values.length);
  panel.querySelector('.chart-category-list').innerHTML=categoryList(values,total);
  panel.querySelector('.chart-static-ring').outerHTML=MonoChartRing.render(values,palette,current.type);
  showRing();showTransactions();root.MonoChartPeriod?.refreshMonthly();
 }
 panel.addEventListener('click',event=>{
  if(!current||running||root.MonoMonthMotion?.isBusy()||root.MonoChartPeriod?.isMonthly())return;
  const choice=event.target.closest('[data-chart-category],[data-ring-category]');
  const clear=event.target.closest('[data-chart-all]');
  if(!choice&&!clear)return;
  const name=choice?current.values[Number(choice.dataset.chartCategory??choice.dataset.ringCategory)]?.name:null;
  current.category=name&&name!==current.category?name:null;
  showTransactions();
  if(clear)panel.querySelector('.chart-category-item')?.focus({preventScroll:true});
 });
 root.MonoCharts={open,close,refresh,isBusy:()=>running||Boolean(current?.closing)};
})(window);
