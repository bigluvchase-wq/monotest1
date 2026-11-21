import React from 'react';
import {createRoot} from 'react-dom/client';
import {VoiceRing} from 'voice-ring';

// Isolated visual component: speech capture remains owned by Mono/iOS.
// No getUserMedia call, extra permission, audio upload or second recording session.
const mic=document.querySelector('#mic');
if(mic){
 const mount=document.createElement('span');mount.className='voice-ring-visual';mount.setAttribute('aria-hidden','true');mic.parentElement.prepend(mount);
 const root=createRoot(mount),motion=matchMedia('(prefers-reduced-motion:reduce)');
 let level=0,updated=0,queued=false,previous='';
 const readLevel=()=>performance.now()-updated<350?level:0;
 window.MonoVoiceRing={setLevel(value){const n=Number(value);level=Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;updated=performance.now();}};
 function update(){
  queued=false;
  const phase=document.body.dataset.voicePhase;
  const state=phase==='listening'?'listening':['starting','stopping','finishing'].includes(phase)?'processing':'idle';
  const paused=motion.matches||document.hidden||document.body.dataset.page!=='home'||!!document.querySelector('dialog[open]');
  const theme=document.documentElement.dataset.theme==='dark'?'dark':'light';
  const palette=document.documentElement.dataset.palette;
  const accent=palette==='green'?'green':palette==='burgundy'?'red':document.documentElement.dataset.design==='sapphire'||palette==='blue'?'blue':null;
  const key=[state,paused,theme,accent].join('|');if(key===previous)return;previous=key;
  root.render(<VoiceRing type="ring" size={232} state={state} level={readLevel} theme={theme} accent={accent} speed={0.7} sensitivity={0.85} hoverBend={false} paused={paused} style={{pointerEvents:'none'}} />);
  // Preserve the existing accessible microphone button and its touch handlers.
  document.documentElement.classList.add('voice-ring-ready');
 }
 function schedule(){if(!queued){queued=true;queueMicrotask(update);}}
 new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['data-page','data-voice-phase']});
 new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-palette','data-design']});
 for(const dialog of document.querySelectorAll('dialog'))new MutationObserver(schedule).observe(dialog,{attributes:true,attributeFilter:['open']});
 document.addEventListener('visibilitychange',schedule);motion.addEventListener('change',schedule);update();
}
