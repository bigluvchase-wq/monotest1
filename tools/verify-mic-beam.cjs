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
 // Mock transport only: ordinary records never start a native wave; payments do.
 await p.evaluate(()=>{window.successNotices=[];const original=notify;window.notify=(message,success,...rest)=>{if(success)successNotices.push(message);return original(message,success,...rest);};window.nativeMessages=[];window.feedbackCount=0;MonoAccess.canUse=()=>true;window.MonoNative={saveWaveSupported:true,saveFeedback(){feedbackCount++;},refreshReminders(){},prepareSaveWave(data){window.waveRequest=data;nativeMessages.push(['prepare',data.id]);setTimeout(()=>MonoSaveWave.ready(data.id,true),20);},finishSaveWave(id){nativeMessages.push(['finish',id]);MonoSaveWave.ready(id,true);window.waveReceiptVisible=$('#actionDialog').open&&!!document.querySelector('.save-wave-receipt');window.pendingWave=id;},cancelSaveWave(id){nativeMessages.push(['cancel',id]);}};openEntry('Кофе 350');});
 await p.waitForTimeout(400);await p.locator('#saveButton').click();assert.equal(await p.locator('#entryDialog .save-wave-receipt').count(),0);
 await p.waitForFunction(()=>!document.querySelector('#entryDialog').hasAttribute('open'));
 assert.deepEqual(await p.evaluate(()=>state.entries.map(e=>e.amount)),[35000]);
 assert.deepEqual(await p.evaluate(()=>nativeMessages),[]);
 assert.equal(await p.evaluate(()=>feedbackCount),1);
 await p.waitForFunction(()=>!document.querySelector('.save-wave-receipt'));
 await p.evaluate(()=>paymentForm());await p.waitForTimeout(400);
 await p.locator('#actionBody [name=name]').fill('Интернет');await p.locator('#actionBody [name=amount]').fill('1250');
 await p.locator('#actionBody .primary').click();await p.waitForFunction(()=>!!window.pendingWave);
 assert.equal(await p.locator('.save-wave-receipt h2').innerText(),'Платёж сохранён');
 assert.equal(await p.evaluate(()=>waveReceiptVisible),true);
 assert.equal(await p.evaluate(()=>state.payments.length),1);
 assert.equal(await p.evaluate(()=>state.payments[0].amount),125000);
 assert.equal(await p.evaluate(()=>state.entries.length),1);
 assert.equal(await p.locator('#actionDialog').evaluate(el=>el.inert),true);
 assert(await p.evaluate(()=>waveRequest.panel.width>0&&waveRequest.panel.height>0&&/^#[0-9a-f]{6}$/i.test(waveRequest.accent)));
 await p.evaluate(()=>{window.receiptTrace=[];let frames=0;function sample(){receiptTrace.push({open:$('#actionDialog').hasAttribute('open'),visibility:getComputedStyle($('#actionBody')).visibility});if(++frames<35)requestAnimationFrame(sample);}requestAnimationFrame(sample);MonoSaveWave.finished(pendingWave);});
 await p.waitForFunction(()=>!document.querySelector('#actionDialog').hasAttribute('open'));
 assert.deepEqual(await p.evaluate(()=>nativeMessages.map(x=>x[0])),['prepare','finish']);
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mono-v2')).payments.length),1);
 await p.waitForFunction(()=>!document.querySelector('.save-wave-receipt'));
 assert.deepEqual(await p.evaluate(()=>successNotices),['Записано. Всё на своих местах.']);assert(await p.evaluate(()=>receiptTrace.filter(x=>x.open).every(x=>x.visibility==='hidden')));
 // Editing uses the same payment wave and updates the existing obligation, not a cash entry.
 await p.evaluate(()=>paymentForm(state.payments[0].id));await p.waitForTimeout(400);
 await p.locator('#actionBody [name=amount]').fill('1400');await p.locator('#actionBody .primary').click();
 await p.waitForFunction(()=>nativeMessages.filter(x=>x[0]==='finish').length===2);
 await p.evaluate(()=>MonoSaveWave.finished(pendingWave));await p.waitForFunction(()=>!document.querySelector('#actionDialog').hasAttribute('open'));
 assert.equal(await p.evaluate(()=>state.payments.length),1);assert.equal(await p.evaluate(()=>state.payments[0].amount),140000);assert.equal(await p.evaluate(()=>state.entries.length),1);
 await p.waitForFunction(()=>!document.querySelector('.save-wave-receipt'));
 await p.evaluate(()=>{openEntry('Такси 200');const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='mono-v2')throw Error('full');return original.call(this,key,value);};});
 await p.waitForTimeout(400);await p.locator('#saveButton').click();await p.waitForTimeout(500);
 assert.equal(await p.locator('#entryDialog').evaluate(el=>el.open&&!el.inert),true);
 assert.equal(await p.locator('#saveButton').isEnabled(),true);assert.equal(await p.evaluate(()=>state.entries.length),1);
 assert.deepEqual(await p.evaluate(()=>nativeMessages.map(x=>x[0])),['prepare','finish','prepare','finish']);
 assert.deepEqual(errors,[]);
 console.log('PASS: 21 theme/size combinations; microphone beam disabled; ordinary save without wave; payment native handshake saves once; reduced motion; immediate blur removal; storage failure keeps editor interactive. Screenshots: '+screenshots);
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
