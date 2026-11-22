// Mobile UI regressions: disposable fixtures and mocked API only.
const path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs'),repo=path.resolve(__dirname,'..');
const {chromium}=require(process.env.MONO_PLAYWRIGHT_MODULE||'playwright'),express=require(path.join(repo,'server/node_modules/express')),E=require(path.join(repo,'Mono/Web/engine'));
(async()=>{
 const server=express().use(express.static(path.join(repo,'Mono/Web'))).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({executablePath:process.env.MONO_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ru-RU'}),errors=[],out='/tmp/mono-layout-polish';fs.mkdirSync(out,{recursive:true});p.on('pageerror',e=>errors.push(e.message));await p.route('https://api.monoapp.ru/**',r=>r.fulfill({json:{ok:true,premium:false}}));
 let seed=E.initialState();seed.settings.onboarded=true;seed.accounts[0].initial=5000000;const date=E.dateString(new Date());seed=E.saveDrafts(seed,[{title:'Кофе',type:'expense',category:'Кафе',amount:30000,date,account:'main'},{title:'Очень длинное название покупки и магазина для проверки переноса текста',type:'expense',category:'Другое',amount:999999999,date,account:'main'}]).next;
 await p.addInitScript(s=>localStorage.setItem('mono-v2',JSON.stringify(s)),seed);await p.goto('http://127.0.0.1:'+server.address().port);await p.evaluate(()=>{tourActive=false;$('#onboarding').close();MonoAccess.canUse=()=>true;});await p.waitForTimeout(800);
 const cdp=await p.context().newCDPSession(p);
 async function swipe(x,y,dy){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await p.waitForTimeout(60);for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+dy*i/12}]});await p.waitForTimeout(17);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(350);}
 await p.evaluate(()=>navigate('menu',{noAnimation:true,noPageMotion:true}));
 await p.waitForTimeout(350);
 await swipe(210,620,-360);
 const menu=await p.evaluate(()=>{
  const grid=$('.menu-grid'),workspace=$('#workspace'),tiles=$$('.menu-tile');
  const support=tiles.at(-1).getBoundingClientRect();
  return {tiles:tiles.length,fits:workspace.scrollHeight<=workspace.clientHeight+1,
   footer:tiles.at(-1).dataset.go==='support'&&Math.abs(support.width-grid.clientWidth)<1&&support.bottom<$('.bottom-nav').getBoundingClientRect().top,
   twoColumns:tiles.slice(0,-1).every(tile=>tile.getBoundingClientRect().width<grid.clientWidth/2),
   scroll:workspace.scrollTop};
 });
 assert.deepEqual(menu,{tiles:9,fits:true,footer:true,twoColumns:true,scroll:0});
 await p.screenshot({path:out+'/menu-grid.png'});
 await p.evaluate(()=>{navigate('home',{noAnimation:true,noPageMotion:true});MonoSearch.show();});await p.waitForTimeout(650);await swipe(220,620,-370);assert(await p.locator('#searchResults').evaluate(e=>e.scrollTop>30),'search results must scroll on home');assert.equal(await p.evaluate(()=>page),'home');assert.equal(await p.evaluate(()=>scrollY),0);await p.screenshot({path:out+'/search-scrolled.png'});
 await p.evaluate(()=>{document.documentElement.style.setProperty('--vv-h','380px');document.documentElement.style.setProperty('--vv-top','40px');});assert(await p.locator('#searchResults').evaluate(e=>e.getBoundingClientRect().bottom<=420),'search fits simulated keyboard viewport');assert(await p.locator('#searchLayer .search-backdrop').evaluate(e=>e.getBoundingClientRect().height>=innerHeight),'search backdrop covers the full screen with keyboard');await swipe(210,310,-150);assert(await p.locator('#searchResults').evaluate(e=>e.scrollTop>0));await p.evaluate(()=>{MonoSearch.hide();document.documentElement.style.removeProperty('--vv-h');document.documentElement.style.removeProperty('--vv-top');});await p.waitForTimeout(500);
 await p.evaluate(()=>openEntry(''));await p.waitForTimeout(500);assert.equal(await p.locator('#entrySource').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');assert.equal(await p.locator('#entrySource>summary').isVisible(),false);const g=await p.locator('.gallery-pick').boundingBox(),b=await p.locator('#parseButton').boundingBox();assert.equal(Math.round(g.width),48);assert.equal(Math.round(g.height),48);assert(b.x-g.x-g.width>=11);assert(Math.abs(g.y-b.y)<2);await p.screenshot({path:out+'/manual-entry.png'});
 const sheet=p.locator('#entryDialog');
 await p.evaluate(()=>{const root=document.documentElement;root.style.setProperty('--vv-h','280px');root.style.setProperty('--vv-top','38px');});
 async function assertCentered(midpoint){
  const {y,height}=await sheet.boundingBox();
  assert(Math.abs(y+height/2-midpoint)<2,'dialog is centered in the visible area');
 }
 await assertCentered(178);
 await p.locator('#dictation').fill('кофе 300 и продукты 1500');
 await p.locator('#parseButton').click();
 await p.waitForFunction(()=>document.querySelectorAll('.review-draft').length===2);
 await assertCentered(178);
 const saveBounds=await p.locator('#saveButton').boundingBox();
 assert(saveBounds.y+saveBounds.height<318,'save stays above the keyboard');
 await p.evaluate(()=>{const root=document.documentElement;root.style.removeProperty('--vv-h');root.style.removeProperty('--vv-top');});
 await p.waitForTimeout(250);
 await p.screenshot({path:out+'/review.png'});
 await p.locator('#closeEntry').click();
 await p.waitForFunction(()=>!document.querySelector('#entryDialog').hasAttribute('open'));
 for(const design of [false,true]){await p.evaluate(v=>{state.settings.designPreview=v;applyTheme();},design);for(const [width,height] of [[320,568],[390,844],[430,932]]){await p.setViewportSize({width,height});for(const target of ['home','history','menu','accounts','goals','limits','payments','categories','deposits','reminders','settings','profile','premium','support','rewards','achievements']){await p.evaluate(t=>navigate(t,{noAnimation:true,noPageMotion:true}),target);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${target}, width ${width}, sapphire ${design}: no horizontal overflow`);if(target==='profile'){const back=await p.locator('#backToMenu').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,shadow:getComputedStyle(e).boxShadow}));assert.equal(back.bg,'rgba(0, 0, 0, 0)');assert.equal(back.shadow,'none');}if(width===390&&!design)await p.screenshot({path:out+'/'+target+'.png'});}}}
 assert.equal(await p.locator('.voice-ring-visual').count(),0);await p.evaluate(()=>{navigate('home',{noAnimation:true,noPageMotion:true});openEntry('');});await p.waitForTimeout(500);
 assert.equal(await p.locator('html').evaluate(e=>e.classList.contains('modal-scroll-locked')),true);await assertCentered(await p.evaluate(()=>innerHeight/2));await swipe(5,700,-200);assert.equal(await p.evaluate(()=>scrollY),0);await p.screenshot({path:out+'/centered-entry.png'});
 await p.locator('#closeEntry').click();await p.waitForFunction(()=>!document.querySelector('#entryDialog').hasAttribute('open'));assert.equal(await p.locator('html').evaluate(e=>e.classList.contains('modal-scroll-locked')),false);
 await p.evaluate(()=>openEntry('кофе 300 и продукты 1500'));await p.waitForTimeout(500);const footer=await p.locator('.review-footer').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,width:e.getBoundingClientRect().width,dialog:e.closest('dialog').clientWidth}));assert.notEqual(footer.bg,'rgba(0, 0, 0, 0)');assert(footer.dialog-footer.width<=38,'save footer aligns with the dialog content');
 const bottomGap=await p.locator('#saveButton').evaluate(b=>b.closest('dialog').getBoundingClientRect().bottom-b.getBoundingClientRect().bottom);
 assert(bottomGap>=8&&bottomGap<=16,'save button clears the bottom edge without an extra gap');await p.screenshot({path:out+'/save-footer.png'});await p.evaluate(()=>{if($('#toast').matches(':popover-open'))$('#toast').hidePopover();$('#toast').hidden=true;window.closedAt=0;$('#saveButton').addEventListener('click',()=>{window.exitDuration=$('#entryDialog')._exit?.effect.getTiming().duration;},{once:true});$('#entryDialog').addEventListener('close',()=>window.closedAt=performance.now(),{once:true});});await p.locator('#saveButton').click();assert(await p.locator('#entryDialog').evaluate(e=>e.hasAttribute('open')),'sheet remains mounted while closing');assert(await p.locator('#toast').evaluate(e=>e.hidden),'success notice waits for close');await p.waitForFunction(()=>!document.querySelector('#entryDialog').hasAttribute('open'));await p.waitForFunction(()=>!document.querySelector('#toast').hidden);assert(await p.evaluate(()=>window.closedAt>0));assert.equal(await p.evaluate(()=>window.exitDuration),150);assert.deepEqual(errors,[]);console.log('PASS: fixed menu grid, touch search scrolling, full search backdrop, keyboard viewport, centered entry and review, locked background, save footer, restored microphone, sixteen pages × three sizes × two designs. Screenshots: '+out);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
