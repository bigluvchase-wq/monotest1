const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('chart dismissal only starts at the top, never takes over a scrolling gesture',()=>{
 const handlers={},panel={scrollTop:0,style:{},classList:{add(){},remove(){}},addEventListener(n,fn){handlers[n]=fn;},setPointerCapture(){}},dialog={open:true,addEventListener(){}},target={closest:()=>null};let closes=0;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../Mono/Web/chart-gesture.js'),'utf8'),{document:{querySelector:s=>s==='#chartPanel'?panel:dialog},performance:{now:()=>500},MonoCharts:{isBusy:()=>false,close(){closes++;}},reducedMotion:()=>true});
 const down=()=>handlers.pointerdown({pointerType:'mouse',isPrimary:true,button:0,clientX:100,clientY:100,target,pointerId:1}),move=()=>handlers.pointermove({pointerType:'mouse',clientX:100,clientY:420,pointerId:1,cancelable:true,preventDefault(){}}),up=()=>handlers.pointerup({pointerType:'mouse',pointerId:1});
 panel.scrollTop=240;down();panel.scrollTop=0;move();up();assert.equal(closes,0,'reaching the top during scrolling cannot dismiss');
 panel.scrollTop=0;down();panel.scrollTop=80;move();up();assert.equal(closes,0,'scrolling before a pull is claimed cannot dismiss');
 panel.scrollTop=0;down();move();up();assert.equal(closes,1,'a fresh downward gesture at the top can dismiss');
});
