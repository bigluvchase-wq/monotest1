// Optional real-browser regression. Fixtures only: no real shared-account requests.
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),{chromium}=require(process.env.MONO_PLAYWRIGHT_MODULE||'playwright'),express=require(path.join(repo,'server/node_modules/express')),E=require(path.join(repo,'Mono/Web/engine'));
const screenshots=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'mono-account-stack-'));
(async()=>{
 const server=express().use(express.static(path.join(repo,'Mono/Web'))).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({...(process.env.MONO_CHROMIUM_PATH?{executablePath:process.env.MONO_CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://api.monoapp.ru/**',r=>r.fulfill({json:{ok:true,premium:false}}));
 const seed=E.initialState();seed.settings.onboarded=true;seed.accounts=[{id:'main',name:'Основной счёт',currency:'RUB',initial:2486000},{id:'reserve',name:'Накопления',currency:'RUB',initial:10000000},{id:'travel',name:'На путешествие',currency:'RUB',initial:1500000},{id:'usd',name:'Доллары',currency:'USD',initial:10000}];
 await p.addInitScript(s=>localStorage.setItem('mono-v2',JSON.stringify(s)),seed);
 await p.goto('http://127.0.0.1:'+server.address().port);await p.evaluate(()=>{tourActive=false;$('#onboarding').close();MonoAccess.isPremium=()=>true;navigate('accounts',{noAnimation:true,noPageMotion:true});});
 await p.waitForTimeout(2800);
 const stack=p.locator('[data-account-stack=RUB]'),selected=()=>stack.locator('[data-stack-front=true] [data-stack-card]').getAttribute('data-stack-card');
 assert.equal(await selected(),'main');assert.equal(await p.locator('[data-account-stack=USD] .swipe-shell').count(),1);
 const before=await p.evaluate(()=>({json:JSON.stringify(state),voiceAccount}));
 await p.screenshot({path:path.join(screenshots,'start.png')});
 await stack.locator('[data-account-select=reserve]').click();
 // Freeze a deterministic middle frame and confirm only compositor properties are animated.
 await p.evaluate(()=>{document.querySelectorAll('.account-stack>.swipe-shell').forEach(el=>el.getAnimations().forEach(a=>{a.pause();a.currentTime=140;}));});
 const keys=await stack.locator('.swipe-shell').evaluateAll(els=>els.flatMap(el=>el.getAnimations().flatMap(a=>a.effect.getKeyframes().flatMap(f=>Object.keys(f)))));
 assert(keys.includes('transform'));assert(keys.every(k=>['transform','opacity','offset','computedOffset','easing','composite'].includes(k)));
 await p.screenshot({path:path.join(screenshots,'middle.png')});
 await p.evaluate(()=>document.querySelectorAll('.account-stack>.swipe-shell').forEach(el=>el.getAnimations().forEach(a=>a.play())));await p.waitForTimeout(350);assert.equal(await selected(),'reserve');
 await p.screenshot({path:path.join(screenshots,'end.png')});
 // Rapid selections retarget from the current visual pose and settle on the latest account.
 await stack.locator('[data-account-select=travel]').click();await p.waitForTimeout(50);await stack.locator('[data-account-select=main]').click();await p.waitForTimeout(350);assert.equal(await selected(),'main');assert.equal(await stack.locator('.swipe-shell').evaluateAll(els=>els.reduce((n,el)=>n+el.getAnimations().length,0)),0);
 assert.deepEqual(await p.evaluate(()=>({json:JSON.stringify(state),voiceAccount})),before,'presentation must not mutate financial state or recording selection');
 const cdp=await p.context().newCDPSession(p);await cdp.send('Performance.enable');
 await stack.locator('[data-account-select=reserve]').click();await p.waitForTimeout(70);
 const metrics1=(await cdp.send('Performance.getMetrics')).metrics;await p.waitForTimeout(130);const metrics2=(await cdp.send('Performance.getMetrics')).metrics;
 const metric=(list,name)=>list.find(m=>m.name===name).value;
 assert.equal(metric(metrics2,'LayoutCount')-metric(metrics1,'LayoutCount'),0,'no per-frame layout while the cards move');await p.waitForTimeout(150);
 await stack.locator('[data-account-select=main]').click();await p.waitForTimeout(350);

 await p.evaluate(()=>render());assert.equal(await selected(),'main');
 await stack.locator('[data-account-select=reserve]').focus();await p.keyboard.press('Enter');assert.equal(await selected(),'reserve');assert.equal(await stack.locator('.swipe-shell').evaluateAll(els=>els.reduce((n,el)=>n+el.getAnimations().length,0)),0,'keyboard immediate');
 await stack.locator('[data-stack-front=true] [data-edit-account]').click();assert.equal(await p.locator('#actionDialog').evaluate(e=>e.open),true);assert.equal(await p.locator('#actionBody input[name=name]').inputValue(),'Накопления');await p.locator('#actionDialog').evaluate(e=>e.close());await p.waitForTimeout(300);
 // Front card swipe deletion remains available; rear cards cannot open a hidden delete action.
 for(const id of ['main','reserve']){if(id==='reserve'){await stack.locator('[data-account-select=reserve]').click();await p.waitForTimeout(350);}const b=stack.locator('[data-account-select='+id+']'),box=await b.boundingBox();await p.mouse.move(box.x+box.width*.8,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.8-100,box.y+box.height*.5,{steps:8});await p.mouse.up();await p.waitForTimeout(260);assert.equal(await stack.locator('[data-stack-card='+id+']').evaluate(el=>el.closest('.swipe-shell').classList.contains('swipe-open')),id==='reserve');await p.evaluate(()=>MonoSwipe.close());}
 for(const theme of ['light','dark','purple','blue','green','burgundy','black']){await p.evaluate(t=>{state.settings.theme=t;applyTheme();},theme);for(const width of [320,390,430]){await p.setViewportSize({width,height:844});await p.waitForTimeout(70);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);for(const button of await stack.locator('[data-account-select]').all()){assert(await button.evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44&&document.elementFromPoint(r.x+5,r.y+5)?.closest('[data-account-select]')===el;}),'exposed 44px account header '+theme+width);}}}
 // Long labels, resize, one card, deletion of selected card, many accounts and scope separation.
 await p.evaluate(()=>{state.accounts[1].name='Очень длинное название счёта на путешествия и образование';render();});await p.waitForTimeout(100);await p.screenshot({path:path.join(screenshots,'long-label.png')});
 await p.emulateMedia({reducedMotion:'reduce'});await stack.locator('[data-account-select=main]').click();const reduced=await stack.locator('.swipe-shell').evaluateAll(els=>els.flatMap(el=>el.getAnimations().flatMap(a=>a.effect.getKeyframes().flatMap(f=>Object.keys(f)))));assert(!reduced.includes('transform'));await p.waitForTimeout(150);await p.screenshot({path:path.join(screenshots,'reduced.png')});
 await p.evaluate(()=>{state.accounts=state.accounts.filter(a=>a.id!=='main');render();});assert.equal(await selected(),'reserve');
 await p.evaluate(()=>{state.accounts=state.accounts.filter(a=>a.id==='reserve');render();});assert.equal(await selected(),'reserve');assert.equal(await stack.locator('.swipe-shell').count(),1);
 await p.evaluate(()=>{for(let i=0;i<7;i++)state.accounts.push({id:'extra'+i,name:'Счёт '+i,currency:'RUB',initial:0});render();});await stack.locator('[data-account-select=extra6]').click();await p.waitForTimeout(150);assert.equal(await selected(),'extra6');
 await p.evaluate(()=>{MonoTogether.storageKey=()=> 'shared-fixture';render();});assert.equal(await selected(),'reserve');await stack.locator('[data-account-select=extra0]').click();await p.waitForTimeout(150);await p.evaluate(()=>{MonoTogether.storageKey=()=>null;render();});assert.equal(await selected(),'extra6');
 assert.deepEqual(errors,[]);console.log('PASS: account stack, animated/rapid/keyboard selection, only compositor keyframes, unchanged financial state, edit/swipe delete, seven themes, three widths, reduced motion, long names, one/many accounts, scope isolation');console.log('Screenshots: '+screenshots);await browser.close();server.close();
})();
