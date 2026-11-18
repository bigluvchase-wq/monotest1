// Real source geometry, interruption recovery, keyboard dismissal and frame-layout budget.
const path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),{chromium}=require(process.env.MONO_PLAYWRIGHT_MODULE||'playwright');
const express=require(path.join(repo,'server/node_modules/express')),E=require(path.join(repo,'Mono/Web/engine'));
(async()=>{
 const server=express().use(express.static(path.join(repo,'Mono/Web'))).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({executablePath:process.env.MONO_CHROMIUM_PATH,args:['--no-sandbox']});
 try{
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.route('https://api.monoapp.ru/**',r=>r.fulfill({json:{ok:true,premium:false}}));
 const seed=E.initialState();seed.settings.onboarded=true;
 await p.addInitScript(seed=>localStorage.setItem('mono-v2',JSON.stringify(seed)),seed);
 await p.goto('http://127.0.0.1:'+server.address().port);await p.evaluate(()=>{tourActive=false;$('#onboarding').close();});await p.waitForTimeout(1000);
 await p.evaluate(()=>{for(const side of ['top','bottom']){const b=document.createElement('button');b.id='motion-'+side;b.textContent='Open '+side;Object.assign(b.style,{position:'fixed',left:'24px',[side]:'65px',zIndex:'9999',height:'42px',width:'130px'});document.body.append(b);b.onclick=()=>{actionDialog('Проверка', '<p>Содержимое окна</p><button type="button" onclick="this.closest(\'dialog\').close()">Готово</button>');window.openFrames=$('#actionDialog').getAnimations()[0]?.effect.getKeyframes();};}});
 const d=p.locator('#actionDialog');
 for(const [side,direction] of [['top','from-top'],['bottom','from-bottom']]){
  await p.locator('#motion-'+side).click();
  assert.equal(await d.getAttribute('data-motion-direction'),null);
  assert.equal(await p.locator('#motion-'+side).evaluate(el=>getComputedStyle(el).visibility),'visible');
  const frames=await p.evaluate(()=>window.openFrames);assert.match(frames[0].transform,/translate/);assert.match(frames[0].transform,/scale\(0?\.?985\)/);
  assert.equal(await d.evaluate(el=>getComputedStyle(el).animationName),'none');
  await p.waitForTimeout(420);await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#actionDialog').hasAttribute('open'));
  assert.equal(await p.locator('#motion-'+side).evaluate(el=>getComputedStyle(el).visibility),'visible');
 }
 // Close mid-open, then reopen while the exit is running. No jump or late close.
 await p.evaluate(()=>$('#motion-bottom').click());await p.waitForTimeout(70);
 const interrupted=await d.evaluate(el=>{const before=getComputedStyle(el).transform;el.close();return {before,after:el._exit.effect.getKeyframes()[0].transform};});assert.equal(interrupted.before,interrupted.after);
 await p.waitForTimeout(60);await d.evaluate(el=>el.showModal());await p.waitForTimeout(500);assert.equal(await d.evaluate(el=>el.open),true);
 await d.evaluate(el=>el.close());await p.waitForFunction(()=>!document.querySelector('#actionDialog').hasAttribute('open'));
 // The border contour paints, but the animation must not lay out every frame.
 const cdp=await p.context().newCDPSession(p);await cdp.send('Performance.enable');
 await p.locator('#motion-top').click();await p.waitForTimeout(45);
 const layouts=async()=>{const r=await cdp.send('Performance.getMetrics');return r.metrics.find(m=>m.name==='LayoutCount').value;};
 const start=await layouts();assert(await d.evaluate(el=>el.getAnimations().some(a=>a.currentTime<MonoMotion.duration.formOpen-100)),'sample starts during active animation');await p.waitForTimeout(150);const count=await layouts()-start;assert(count<=2,'frame-by-frame layout: '+count);
 await p.waitForTimeout(300);await d.evaluate(el=>el.close());await p.waitForFunction(()=>!document.querySelector('#actionDialog').hasAttribute('open'));
 await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#motion-bottom').click();assert.equal(await d.evaluate(el=>el.getAnimations().length),0);await d.evaluate(el=>el.close());assert.equal(await d.evaluate(el=>el.hasAttribute('open')),false);
 await p.emulateMedia({reducedMotion:'no-preference'});
 // A queued native close event must not cancel a newly reopened modal.
 await p.evaluate(()=>{const d=$('#actionDialog');d.showModal();d.dataset.saveWave='true';d.close();delete d.dataset.saveWave;d.showModal();});await p.waitForTimeout(400);assert.equal(await d.evaluate(el=>el.open),true);
 await d.evaluate(el=>el.close());await p.waitForFunction(()=>!document.querySelector('#actionDialog').hasAttribute('open'));
 // The specialised chart keeps its owner; switching its view never animates layout height.
 await p.evaluate(()=>{navigate('history',{noAnimation:true,noPageMotion:true});const source=document.querySelector('[data-operation="expense"]');MonoCharts.open('expense',source);});
 await p.waitForFunction(()=>!MonoCharts.isBusy());
 await p.locator('[data-monthly-chart]').click();
 const visualFrames=await p.locator('.chart-visual').evaluate(el=>el.getAnimations().flatMap(a=>a.effect.getKeyframes()));
 assert(visualFrames.length);assert(visualFrames.every(f=>!('height' in f)&&!('width' in f)));
 assert.equal(await p.locator('#chartDialog').getAttribute('data-motion-owned'),null);
 await p.locator('[data-chart-view]').click();await p.locator('.chart-period-button').click();
 assert.equal(await p.locator('#periodDialog').getAttribute('data-motion-owned'),'true');
 await p.locator('#periodDialog').evaluate(el=>el.close());await p.waitForFunction(()=>!document.querySelector('#periodDialog').hasAttribute('open'));
 await p.evaluate(()=>MonoCharts.close());await p.waitForFunction(()=>!document.querySelector('#chartDialog').hasAttribute('open'));
 assert.deepEqual(errors,[]);console.log('PASS: restored form entrance from either button position, no duplicate CSS animation, Escape, interruption/reopen recovery, reduced motion; layouts during active frames: '+count);
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
