/* A shared surface opens from the chosen card; its actual coloured paths bend into a ring. */
(function(root){
 'use strict';
 const dialog=document.querySelector('#chartDialog'),panel=document.querySelector('#chartPanel'),NS='http://www.w3.org/2000/svg';
 let current=null,frame=null,running=false,closed=false,closeQueued=false,animations=[];
 const categoryWord=n=>n%10===1&&n%100!==11?'категория':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'категории':'категорий';
 const duration=680,easing='cubic-bezier(.22,1,.36,1)';
 const ease=t=>1-Math.pow(1-t,4),lerp=(a,b,t)=>a+(b-a)*t;
 function rect(el){const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};}
 function cancelAnimations(){cancelAnimationFrame(frame);frame=null;animations.forEach(a=>a.cancel());animations=[];running=false;}
 function cssRect(r){return {left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',borderRadius:'23px'};}
 function surfaceAnimation(from,to,closing){const a=panel.animate([cssRect(from),cssRect(to)],{duration,easing,fill:'both'});animations.push(a);const content=panel.querySelector('.chart-details-content'),origin=panel.querySelector('.chart-origin');animations.push(content.animate(closing?[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(12px)'}]:[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:closing?210:370,delay:closing?0:160,fill:'both',easing:'ease-out'}));animations.push(origin.animate(closing?[{opacity:0},{opacity:1}]:[{opacity:1},{opacity:0}],{duration:closing?220:160,delay:closing?duration-240:0,fill:'both'}));return a;}
 function svgLayer(){const svg=document.createElementNS(NS,'svg');svg.setAttribute('aria-hidden','true');svg.classList.add('chart-morph-layer');svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);dialog.append(svg);return svg;}
 function drawPath(svg,items,bar,circle,t){
  if(!svg.childElementCount)for(let i=0;i<Math.max(1,items.length);i++){const p=document.createElementNS(NS,'path');p.setAttribute('fill','none');p.setAttribute('stroke-linejoin','round');p.setAttribute('stroke-linecap',items.length?'butt':'round');p.setAttribute('stroke',items.length?palette[i%palette.length]:'var(--bar)');svg.append(p);}
  const total=items.reduce((sum,v)=>sum+v.n,0),parts=items.length?items:[{n:1}],count=44;let progress=0;
  parts.forEach((v,index)=>{const amount=total?v.n/total:1,start=progress;progress+=amount;const points=[];
   for(let i=0;i<=count;i++){const u=start+amount*i/count,angle=-Math.PI/2+2*Math.PI*u;
    const lineX=bar.left+bar.width*u,lineY=bar.top+bar.height/2;
    const ringX=circle.cx+circle.r*Math.cos(angle),ringY=circle.cy+circle.r*Math.sin(angle);
    // Interpolating points bends the original segment continuously; the colours never cross-fade.
    points.push(`${i?'L':'M'}${lerp(lineX,ringX,t).toFixed(2)},${lerp(lineY,ringY,t).toFixed(2)}`);
   }
   const path=svg.children[index];path.setAttribute('d',points.join(' ')+(t===1&&parts.length===1?' Z':''));path.setAttribute('stroke-width',lerp(bar.height,circle.stroke,t).toFixed(2));
  });
 }
 function circleAt(r){return {cx:r.left+r.width/2,cy:r.top+r.height/2,r:r.width*.355,stroke:r.width*26/220};}
 function animatePaths(items,bar,circle,opening,done){const svg=svgLayer();current.svg=svg;const started=performance.now();running=true;
  function step(time){if(!current||closed)return;const t=Math.min(1,(time-started)/duration);drawPath(svg,items,bar,circle,opening?ease(t):1-ease(t));if(opening&&current.labels){const progress=Math.max(0,Math.min(1,(t-.43)/.38));current.labels.style.opacity=String(progress);current.labels.style.transform=`scale(${.98+.02*progress})`;}if(t<1)frame=requestAnimationFrame(step);else{running=false;done(svg);}}
  drawPath(svg,items,bar,circle,opening?0:1);frame=requestAnimationFrame(step);
 }
 function makeStatic(svg,items,reveal=true){current.labels?.remove();current.labels=null;const space=panel.querySelector('.chart-morph-space');svg.remove();space.querySelectorAll('.chart-static-ring').forEach(el=>el.remove());space.insertAdjacentHTML('afterbegin',MonoChartRing.render(items,palette,current.type));current.svg=space.querySelector('.chart-static-ring');space.classList.add('ring-ready');const labels=space.querySelectorAll('.chart-ring-percentages,.chart-ring-icons');if(reveal&&!reducedMotion())labels.forEach(el=>el.animate([{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'scale(1)'}],{duration:460,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'}));}

 function open(type,button){
  if(dialog.open||running)return;
  const items=selectedEntries(),values=categoryValues(items,type),total=sum(items,type),source=rect(button),bar=rect(button.querySelector('.mini-chart'));
  const title=type==='income'?'Доходы':'Расходы',rows=items.filter(e=>e.type===type).slice().sort((a,b)=>b.date.localeCompare(a.date));
  current={type,values,source,bar,rows,originHTML:button.innerHTML,scroll:window.scrollY,closing:false};closed=false;closeQueued=false;
  panel.innerHTML=`<div class="chart-origin summary-pair" aria-hidden="true" style="width:${source.width}px;height:${source.height}px"><div class="operation-card">${button.innerHTML}</div></div>`+`<div class="chart-details-content chart-static-view chart-animated-view"><div class="chart-details-head"><h1 id="chartDetailsTitle">${current.type==='income'?'Доходы':'Расходы'}</h1><button class="chart-close icon-btn" aria-label="Закрыть подробности">×</button></div><div class="chart-summary"><div class="chart-details-total ${current.type==='income'?'positive':''}">${money(total,selectedCurrency)}</div><button class="chart-period-button" aria-label="Выбрать период: ${esc(periodLabel())}" aria-haspopup="dialog">${esc(periodLabel(true))}<span aria-hidden="true">⌄</span></button></div><div class="chart-ring-stage"><button class="chart-side-arrow" data-chart-month="-1" aria-label="Предыдущий месяц">‹</button><div class="chart-morph-space">${MonoChartRing.render(values,palette,current.type)}<div class="chart-ring-label"><strong>${values.length}</strong><span>${categoryWord(values.length)}</span></div></div><button class="chart-side-arrow" data-chart-month="1" aria-label="Следующий месяц">›</button></div><ul class="chart-colour-legend" aria-label="Цвета категорий">${values.map((v,i)=>`<li><i style="background:${palette[i%palette.length]}"></i><span>${esc(v.name)}</span></li>`).join('')}</ul><div class="chart-category-list">${values.map((v,i)=>`<div class="chart-category-item"><i class="category-report-icon" style="color:${palette[i%palette.length]}">${MonoCategoryIcons.category(v.name,current.type)}</i><span>${esc(v.name)}<small>${(v.n/total*100).toFixed(1).replace('.',',')}%</small></span><strong>${money(v.n,selectedCurrency)}</strong></div>`).join('')||'<p class="muted chart-no-data">Пока нет операций</p>'}</div><div class="chart-transaction-list">${groupedEntriesHTML(rows)}</div></div>`;
  panel.style.cssText='';panel.scrollTop=0;dialog.showModal();document.body.classList.add('chart-detail-open');button.setAttribute('aria-expanded','true');
  panel.querySelector('.chart-close').onclick=close;
  // Removing an operation is handled by the existing guarded deletion flow after closing.
  root.MonoSwipe?.decorate(panel);
  const target={left:0,top:0,width:innerWidth,height:innerHeight},space=rect(panel.querySelector('.chart-morph-space')),circle=circleAt(space);
  if(reducedMotion()){panel.querySelector('.chart-origin').style.opacity='0';const svg=svgLayer();makeStatic(svg,values);return;}
  const labelLayer=document.createElementNS(NS,'svg');labelLayer.classList.add('chart-morph-labels');labelLayer.setAttribute('viewBox','0 0 220 220');labelLayer.setAttribute('aria-hidden','true');labelLayer.style.cssText=`left:${space.left}px;top:${space.top}px;width:${space.width}px;height:${space.height}px;opacity:0`;const staticRing=panel.querySelector('.chart-static-ring');for(const group of staticRing.querySelectorAll('.chart-ring-icons,.chart-ring-percentages'))labelLayer.append(group.cloneNode(true));dialog.append(labelLayer);current.labels=labelLayer;
  surfaceAnimation(source,target,false);
  animatePaths(values,bar,circle,true,svg=>{if(!current)return;cancelAnimations();panel.querySelector('.chart-origin').style.opacity='0';makeStatic(svg,values,false);if(closeQueued){closeQueued=false;close();}});
 }
 function close(options={}){
  if(!current||!dialog.open)return;root.MonoMonthMotion?.cancel();if(running){if(!current.closing)closeQueued=true;return;}
  const type=current.type,button=document.querySelector(`[data-operation="${type}"]`);
  if(!button){finish();return;}
  panel.scrollTop=0;
  const source=rect(button),bar=rect(button.querySelector('.mini-chart')),circle=circleAt(rect(panel.querySelector('.chart-morph-space'))),values=current.values;
  const dragOffset=Number(options.dragOffset)||0;panel.style.transform='';
  if(reducedMotion()){finish();return;}
  current.closing=true;current.svg?.remove();panel.querySelector('.chart-morph-space').classList.remove('ring-ready');
  const origin=panel.querySelector('.chart-origin');origin.style.width=source.width+'px';origin.style.height=source.height+'px';origin.style.opacity='0';
  surfaceAnimation({left:0,top:dragOffset,width:innerWidth,height:innerHeight},source,true);
  animatePaths(values,bar,circle,false,()=>finish());
 }
 function finish(){current?.labels?.remove();closed=true;closeQueued=false;const type=current?.type;cancelAnimations();dialog.querySelectorAll('.chart-morph-layer').forEach(el=>el.remove());if(dialog.open)dialog.close();document.body.classList.remove('chart-detail-open');const button=document.querySelector(`[data-operation="${type}"]`);button?.setAttribute('aria-expanded','false');if(root.MonoFocus?.isKeyboard())button?.focus({preventScroll:true});else button?.blur();current=null;panel.innerHTML='';}
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',()=>{if(current)finish();});
 window.addEventListener('pagehide',()=>{if(current)finish();});
 // Keep a static ring attached to the scrollable page after rotation or viewport resizing.
 window.addEventListener('resize',()=>{if(!current)return;if(running){if(current.closing){finish();return;}const svg=current.svg;cancelAnimations();panel.querySelector('.chart-origin').style.opacity='0';if(svg)makeStatic(svg,current.values);if(closeQueued){closeQueued=false;close();}}});
 function refresh(options={}){
  if(!current||!dialog.open)return;
  const values=categoryValues(selectedEntries(),current.type),total=sum(selectedEntries(),current.type),rows=selectedEntries().filter(e=>e.type===current.type).slice().sort((a,b)=>b.date.localeCompare(a.date));
  if(running){cancelAnimations();panel.querySelector('.chart-origin').style.opacity='0';}
  current.values=values;current.rows=rows;current.svg?.remove();
  const originButton=document.querySelector(`[data-operation="${current.type}"]`);if(originButton)panel.querySelector('.chart-origin .operation-card').innerHTML=originButton.innerHTML;
  panel.querySelector('.chart-details-total').textContent=money(total,selectedCurrency);
  panel.querySelector('.chart-period-button').innerHTML=esc(periodLabel(true))+'<span aria-hidden="true">⌄</span>';
  panel.querySelector('.chart-period-button').setAttribute('aria-label','Выбрать период: '+periodLabel());
  panel.querySelector('.chart-colour-legend').innerHTML=values.map((v,i)=>`<li><i style="background:${palette[i%palette.length]}"></i><span>${esc(v.name)}</span></li>`).join('');
  panel.querySelector('.chart-ring-label strong').textContent=values.length;panel.querySelector('.chart-ring-label span').textContent=categoryWord(values.length);
  panel.querySelector('.chart-category-list').innerHTML=values.map((v,i)=>`<div class="chart-category-item"><i class="category-report-icon" style="color:${palette[i%palette.length]}">${MonoCategoryIcons.category(v.name,current.type)}</i><span>${esc(v.name)}<small>${(v.n/total*100).toFixed(1).replace('.',',')}%</small></span><strong>${money(v.n,selectedCurrency)}</strong></div>`).join('')||'<p class="muted chart-no-data">Пока нет операций</p>';
  panel.querySelector('.chart-transaction-list').innerHTML=groupedEntriesHTML(rows);root.MonoSwipe?.decorate(panel);
  const svg=svgLayer();current.svg=svg;makeStatic(svg,values);

 }
 root.MonoCharts={open,close,refresh,isBusy:()=>running};
})(window);
