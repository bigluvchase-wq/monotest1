const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../Mono/Web/app.js'),'utf8');
const queueCode=source.slice(source.indexOf('let commandQueue='),source.indexOf('function openEntry('));
function fixture(count){
 const scheduled=[],opened=[],listeners={};let draftsOpened=0;
 const dialog={open:false,addEventListener:(type,fn)=>listeners[type]=fn,close(){this.open=false;listeners.close();}};
 const context={$:selector=>selector==='#actionDialog'?dialog:{open:false},MonoCommands:{run:cmd=>{opened.push(cmd.kind);dialog.open=true;}},setTimeout:fn=>scheduled.push(fn)};
 vm.createContext(context);vm.runInContext(queueCode,context);
 context.commands=Array.from({length:count},(_,i)=>({kind:i?'goal':'reminder'}));context.openDrafts=()=>draftsOpened++;
 vm.runInContext('commandQueue=commands;commandAfter=openDrafts;nextCommand();',context);
 return {dialog,scheduled,opened,draftsOpened:()=>draftsOpened,next:()=>{assert(scheduled.length,'financial drafts must follow closing the last form');scheduled.shift()();}};
}
test('mixed dictation resumes financial drafts after closing the reminder form',()=>{
 const f=fixture(1);assert.deepEqual(f.opened,['reminder']);assert.equal(f.draftsOpened(),0);
 f.dialog.close();f.next();assert.equal(f.draftsOpened(),1);
 f.dialog.close();assert.equal(f.scheduled.length,0);assert.equal(f.draftsOpened(),1);
});
test('multiple command forms finish before opening financial drafts',()=>{
 const f=fixture(2);f.dialog.close();f.next();assert.deepEqual(f.opened,['reminder','goal']);assert.equal(f.draftsOpened(),0);
 f.dialog.close();f.next();assert.equal(f.draftsOpened(),1);
});
