(function(root){
'use strict';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function merge(base,local,remote,prefer=null){const conflicts=[];
 function walk(b,l,r,path){if(equal(l,r)||equal(b,r))return structuredClone(l);if(equal(b,l))return structuredClone(r);
  if([b,l,r].every(x=>x&&typeof x==='object'&&!Array.isArray(x))){const out={};for(const k of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){const value=walk(b[k],l[k],r[k],path+'.'+k);if(value!==undefined)out[k]=value;}return out;}
  if([b,l,r].every(x=>Array.isArray(x)&&x.every(v=>v&&typeof v.id==='string'))){const map=a=>new Map(a.map(v=>[v.id,v])),bm=map(b),lm=map(l),rm=map(r),out=[];for(const id of new Set([...bm.keys(),...lm.keys(),...rm.keys()])){const v=walk(bm.get(id),lm.get(id),rm.get(id),path+'['+id+']');if(v!==undefined)out.push(v);}return out;}
  conflicts.push(path);return structuredClone(prefer==='remote'?r:l);
 }
 return {state:walk(base,local,remote,'state'),conflicts};
}
function wire(state){const copy=structuredClone(state);const h=state.settings||{};copy.settings={theme:'system',language:'ru',onboarded:true};for(const k of ['financialHealth','bankMerchantRules'])if(h[k]!==undefined)copy.settings[k]=structuredClone(h[k]);copy.tickets=[];delete copy.deletedIds;return copy;}
const api={merge,wire,equal};root.MonoSharedData=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
