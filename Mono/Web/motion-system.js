/* Shared policy for web motion. Native Metal waves keep their specialised shader timing. */
(function(root){
'use strict';
const duration=Object.freeze({accountOpen:440,accountClose:360,formOpen:420,formClose:280,reminderReveal:360,reminderStagger:65,micro:140,feedback:180,small:220,modal:320,exit:240,sheet:320,settle:280,screen:320,complex:400,stagger:16,reduced:100,carousel:500,nav:420,navExtra:120,chart:480});
const ease=Object.freeze({gentle:'cubic-bezier(.3,0,.25,1)',enter:'cubic-bezier(.22,1,.36,1)',exit:'cubic-bezier(.4,0,.2,1)',screen:'cubic-bezier(.32,.72,0,1)',spring:'cubic-bezier(.34,1.12,.64,1)'});
const reduce=root.matchMedia('(prefers-reduced-motion:reduce)');
const api=Object.freeze({duration,ease,get reduced(){return reduce.matches;}});root.MonoMotion=api;
for(const [name,value] of Object.entries(duration))document.documentElement.style.setProperty('--mono-motion-'+name,value+'ms');
for(const [name,value] of Object.entries(ease))document.documentElement.style.setProperty('--mono-ease-'+name,value);
})(window);
