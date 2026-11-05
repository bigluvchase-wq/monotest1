(function(root){
'use strict';
const C=typeof module==='object'?require('./category-icons.js'):root.MonoCategoryIcons;
function render(values,colours,type='expense'){
 const total=values.reduce((n,v)=>n+v.n,0);let cursor=0,labels='',arcs='',symbols='';const parts=values.map((v,i)=>{const share=v.n/total,start=cursor;cursor+=share;return {name:v.name||'Другое',start,end:cursor,share,colour:colours[i%colours.length]};});
 function colourAt(u){return parts[Math.max(0,parts.findIndex(p=>u<p.end))].colour;}
 if(total)for(let i=0;i<320;i++){const from=-Math.PI/2+i/320*Math.PI*2,to=from+Math.PI*2/320+.010,x=110+78.1*Math.cos(from),y=110+78.1*Math.sin(from),xx=110+78.1*Math.cos(to),yy=110+78.1*Math.sin(to);arcs+=`<path d="M${x.toFixed(3)} ${y.toFixed(3)} A78.1 78.1 0 0 1 ${xx.toFixed(3)} ${yy.toFixed(3)}" fill="none" stroke="${colourAt((i+.5)/320)}" stroke-width="26"/>`;}
 parts.forEach(p=>{if(p.share<.015)return;const angle=-Math.PI/2+(p.start+p.share/2)*Math.PI*2,x=110+103*Math.cos(angle),y=110+103*Math.sin(angle),text=Math.round(p.share*100)+'%',width=text.length*4.8+7;if(p.share>=.04){const ix=110+78.1*Math.cos(angle),iy=110+78.1*Math.sin(angle);symbols+=`<g transform="translate(${ix} ${iy})"><circle r="10" fill="${p.colour}"/><g transform="translate(-7 -7) scale(.5833)" fill="none" stroke="white" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${C.paths(C.key(p.name,type))}</g></g>`;}labels+=`<g><rect x="${x-width/2}" y="${y-7}" width="${width}" height="14" rx="7"/><text x="${x}" y="${y}">${text}</text></g>`;});
 return `<svg class="chart-static-ring" viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="78.1" fill="none" stroke="var(--bar)" stroke-width="26"/>${arcs}<g class="chart-ring-icons">${symbols}</g><g class="chart-ring-percentages">${labels}</g></svg>`;
}
function icon(name,type='expense'){return C.category(name,type);}
const api={render,icon};root.MonoChartRing=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
