const path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const repo=path.resolve(__dirname,'..'),{chromium}=require(process.env.MONO_PLAYWRIGHT_MODULE||'playwright');
const express=require(path.join(repo,'server/node_modules/express')),E=require(path.join(repo,'Mono/Web/engine'));
(async()=>{
 const server=express().use(express.static(path.join(repo,'Mono/Web'))).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({executablePath:process.env.MONO_CHROMIUM_PATH,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),seed=E.initialState(),errors=[];
 seed.settings.onboarded=true;seed.reminders=[{id:'open-test',title:'Оплатить интернет',text:'Проверить тариф',date:E.dateString(new Date()),time:'23:59',repeat:'once',done:false}];
 await context.route('https://api.monoapp.ru/**',r=>r.fulfill({json:{ok:true,premium:false}}));
 await context.addInitScript(seed=>localStorage.setItem('mono-v2',JSON.stringify(seed)),seed);
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port);
 await p.evaluate(()=>{tourActive=false;$('#onboarding').close();MonoAccess.isPremium=()=>true;MonoAccess.canUse=()=>true;renderHomeReminders();});await p.waitForTimeout(2200);
 const screenshots=fs.mkdtempSync(path.join(os.tmpdir(),'mono-reminder-expand-'));
 for(const theme of ['light','dark','purple','blue','green','burgundy','black']){
  await p.evaluate(theme=>{state.settings.theme=theme;applyTheme();navigate('home',{noAnimation:true,noPageMotion:true});},theme);
  await p.locator('[data-home-note="open-test"]').click();
  assert.equal(await p.evaluate(()=>page),'reminders');
  const shell=p.locator('.reminder-expand-shell');assert.equal(await shell.count(),1);
  const frames=await shell.evaluate(el=>el.getAnimations().flatMap(a=>a.effect.getKeyframes()));
  for(const frame of frames)for(const key of Object.keys(frame))assert(['transform','opacity','offset','computedOffset','easing','composite'].includes(key),key);
  if(theme==='purple'){await p.waitForTimeout(240);await p.screenshot({path:path.join(screenshots,'opening.png')});}
  await p.waitForFunction(()=>!document.querySelector('.reminder-expand-shell'));
  assert.equal(await p.evaluate(()=>document.querySelector('.app').style.pointerEvents),'');
  assert.equal(await p.locator('.nav-ghost').count(),0);
  await p.locator('#backToMenu').click();await p.waitForFunction(()=>document.body.dataset.page==='home');await p.waitForTimeout(650);
 }
 // An interrupted navigation cannot leave a blocking layer or stale app styles.
 await p.locator('[data-home-note="open-test"]').click();await p.evaluate(()=>navigate('home',{noAnimation:true,noPageMotion:true}));
 assert.equal(await p.locator('.reminder-expand-shell').count(),0);
 assert.equal(await p.evaluate(()=>document.querySelector('.app').style.pointerEvents),'');
 await p.emulateMedia({reducedMotion:'reduce'});await p.locator('[data-home-note="open-test"]').click();
 assert.equal(await p.evaluate(()=>page),'reminders');assert.equal(await p.locator('.reminder-expand-shell').count(),0);
 assert.equal(await p.evaluate(()=>state.reminders.length),1);assert.equal(await p.evaluate(()=>state.entries.length),0);assert.deepEqual(errors,[]);
 console.log('PASS: seven themes, real reminder navigation and return, transform/opacity only, interruption cleanup, Reduce Motion, unchanged data. Screenshots: '+screenshots);
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
