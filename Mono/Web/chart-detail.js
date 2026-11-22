/* A shared surface opens from the source card as rounded segments bend into a ring. */
(function(root){
 'use strict';
 const dialog=document.querySelector('#chartDialog'),panel=document.querySelector('#chartPanel');
 let current=null,running=false,closed=false,closeQueued=false,animations=[],frame=0,closingOrigin=null;
 const categoryWord=n=>n%10===1&&n%100!==11?'категория':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'категории':'категорий';
 const duration=680,easing='cubic-bezier(.22,1,.36,1)',closeDuration=460,closeEasing='cubic-bezier(.45,0,.2,1)';
 function rect(el){const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};}
 function cancelAnimations(){cancelAnimationFrame(frame);frame=0;dialog.querySelector('.chart-ring-flight')?.remove();closingOrigin?.remove();closingOrigin=null;animations.forEach(a=>a.cancel());animations=[];running=false;}
 function surfaceAnimation(from,to,closing){const clipFor=(r,off=0,radius=23)=>`inset(${(r.top-off).toFixed(1)}px ${(innerWidth-r.left-r.width).toFixed(1)}px ${(innerHeight-(r.top-off)-r.height).toFixed(1)}px ${r.left.toFixed(1)}px round ${radius}px)`,full=clipFor({left:0,top:0,width:innerWidth,height:innerHeight},0,0);
  const frames=closing?[{translate:`0px ${from.top||0}px`,clipPath:full},{translate:'0px 0px',clipPath:clipFor(to)}]:[{clipPath:clipFor(from)},{clipPath:full}];
  const a=panel.animate(frames,{duration:closing?closeDuration:duration,easing:closing?closeEasing:easing,fill:'both'});animations.push(a);const content=panel.querySelector('.chart-details-content'),origin=panel.querySelector('.chart-origin');animations.push(content.animate(closing?[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(12px)'}]:[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:closing?180:370,delay:closing?0:160,fill:'both',easing:'ease-out'}));animations.push(origin.animate(closing?[{opacity:0},{opacity:1}]:[{opacity:1},{opacity:0}],{duration:closing?closeDuration*.45:160,delay:closing?closeDuration*.55:0,fill:'both'}));return a;}
 // Unroll the actual ring outlines into the source strip, then bend them back into place.
 function animateRing(opening, source, done){
  const space=panel.querySelector('.chart-morph-space'),ring=space.querySelector('.chart-static-ring');
  const bounds=ring.getBoundingClientRect(),size=MonoChartRing.size,center=size/2;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('aria-hidden','true');svg.classList.add('chart-ring-flight');
  svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
  const mini=sourceButton()?.querySelector('.mini-chart'),bar=mini?.getBoundingClientRect();
  const strip=bar?.width?{x:bar.left,y:bar.top+bar.height/2,width:bar.width,height:bar.height}:
   {x:source.left+16,y:source.top+source.height-15,width:Math.max(1,source.width-32),height:6};
  const total=current.values.reduce((n,v)=>n+v.n,0);
  let progress=0;
  const slices=[...ring.querySelectorAll('.chart-ring-body > :not(.chart-ring-sheen)')].map(node=>{
   const share=total?current.values[Number(node.dataset.ringCategory)]?.n/total:1;
   const mid=progress+(share||0)/2;progress+=share||0;
   const path=document.createElementNS(svg.namespaceURI,'path');
   path.setAttribute('fill',node.getAttribute('fill')==='none'?node.getAttribute('stroke'):node.getAttribute('fill'));
   svg.append(path);
   const points=[];
   if(node.tagName.toLowerCase()==='circle'){
    const radius=MonoChartRing.radius,half=MonoChartRing.stroke/2;
    for(const r of [radius+half,radius-half])for(let i=0;i<=64;i++){
     const u=r>radius?i/64:1-i/64,a=u*2*Math.PI-Math.PI/2;
     points.push({x:center+r*Math.cos(a),y:center+r*Math.sin(a),u,v:r-radius});
    }
   }else{
    const length=node.getTotalLength(),count=Math.min(110,Math.max(20,Math.ceil(length/4)));
    for(let i=0;i<count;i++){
     const {x,y}=node.getPointAtLength(i*length/count);
     let u=(Math.atan2(y-center,x-center)+Math.PI/2)/(2*Math.PI);
     u+=Math.round(mid-u);
     points.push({x,y,u,v:Math.hypot(x-center,y-center)-MonoChartRing.radius});
    }
   }
   return {path,points};
  });
  dialog.append(svg);
  const fade=ring.animate(opening?[{opacity:0,offset:0},{opacity:0,offset:.69},{opacity:1,offset:1}]:[{opacity:1},{opacity:0,offset:.24},{opacity:0}],{duration:opening?duration:closeDuration,fill:'both'});
  animations.push(fade);
  space.classList.add('ring-ready');running=true;
  const start=performance.now(),length=opening?duration:closeDuration;
  function draw(time){
   const t=Math.min(1,Math.max(0,(time-start)/length)),q=opening?1-(1-t)**3:1-t*t*(3-2*t);
   for(const {path,points} of slices)path.setAttribute('d',points.map(({x,y,u,v},i)=>{
    const fromX=strip.x+strip.width*u,fromY=strip.y+strip.height*v/MonoChartRing.stroke;
    return (i?'L':'M')+(fromX+(bounds.left+x*bounds.width/size-fromX)*q).toFixed(2)+' '+(fromY+(bounds.top+y*bounds.height/size-fromY)*q).toFixed(2);
   }).join('')+'Z');
   svg.style.opacity=String(opening?1-Math.max(0,(t-.69)/.31):Math.min(t/.24,1));
   if(t<1){frame=requestAnimationFrame(draw);return;}
   frame=0;running=false;done();
  }
  draw(start);
 }
 function showRing(){
  const space=panel.querySelector('.chart-morph-space');
  space.classList.add('ring-ready');space.querySelector('.chart-static-ring').style.opacity='';
  const lab=space.querySelector('.chart-ring-label');if(lab){lab.style.opacity='';lab.style.transition='';}
  current.labels?.remove();current.labels=null;
  dialog.querySelector('.chart-morph-layer')?.remove();
 }
 function categoryLegend(values,total=values.reduce((n,v)=>n+v.n,0)){
  const percent=n=>total?(n/total*100).toFixed(n/total<.1?1:0).replace('.',','):'0';
  return values.map((v,i)=>{const colour=palette[i%palette.length],share=total?v.n/total*100:0;return `<li><button type="button" class="chart-legend-button" data-chart-category="${i}" aria-pressed="false" style="--c:${colour}"><i class="chart-legend-icon" aria-hidden="true" style="color:${colour}">${MonoCategoryIcons.category(v.name,current.type)}</i><span class="chart-legend-name">${esc(v.name)}</span><strong class="chart-legend-sum">${money(v.n,selectedCurrency)}</strong><span class="chart-legend-share"><b>${percent(v.n)}%</b><em><i style="--share:${share.toFixed(1)}%"></i></em></span></button></li>`;}).join('')||'<li><p class="muted chart-no-data">Пока нет операций</p></li>';
 }
 function ringLabel(){
  const selected=current.values.find(v=>v.name===current.category),label=panel.querySelector('.chart-ring-label');
  if(!label)return;
  const text=money(selected?.n??current.total,selectedCurrency);
  const strong=label.querySelector('strong'),span=label.querySelector('span');
  strong.textContent=text;strong.style.fontSize=text.length>13?'15px':text.length>10?'18px':'';
  span.textContent=selected?selected.name:'Всего';
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
  panel.querySelector('.chart-details-total').textContent=money(selected?.n??current.total,selectedCurrency);ringLabel();
  panel.querySelectorAll('[data-chart-category]').forEach(button=>button.setAttribute('aria-pressed',String(current.values[Number(button.dataset.chartCategory)]===selected)));
  list.innerHTML=groupedEntriesHTML(rows);
  root.MonoSwipe?.decorate(list);
 }

 function open(type,button,{homeCurrency}={}){
  if(dialog.open||running)return;
  const filters=homeCurrency?{selectedCurrency,selectedMonth,selectedRange}:null;
  if(filters){selectedCurrency=homeCurrency;selectedMonth=currentMonth();selectedRange=null;}
  const items=selectedEntries().filter(inChart),values=categoryValues(items,type),total=sum(items,type),source=rect(button);
  const rows=items.filter(e=>e.type===type).slice().sort((a,b)=>b.date.localeCompare(a.date));
  current={type,values,rows,total,category:null,closing:false,filters,button,fromHome:!!filters};closed=false;closeQueued=false;
  panel.innerHTML=`<div class="chart-origin summary-pair" aria-hidden="true" style="left:${source.left}px;top:${source.top}px;width:${source.width}px;height:${source.height}px"><div class="${filters?'hd-card hd-flow':'operation-card'}">${button.innerHTML}</div></div>`+`<div class="chart-details-content chart-static-view chart-animated-view"><div class="chart-details-head"><h1 id="chartDetailsTitle">${current.type==='income'?'Доходы':'Расходы'}</h1><button class="chart-close icon-btn" aria-label="Закрыть подробности">×</button></div><div class="chart-summary"><div class="chart-totals"><div class="chart-details-total ${current.type==='income'?'positive':''}">${money(total,selectedCurrency)}</div><div class="monthly-total chart-details-total ${current.type==='income'?'positive':''}" aria-live="polite" inert></div></div><div class="chart-period-actions"><button class="chart-period-button" aria-label="Выбрать период: ${esc(periodLabel())}" aria-haspopup="dialog">${esc(periodLabel(true))}<span aria-hidden="true">⌄</span></button><div class="chart-seg" role="group" aria-label="Вид графика"><button type="button" data-chart-view="ring" aria-pressed="true">Структура</button><button type="button" data-monthly-chart="${type}" aria-pressed="false" aria-controls="monthlyChart">Динамика</button></div></div></div><div class="chart-visual"><div class="chart-ring-stage"><button class="chart-side-arrow" data-chart-month="-1" aria-label="Предыдущий месяц">‹</button><div class="chart-morph-space">${MonoChartRing.render(values,palette,current.type)}<div class="chart-ring-label"><strong>${money(total,selectedCurrency)}</strong><span>Всего</span></div></div><button class="chart-side-arrow" data-chart-month="1" aria-label="Следующий месяц">›</button></div><section class="monthly-chart" id="monthlyChart" aria-label="График за выбранный период" inert><label class="monthly-category">Категория<select data-graph-category aria-label="Категория графика"></select></label><p class="monthly-month muted" aria-live="polite"></p><div class="monthly-scroll"><div class="monthly-bars" aria-label="Столбики графика"></div></div></section></div><ul class="chart-colour-legend" aria-label="Категории">${categoryLegend(values,total)}</ul><div class="chart-category-list">${categoryList(values,total)}</div><div class="chart-category-filter" hidden><strong></strong><button type="button" class="secondary" data-chart-all>Все категории</button></div><div class="chart-ops-head"><h2>Операции</h2></div><div class="chart-transaction-list"></div></div>`;
  panel.style.cssText='';panel.scrollTop=0;dialog.showModal();document.body.classList.add('chart-detail-open');button.setAttribute('aria-expanded','true');
  panel.querySelector('.chart-close').onclick=close;
  // Removing an operation is handled by the existing guarded deletion flow after closing.
  showTransactions();
  if(reducedMotion()){panel.querySelector('.chart-origin').style.opacity='0';showRing();return;}
  surfaceAnimation(source,null,false);
  animateRing(true,source,()=>{if(!current)return;cancelAnimations();panel.querySelector('.chart-origin').style.opacity='0';showRing();if(closeQueued){closeQueued=false;close();}});
 }
 function close(options={}){
  if(!current||!dialog.open||current.closing)return;root.MonoMonthMotion?.cancel();if(running){if(!current.closing)closeQueued=true;return;}
  const button=sourceButton();
  if(!button){finish();return;}
  const scrolled=panel.scrollTop>1;
  const source=rect(button);
  const dragOffset=Number(options.dragOffset)||0;panel.style.transform='';
  if(reducedMotion()){finish();return;}
  current.closing=true;
  const origin=panel.querySelector('.chart-origin');
  if(scrolled){closingOrigin=origin.cloneNode(true);closingOrigin.classList.add('chart-return-card');dialog.append(closingOrigin);}
  const target=closingOrigin||origin;
  Object.assign(target.style,{left:source.left+'px',top:source.top+'px',width:source.width+'px',height:source.height+'px',opacity:'0'});
  if(scrolled)animations.push(target.animate([{opacity:0},{opacity:1}],{duration:190,delay:240,fill:'both'}));
  const transition=surfaceAnimation({left:0,top:dragOffset,width:innerWidth,height:innerHeight},source,true);
  if(scrolled||root.MonoChartPeriod?.isMonthly()){
   running=true;transition.finished.then(finish,()=>{});
   return;
  }
  animateRing(false,source,()=>finish());
 }
 function sourceButton(){
  if(!current)return null;
  if(current.button.isConnected)return current.button;
  return document.querySelector(current.fromHome?`[data-hd-go="${current.type}"]`:`[data-operation="${current.type}"]`);
 }
 function finish(){
  const button=sourceButton(),filters=current?.filters;
  current=null;closed=true;closeQueued=false;
  if(filters){selectedCurrency=filters.selectedCurrency;selectedMonth=filters.selectedMonth;selectedRange=filters.selectedRange;}
  if(dialog.open)dialog.close();
  cancelAnimations();document.body.classList.remove('chart-detail-open');
  button?.setAttribute('aria-expanded','false');
  if(root.MonoFocus?.isKeyboard())button?.focus({preventScroll:true});else button?.blur();
  panel.innerHTML='';
 }

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
  const originButton=sourceButton();if(originButton)panel.querySelector('.chart-origin > div').innerHTML=originButton.innerHTML;
  panel.querySelector('.chart-period-button').innerHTML=esc(periodLabel(true))+'<span aria-hidden="true">⌄</span>';
  panel.querySelector('.chart-period-button').setAttribute('aria-label','Выбрать период: '+periodLabel());
  panel.querySelector('.chart-colour-legend').innerHTML=categoryLegend(values,total);
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
