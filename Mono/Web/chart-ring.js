(function(root){
'use strict';
const C=typeof module==='object'?require('./category-icons.js'):root.MonoCategoryIcons;
const SIZE=220,CENTER=SIZE/2,RADIUS=78.1,STROKE=26;
function arc(start,end){
 const point=fraction=>{const angle=-Math.PI/2+fraction*Math.PI*2;return `${CENTER+RADIUS*Math.cos(angle)} ${CENTER+RADIUS*Math.sin(angle)}`;};
 return `M${point(start)} A${RADIUS} ${RADIUS} 0 ${end-start>.5?1:0} 1 ${point(end)}`;
}
function render(values,colours,type='expense'){
 const total=values.reduce((n,v)=>n+v.n,0);let cursor=0,labels='',arcs='',symbols='';
 const parts=total?values.map((v,i)=>{const share=v.n/total,start=cursor;cursor+=share;return {name:v.name||'Другое',start,end:cursor,share,colour:colours[i%colours.length]};}):[];
 const track=parts.length?parts[parts.length-1].colour:'var(--bar)';
 // A solid track covers antialiasing gaps. Adjacent coloured arcs overlap by a fraction of a pixel.
 const overlap=.35/(2*Math.PI*RADIUS);
 parts.forEach((p,i)=>{
  if(parts.length===1){arcs+=`<circle class="chart-ring-segment" data-ring-category="0" cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" stroke="transparent"/>`;return;}
  const end=Math.min(p.end+Math.min(overlap,(parts[i+1]?.share||0)/2),p.start+.999999999);
  arcs+=`<path class="chart-ring-segment" data-ring-category="${i}" d="${arc(p.start,end)}" stroke="${i===parts.length-1?'transparent':p.colour}"/>`;
 });
 parts.forEach(p=>{if(p.share<.015)return;const angle=-Math.PI/2+(p.start+p.share/2)*Math.PI*2,x=110+103*Math.cos(angle),y=110+103*Math.sin(angle),text=Math.round(p.share*100)+'%',width=text.length*4.8+7;if(p.share>=.04){const ix=CENTER+RADIUS*Math.cos(angle),iy=CENTER+RADIUS*Math.sin(angle);symbols+=`<g transform="translate(${ix} ${iy})"><circle r="10" fill="${p.colour}"/><g transform="translate(-7 -7) scale(.5833)" fill="none" stroke="white" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${C.paths(C.key(p.name,type))}</g></g>`;}labels+=`<g><rect x="${x-width/2}" y="${y-7}" width="${width}" height="14" rx="7"/><text x="${x}" y="${y}">${text}</text></g>`;});
 return `<svg class="chart-static-ring" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true"><g fill="none" stroke-width="${STROKE}"><circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" stroke="${track}"/>${arcs}</g><g class="chart-ring-icons">${symbols}</g><g class="chart-ring-percentages">${labels}</g></svg>`;
}
function icon(name,type='expense'){return C.category(name,type);}
const api={render,icon,size:SIZE,radius:RADIUS,stroke:STROKE};root.MonoChartRing=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
