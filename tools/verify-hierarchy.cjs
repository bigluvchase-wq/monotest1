// Disposable browser fixtures; production requests are mocked.
const path=require('node:path'),assert=require('node:assert/strict'),repo=path.resolve(__dirname,'..');
const {chromium}=require(process.env.MONO_PLAYWRIGHT_MODULE||'playwright'),express=require(path.join(repo,'server/node_modules/express')),E=require(path.join(repo,'Mono/Web/engine'));
(async()=>{
 const server=express().use(express.static(path.join(repo,'Mono/Web'))).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({executablePath:process.env.MONO_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const p=await browser.newPage({viewport:{width:390,height:844},locale:'ru-RU'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://api.monoapp.ru/**',r=>r.fulfill({json:{ok:true,premium:false}}));
 const seed=E.initialState();seed.settings.onboarded=true;seed.accounts.push({id:'reserve',name:'Резерв',currency:'RUB',initial:0});
 await p.addInitScript(s=>{if(!localStorage.getItem('mono-v2'))localStorage.setItem('mono-v2',JSON.stringify(s));},seed);await p.goto('http://127.0.0.1:'+server.address().port);await p.evaluate(()=>{tourActive=false;$('#onboarding').close();MonoAccess.canUse=()=>true;});await p.waitForTimeout(600);
 assert.equal(await p.locator('html').getAttribute('data-design'),'classic');await p.evaluate(()=>navigate('settings',{noAnimation:true,noPageMotion:true}));await p.locator('[data-settings-section=appearance]').click();await p.locator('#themeSetting').selectOption('sapphire');assert.equal(await p.locator('html').getAttribute('data-design'),'sapphire');await p.reload();assert.equal(await p.locator('html').getAttribute('data-design'),'sapphire');await p.evaluate(()=>{tourActive=false;$('#onboarding').close();MonoAccess.canUse=()=>true;});
 await p.evaluate(()=>openEntry('кофе 300 и продукты 1500'));await p.waitForFunction(()=>document.querySelectorAll('.review-draft').length===2);
 assert.equal(await p.locator('.review-draft[open]').count(),0);assert.equal(await p.locator('#entrySource').evaluate(e=>e.open),false);
 await p.locator('#batchAccount').selectOption('reserve');assert.deepEqual(await p.evaluate(()=>drafts.map(d=>d.account)),['reserve','reserve']);
 await p.locator('.draft-summary').first().click();await p.locator('[data-field=title]').first().fill('Утренний кофе');assert.match(await p.locator('.draft-summary').first().innerText(),/Утренний кофе/);
 await p.locator('[data-field=account]').first().selectOption('main');assert.equal(await p.locator('#batchAccount').inputValue(),'');assert.equal(await p.locator('.review-draft').first().evaluate(e=>e.open),true);
 await p.locator('[data-field=amount]').first().fill('');await p.locator('.draft-summary').first().click();await p.locator('#saveButton').click();assert.equal(await p.locator('.review-draft').first().evaluate(e=>e.open),true);assert.equal(await p.evaluate(()=>state.entries.length),0);
 await p.locator('[data-field=amount]').first().fill('300');await p.locator('#saveButton').click();await p.waitForFunction(()=>state.entries.length===2&&!document.querySelector('#entryDialog').open);
 await p.evaluate(()=>navigate('history',{noAnimation:true,noPageMotion:true}));await p.locator('[data-entry-open]').first().click();assert(await p.locator('#entryInfoDialog button').filter({hasText:'Удалить запись'}).isVisible());await p.locator('#entryInfoDialog select[name=category]').selectOption('Красота');await p.locator('#entryInfoDialog button[type=submit]').click();assert(await p.evaluate(()=>state.entries.some(e=>e.category==='Красота')));
 for(const width of [320,390,430]){await p.setViewportSize({width,height:844});for(const target of ['home','history','menu','accounts','goals','payments','reminders','settings']){await p.evaluate(t=>navigate(t,{noAnimation:true,noPageMotion:true}),target);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${target} must fit ${width}px`);}}
 await p.evaluate(()=>navigate('menu',{noAnimation:true,noPageMotion:true}));assert.equal(await p.locator('.menu-group .menu-tile').count(),9);const row=await p.locator('.menu-group .menu-tile').first().evaluate(e=>({height:e.getBoundingClientRect().height,direction:getComputedStyle(e).flexDirection}));assert.equal(row.direction,'row');assert(row.height<90);
 await p.evaluate(()=>navigate('settings',{noAnimation:true,noPageMotion:true}));await p.locator('[data-settings-section=appearance]').click();
 await p.locator('#themeSetting').selectOption('light');assert.equal(await p.locator('html').getAttribute('data-design'),'classic');
 await p.reload();assert.equal(await p.locator('html').getAttribute('data-design'),'classic');assert.equal(await p.evaluate(()=>state.settings.designPreview),false);assert.deepEqual(errors,[]);
 console.log('PASS: Classic default, optional persisted Sapphire theme, compact review, batch/per-record accounts, edits, hidden validation, persistence, category correction, menu rows, 320/390/430px layouts and theme comparison.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
