(function(root){
'use strict';
// Анимация кнопки записи: два стеклянных «дыхащих» кольца вокруг микрофона, которые реагируют на громкость голоса.
// Громкость приходит из нативного слоя (MonoNative → level) или из WebAudio в браузере; без данных кольца спокойно дышат сами.
const zone=document.querySelector('.voice-zone'),mic=document.getElementById('mic');
if(!zone||!mic)return;
const make=cls=>{const el=document.createElement('i');el.className='voice-glass '+cls;el.setAttribute('aria-hidden','true');zone.insertBefore(el,mic);return el;};
const g1=make('g1'),g2=make('g2');
function size(){const w=mic.offsetWidth;if(w>0)zone.style.setProperty('--mic-size',w+'px');}
const reduce=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
let target=0,lv=0,lv2=0,last=0,raf=0,on=false,stream=null,audio=null,analyser=null,data=null,t0=0;
function level(v){target=Math.max(0,Math.min(1,v));last=performance.now();}
function blob(p,k){const w=n=>(50+k*Math.sin(p*n[0]+n[1])).toFixed(1)+'%';return `${w([1.3,0])} ${w([1.1,1.7])} ${w([1.5,3.1])} ${w([.9,4.4])} / ${w([1.2,2.2])} ${w([1.4,.6])} ${w([1,5.1])} ${w([1.6,3.7])}`;}
function readAnalyser(){if(!analyser)return;analyser.getByteTimeDomainData(data);let s=0;for(const x of data){const d=(x-128)/128;s+=d*d;}const rms=Math.sqrt(s/data.length),db=20*Math.log10(Math.max(rms,1e-5));level((db+52)/38);}
function frame(now){
 if(!on){return;}
 raf=requestAnimationFrame(frame);
 if(analyser)readAnalyser();
 let tg=target;
 if(now-last>400){tg=.2+.14*Math.sin(now/520)+.05*Math.sin(now/210);}
 lv+=(tg-lv)*(tg>lv?.05+.07*Math.min(1,(now-t0)/1600):.045);
 lv2+=(lv-lv2)*.04;
 const p=(now-t0)/1000,still=reduce();
 const r0=Math.min(1,(now-t0)/1100),ramp=r0*r0*(3-2*r0);
 const s1=1.1+.26*lv*ramp,s2=1.2+.46*lv2*ramp;
 g1.style.transform=`scale(${s1.toFixed(3)})`;g2.style.transform=`scale(${s2.toFixed(3)})`;
 if(!still){g1.style.borderRadius=blob(p*.6,2+lv*3);g2.style.borderRadius=blob(p*.6+2.4,2.5+lv2*4);}
 zone.style.setProperty('--lv',lv.toFixed(3));
}
async function openAudio(){
 if(window.MonoNative||!navigator.mediaDevices?.getUserMedia)return;
 try{
  const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false}});
  if(!on){s.getTracks().forEach(t=>t.stop());return;}
  stream=s;const AC=window.AudioContext||window.webkitAudioContext;audio=new AC();
  const src=audio.createMediaStreamSource(s);analyser=audio.createAnalyser();analyser.fftSize=512;data=new Uint8Array(analyser.fftSize);src.connect(analyser);
 }catch{}
}
function closeAudio(){analyser=null;try{stream?.getTracks().forEach(t=>t.stop());}catch{}stream=null;try{audio?.close();}catch{}audio=null;}
function start(){if(on)return;on=true;size();t0=performance.now();target=0;lv=0;lv2=0;last=0;zone.classList.add('wave-on');cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);openAudio();}
function stop(){if(!on)return;on=false;cancelAnimationFrame(raf);zone.classList.remove('wave-on');closeAudio();g1.style.transform=g2.style.transform='';zone.style.removeProperty('--lv');}
const sync=()=>{const b=document.body.classList;(b.contains('holding')||b.contains('listening'))?start():stop();};
new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});sync();
size();addEventListener('resize',size);if(window.ResizeObserver)new ResizeObserver(size).observe(mic);
root.MonoMicWave={level,start,stop};
})(window);
