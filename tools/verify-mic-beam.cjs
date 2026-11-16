// Browser regression for the web effect, native bridge handshake and account backdrop exit.
const path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const repo=path.resolve(__dirname,'..'),{chromium}=require(process.env.MONO_PLAYWRIGHT_MODULE||'playwright');
const express=require(path.join(repo,'server/node_modules/express')),E=require(path.join(repo,'Mono/Web/engine'));
(async()=>{
 const server=express().use(express.static(path.join(repo,'Mono/Web'))).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({executablePath:process.env.MONO_CHROMIUM_PATH,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),errors=[];
 await context.route('https://api.monoapp.ru/**',r=>r.fulfill({json:{ok:true,premium:false}}));
 const seed=E.initialState();seed.settings.onboarded=true;
 await context.addInitScript(seed=>localStorage.setItem('mono-v2',JSON.stringify(seed)),seed);
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:'+server.address().port);await p.evaluate(()=>{tourActive=false;$('#onboarding').close();MonoAccess.isPremium=()=>true;});await p.waitForTimeout(1800);
 const screenshots=fs.mkdtempSync(path.join(os.tmpdir(),'mono-beam-'));
 for(const width of [320,390,430]){
  await p.setViewportSize({width,height:width===320?568:932});
  for(const theme of ['light','dark','purple','blue','green','burgundy','black']){
   await p.evaluate(theme=>{state.settings.theme=theme;applyTheme();},theme);
   const rects=await p.evaluate(()=>['#mic','.mic-beam-host'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
   for(let i=0;i<4;i++)assert(Math.abs(rects[0][i]-rects[1][i])<0.1,JSON.stringify(rects));
   assert.equal(await p.locator('.mic-beam').evaluate(el=>getComputedStyle(el).display),'none');
   if(width===390)await p.screenshot({path:path.join(screenshots,theme+'.png')});
  }
 }
 await p.evaluate(()=>MonoHomeAccountPicker.show());await p.waitForTimeout(350);
 assert.equal(await p.locator('.mic-beam-rotor').first().evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
 assert.equal(await p.evaluate(()=>getComputedStyle($('#homeAccountDialog'),'::backdrop').animationName),'none');
 await p.evaluate(()=>{MonoHomeAccountPicker.hide();});
 assert.equal(await p.evaluate(()=>getComputedStyle($('#homeAccountDialog'),'::backdrop').backdropFilter),'none');
 await p.waitForFunction(()=>!document.querySelector('#homeAccountDialog').open);
 await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.mic-beam-rotor').first().evaluate(el=>getComputedStyle(el).animationName),'none');await p.emulateMedia({reducedMotion:'no-preference'});
 await p.evaluate(()=>document.documentElement.classList.add('mic-beam-disabled'));assert.equal(await p.locator('.mic-beam').evaluate(el=>getComputedStyle(el).display),'none');
 // Mock only the native transport; use the actual entry form and persistence engine.
 await p.evaluate(()=>{window.successNotices=[];const notifyOriginal=notify;window.notify=(message,success,...rest)=>{if(success)successNotices.push(message);return notifyOriginal(message,success,...rest);};window.nativeMessages=[];window.MonoNative={saveWaveSupported:true,refreshReminders(){},prepareSaveWave(data){window.waveRequest=data;nativeMessages.push(['prepare',data.id]);setTimeout(()=>MonoSaveWave.ready(data.id,true),20);},finishSaveWave(id){nativeMessages.push(['finish',id]);MonoSaveWave.ready(id,true);window.waveReceiptVisible=$('#entryDialog').open&&!!document.querySelector('.save-wave-receipt');window.pendingWave=id;},cancelSaveWave(id){nativeMessages.push(['cancel',id]);}};openEntry('Кофе 350');});
 await p.waitForTimeout(400);await p.locator('#saveButton').click();await p.waitForSelector('.save-wave-receipt');
 await p.screenshot({path:path.join(screenshots,'saved-receipt.png')});
 assert.equal(await p.locator('#entryDialog').evaluate(el=>el.open),true);
 await p.evaluate(()=>{window.receiptTrace=[];let frames=0;function sample(){receiptTrace.push({open:$('#entryDialog').hasAttribute('open'),visibility:getComputedStyle($('#drafts')).visibility});if(++frames<45)requestAnimationFrame(sample);}requestAnimationFrame(sample);MonoSaveWave.finished(pendingWave);});
 assert.equal(await p.locator('#entryDialog').evaluate(el=>el.hasAttribute('data-save-dismissing')&&el.inert),true);
 await p.waitForFunction(()=>!document.querySelector('#entryDialog').open);
 assert.equal(await p.locator('#entryDialog').evaluate(el=>el.open),false);
 assert.deepEqual(await p.evaluate(()=>state.entries.map(e=>e.amount)),[35000]);
 assert.deepEqual(await p.evaluate(()=>nativeMessages.map(x=>x[0])),['prepare','finish']);
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mono-v2')).entries.length),1);
 assert.equal(await p.evaluate(()=>waveReceiptVisible),true);await p.waitForFunction(()=>!document.querySelector('.save-wave-receipt'));
 assert.deepEqual(await p.evaluate(()=>successNotices),[]);assert(await p.evaluate(()=>receiptTrace.filter(x=>x.open).every(x=>x.visibility==='hidden')));
 assert(await p.evaluate(()=>waveRequest.panel.width>0&&waveRequest.panel.height>0&&/^#[0-9a-f]{6}$/i.test(waveRequest.accent)));
 await p.evaluate(()=>{openEntry('Такси 200');const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='mono-v2')throw Error('full');return original.call(this,key,value);};});
 await p.waitForTimeout(400);await p.locator('#saveButton').click();await p.waitForTimeout(500);
 assert.equal(await p.locator('#entryDialog').evaluate(el=>el.open&&!el.inert),true);
 assert.equal(await p.locator('#saveButton').isEnabled(),true);assert.equal(await p.evaluate(()=>state.entries.length),1);
 assert.deepEqual(await p.evaluate(()=>nativeMessages.map(x=>x[0])),['prepare','finish','prepare','cancel']);
 assert.deepEqual(errors,[]);
 console.log('PASS: 21 theme/size combinations; microphone beam disabled; themed sheet receipt; reduced motion; immediate blur removal; native handshake saves once; storage failure keeps editor interactive. Screenshots: '+screenshots);
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
