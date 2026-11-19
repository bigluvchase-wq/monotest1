const {test}=require('node:test'),assert=require('node:assert/strict'),Voice=require('../Mono/Web/voice');
function fixture(){
 const sessions=[],results=[],errors=[],timers=new Map();let id=0;
 class Recognition{constructor(){sessions.push(this);}start(){this.onstart();}stop(){this.onend();}abort(){}}
 const voice=Voice.create({Recognition,onResult:t=>results.push(t),onFailure:e=>errors.push(e),setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:id=>timers.delete(id)});
 const result=(rec,text,final=false)=>{const item=[{transcript:text}];item.isFinal=final;rec.onresult({results:[item]});};
 return {voice,sessions,results,errors,timers,result,restart(){const item=[...timers].find(([,v])=>v.ms===180);assert(item);timers.delete(item[0]);item[1].fn();}};
}
test('held dictation waits through pauses and native session endings until explicit release',()=>{
 const f=fixture();f.voice.start({hold:true});f.result(f.sessions[0],'Кофе 300');f.sessions[0].onend();f.restart();
 // A silent session is not an instruction to submit the earlier text.
 f.sessions[1].onerror({error:'no-speech'});f.sessions[1].onend();f.restart();
 assert.deepEqual(f.results,[]);assert.deepEqual(f.errors,[]);assert.equal(f.timers.size,0,'active listening has no silence deadline');
 f.result(f.sessions[2],'продукты 1500 и напомни завтра купить корм');f.voice.stop();
 assert.deepEqual(f.results,['Кофе 300 продукты 1500 и напомни завтра купить корм']);
});
test('releasing dictation keeps the latest interim tail after a final segment',()=>{
 const f=fixture();f.voice.start({hold:true});const first=[{transcript:'Кофе 300'}];first.isFinal=true;const tail=[{transcript:'и напомни завтра купить корм'}];tail.isFinal=false;
 f.sessions[0].onresult({results:[first,tail]});f.voice.stop();assert.deepEqual(f.results,['Кофе 300 и напомни завтра купить корм']);
});
