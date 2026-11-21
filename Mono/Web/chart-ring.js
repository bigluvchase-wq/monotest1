(function(root){
'use strict';
const C=typeof module==='object'?require('./category-icons.js'):root.MonoCategoryIcons;
const SIZE=220,CENTER=SIZE/2,RADIUS=78.1,STROKE=26;
function arc(start,end){
 const point=fraction=>{const angle=-Math.PI/2+fraction*Math.PI*2;return `${CENTER+RADIUS*Math.cos(angle)} ${CENTER+RADIUS*Math.sin(angle)}`;};
 return `M${point(start)} A${RADIUS} ${RADIUS} 0 ${end-start>.5?1:0} 1 ${point(end)}`;
}
function roundedSegment(start,end){
 const outer=RADIUS+STROKE/2,inner=RADIUS-STROKE/2,span=(end-start)*Math.PI*2;
 const corner=Math.min(8,(outer-inner)/2,span*inner*.24),co=corner/outer,ci=corner/inner;
 const a=-Math.PI/2+start*Math.PI*2,b=-Math.PI/2+end*Math.PI*2;
 const p=(r,t)=>`${(CENTER+r*Math.cos(t)).toFixed(4)} ${(CENTER+r*Math.sin(t)).toFixed(4)}`;
 return `M${p(outer,a+co)} A${outer} ${outer} 0 ${span-2*co>Math.PI?1:0} 1 ${p(outer,b-co)} Q${p(outer,b)} ${p(outer-corner,b)} L${p(inner+corner,b)} Q${p(inner,b)} ${p(inner,b-ci)} A${inner} ${inner} 0 ${span-2*ci>Math.PI?1:0} 0 ${p(inner,a+ci)} Q${p(inner,a)} ${p(inner+corner,a)} L${p(outer-corner,a)} Q${p(outer,a)} ${p(outer,a+co)} Z`;
}
function render(values,colours,type='expense'){
 const total=values.reduce((n,v)=>n+v.n,0),gradient='mono-ring-sheen-'+(type==='income'?'income':'expense');let cursor=0,arcs='';
 values.forEach((v,i)=>{
  const share=total?v.n/total:0,start=cursor;cursor+=share;if(!share)return;const colour=colours[i%colours.length]||'var(--accent)';
  if(values.length===1){arcs+=`<circle class="chart-ring-segment" data-ring-category="0" cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="none" stroke="${colour}" stroke-width="${STROKE}"/><circle class="chart-ring-sheen" cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="none" stroke="url(#${gradient})" stroke-width="${STROKE}"/>`;return;}
  const halfGap=Math.min(3/(2*Math.PI*RADIUS)/2,share*.18),d=roundedSegment(start+halfGap,cursor-halfGap);
  arcs+=`<path class="chart-ring-segment" data-ring-category="${i}" d="${d}" fill="${colour}"/><path class="chart-ring-sheen" d="${d}" fill="url(#${gradient})"/>`;
 });
 if(!total)arcs=`<circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="none" stroke="var(--bar)" stroke-width="${STROKE}"/>`;
 return `<svg class="chart-static-ring" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true"><defs><linearGradient id="${gradient}" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="white" stop-opacity=".24"/><stop offset=".45" stop-color="white" stop-opacity=".04"/><stop offset="1" stop-color="black" stop-opacity=".12"/></linearGradient></defs><g class="chart-ring-body">${arcs}</g><g class="chart-ring-icons"></g><g class="chart-ring-percentages"></g></svg>`;
}

function icon(name,type='expense'){return C.category(name,type);}
const api={render,icon,size:SIZE,radius:RADIUS,stroke:STROKE};root.MonoChartRing=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
