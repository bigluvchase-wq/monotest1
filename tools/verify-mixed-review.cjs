// Run against disposable local storage only; never contacts the production API.
const path=require('node:path'),assert=require('node:assert/strict'),repo=path.resolve(__dirname,'..');
const {chromium}=require(process.env.MONO_PLAYWRIGHT_MODULE||'playwright'),express=require(path.join(repo,'server/node_modules/express')),E=require(path.join(repo,'Mono/Web/engine'));
(async()=>{
 const server=express().use(express.static(path.join(repo,'Mono/Web'))).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({executablePath:process.env.MONO_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://api.monoapp.ru/**',r=>r.fulfill({json:{ok:true,premium:false}}));
 const seed=E.initialState();seed.settings.onboarded=true;
 await p.addInitScript(seed=>localStorage.setItem('mono-v2',JSON.stringify(seed)),seed);await p.goto('http://127.0.0.1:'+server.address().port);
 await p.evaluate(()=>{tourActive=false;$('#onboarding').close();MonoAccess.canUse=()=>true;});await p.waitForTimeout(600);
 await p.evaluate(()=>openEntry());
 const focus=await p.locator('#dictation').evaluate(field=>{
  const style=getComputedStyle(field);
  return {active:document.activeElement===field,outline:style.outlineStyle,ring:style.boxShadow};
 });
 assert(focus.active);
 assert.equal(focus.outline,'none');
 assert.equal(focus.ring,'none');
 await p.evaluate(()=>{document.documentElement.style.setProperty('--vv-top','35px');document.documentElement.style.setProperty('--vv-h','340px');});
 await p.waitForTimeout(300);
 const typing=await p.locator('#entryDialog').boundingBox();
 assert(typing.y>=35&&typing.y+typing.height<=375,'text sheet fits the keyboard viewport');
 await p.locator('#dictation').fill('Кофе 250');
 await p.locator('#parseButton').click();
 await p.locator('[data-index]>summary').waitFor();
 assert.equal(await p.locator('[data-index] [data-field=title]').isVisible(),false);
 assert.match(await p.locator('[data-index]>summary').innerText(),/Кофе[\s\S]*250[\s\S]*Изменить/);
 await p.locator('[data-index]>summary').click();
 await p.locator('[data-field=amount]').fill('270');
 assert.match(await p.locator('[data-index]>summary').innerText(),/270/);
 await p.locator('#closeEntry').click();
 await p.waitForFunction(()=>!$('#entryDialog').hasAttribute('open'));
 await p.evaluate(()=>{document.documentElement.style.removeProperty('--vv-top');document.documentElement.style.removeProperty('--vv-h');});
 await p.evaluate(()=>{window.hapticCount=0;window.MonoNative={refreshReminders(){},saveFeedback(){window.hapticCount++;}};});
 const phrase='купил кофе за 300 потом мы купили продукты за 1000 и вчера я заправился на лукойле на тыща 200 а ещё также вчера мне вернули долг 500 руб. и напомни завтра с утра купить корм';
 await p.evaluate(t=>openEntry(t),phrase);await p.waitForFunction(()=>document.querySelectorAll('[data-reminder-index]').length===1);
 assert.equal(await p.locator('[data-index]').count(),4);assert.equal(await p.locator('#saveButton').isEnabled(),true);assert.equal(await p.locator('#actionDialog').evaluate(e=>e.open),false);
 assert.deepEqual(await p.locator('[data-field=title]').evaluateAll(es=>es.map(e=>e.value)),['Кофе','Продукты','Заправка','Возврат долга']);
 await p.locator('[data-reminder-index]>summary').click();
 await p.locator('[data-reminder-field=title]').fill('Купить корм коту');await p.locator('[data-reminder-field=text]').fill('Два пакета');await p.locator('[data-reminder-field=time]').fill('10:30');
 for(const width of [320,390,430]){await p.setViewportSize({width,height:844});assert(await p.locator('#entryDialog').evaluate(e=>e.scrollWidth<=e.clientWidth),'review must not overflow horizontally');}await p.setViewportSize({width:390,height:844});
 await p.locator('[data-reminder-index]').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/mono-mixed-review.png'});
 await p.locator('[data-reminder-field=date]').fill('');await p.locator('#saveButton').click();assert.equal(await p.evaluate(()=>state.entries.length),0);assert.equal(await p.evaluate(()=>(state.reminders||[]).length),0);
 await p.locator('[data-reminder-field=date]').fill('2026-11-20');await p.locator('#saveButton').click();await p.waitForFunction(()=>state.entries.length===4);assert.equal(await p.evaluate(()=>window.hapticCount),1);
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('mono-v2')));assert.equal(saved.reminders.length,1);assert.equal(saved.reminders[0].title,'Купить корм коту');assert.equal(saved.reminders[0].time,'10:30');assert.equal(saved.reminders[0].text,'Два пакета');
 await p.waitForFunction(()=>!document.querySelector('#entryDialog').hasAttribute('open'));
 // Closing review must never create anything; deleted reminders do not gate free money recording.
 await p.evaluate(()=>openEntry('Кофе 250 и напомни завтра купить хлеб'));await p.waitForFunction(()=>document.querySelectorAll('[data-reminder-index]').length===1);
 await p.locator('[data-reminder-index]>summary').click();await p.locator('[data-remove-reminder]').click();await p.evaluate(()=>{MonoAccess.canUse=()=>false;});await p.locator('#saveButton').click();await p.waitForFunction(()=>state.entries.length===5);assert.equal(await p.evaluate(()=>state.reminders.length),1);
 await p.waitForFunction(()=>!document.querySelector('#entryDialog').hasAttribute('open'));await p.evaluate(()=>{MonoAccess.canUse=()=>true;openEntry('Напомни завтра в 10 позвонить маме');});await p.waitForFunction(()=>document.querySelectorAll('[data-reminder-index]').length===1);
 await p.locator('#saveButton').click();await p.waitForFunction(()=>state.reminders.length===2);assert.equal(await p.evaluate(()=>state.entries.length),5);assert.equal(await p.evaluate(()=>window.hapticCount),2);
 await p.waitForFunction(()=>!document.querySelector('#entryDialog').hasAttribute('open'));await p.evaluate(t=>openEntry(t),phrase);await p.waitForFunction(()=>document.querySelectorAll('[data-reminder-index]').length===1);await p.locator('#closeEntry').click();await p.waitForFunction(()=>!document.querySelector('#entryDialog').hasAttribute('open'));assert.equal(await p.evaluate(()=>state.entries.length),5);assert.equal(await p.evaluate(()=>state.reminders.length),2);
 await p.evaluate(()=>openEntry('ромашка 2000'));await p.waitForFunction(()=>document.querySelectorAll('[data-index]').length===1);await p.locator('[data-index]>summary').click();await p.locator('[data-field=category]').selectOption('Красота');await p.locator('#saveButton').click();await p.waitForFunction(()=>!document.querySelector('#entryDialog').hasAttribute('open'));
 // Reload with persisted app data, not a newly seeded state.
 const learnedData=await p.evaluate(()=>localStorage.getItem('mono-v2'));await p.addInitScript(data=>localStorage.setItem('mono-v2',data),learnedData);await p.reload();await p.evaluate(()=>{tourActive=false;$('#onboarding').close();MonoAccess.canUse=()=>true;openEntry('ромашка 3500');});await p.waitForFunction(()=>document.querySelectorAll('[data-index]').length===1);assert.equal(await p.locator('[data-field=category]').inputValue(),'Красота');await p.locator('#closeEntry').click();await p.waitForFunction(()=>!document.querySelector('#entryDialog').hasAttribute('open'));
 await p.evaluate(()=>{const t=MonoVoice.createTranscript(),phrase='Купил кофе 300 потом заправился на 650 и вчера мне вернули долг 500 и напомни завтра с утра купить корм';t.update('Купил кофе 300 потом заправился на 6',0,4);t.update(phrase,.2,10);openEntry(t.update(phrase+' '+phrase,.2,20));});await p.waitForFunction(()=>document.querySelectorAll('[data-reminder-index]').length===1);assert.equal(await p.locator('[data-index]').count(),3);assert.deepEqual(await p.locator('[data-field=amount]').evaluateAll(es=>es.map(e=>Number(e.value))),[300,650,500]);await p.locator('#closeEntry').click();await p.waitForFunction(()=>!document.querySelector('#entryDialog').hasAttribute('open'));
 await p.evaluate(()=>delete window.MonoNative);
 const shared=E.initialState();await p.evaluate(shared=>{MonoAccess.togetherRequest=async()=>({group:{id:'fixture',state:shared,rev:0,members:['111111','222222']},incoming:[],outgoing:[]});},shared);await p.evaluate(()=>MonoTogether.manage());await p.locator('#actionDialog').evaluate(e=>e.close());await p.waitForTimeout(350);
 const previewHTML=await p.evaluate(()=>renderOperations());assert.match(previewHTML,/together-mode/);await p.evaluate(()=>navigate('history',{noAnimation:true,noPageMotion:true}));assert.equal(await p.locator('#pageBody .together-mode').count(),1);assert(await p.evaluate(()=>{const el=document.querySelector('#pageBody .together-mode');MonoTogether.decorate();return el===document.querySelector('#pageBody .together-mode');}));
 await p.evaluate(()=>{
  navigate('menu',{noAnimation:true,noPageMotion:true});
  navigate('home',{noAnimation:true,noPageMotion:true});
  selectedMonth=MonoPeriod.shift(currentMonth(),-1);
 });
 await p.setViewportSize({width:390,height:620});
 for(const type of ['expense','income']){
  const card=p.locator(`[data-hd-go=${type}]`);
  const dimensions=()=>card.locator('b').evaluate(el=>{
   const r=el.getBoundingClientRect(),font=getComputedStyle(el);
   return {x:r.x,y:r.y,width:r.width,height:r.height,font:font.font};
  });
  const before=await dimensions();
  await card.locator('.mini-chart').click();
  assert.equal(await p.evaluate(()=>page),'home');
  assert.equal(await p.evaluate(()=>selectedMonth),await p.evaluate(()=>currentMonth()));
  assert.equal(await p.locator('.chart-origin').evaluate(el=>el.style.opacity),'0');
  const reveal=await p.locator('#chartPanel').evaluate(panel=>({
   opacity:getComputedStyle(panel).opacity,
   frames:panel.getAnimations().flatMap(animation=>animation.effect.getKeyframes())
  }));
  assert.equal(reveal.opacity,'1','the chart surface must stay opaque during the reveal');
  assert(reveal.frames.some(frame=>frame.clipPath?.startsWith('inset(')));
  assert(reveal.frames.every(frame=>frame.opacity===undefined));
  await p.waitForFunction(()=>!MonoCharts.isBusy());
  const scroll=await p.evaluate(()=>{
   const chart=$('#chartPanel');chart.scrollTop=180;
   const before=chart.scrollTop;MonoCharts.close();return {before,after:chart.scrollTop};
  });
  assert(scroll.before>0,'the chart fixture must be scrollable');
  assert.equal(scroll.after,scroll.before,'chart keeps its scroll position during close');
  await p.waitForFunction(()=>!$('#chartDialog').open);
  assert.equal(await p.evaluate(()=>page),'home');
  assert.equal(await p.evaluate(()=>selectedMonth),await p.evaluate(()=>MonoPeriod.shift(currentMonth(),-1)));
  assert.deepEqual(await dimensions(),before);
 }
 assert.deepEqual(errors,[]);console.log('PASS: mixed review, short titles, edits, required date, atomic persistence, reminder removal, free expenses, reminder-only saving, cancellation; no JS errors.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
