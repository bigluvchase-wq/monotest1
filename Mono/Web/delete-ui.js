(function(root){
'use strict';
let openShell=null,gesture=null,suppressUntil=0,undoBar=null,undoTimer=null;
const revealWidth=86;
function metadata(element){return {kind:element.dataset.entityKind,id:element.dataset.entityId,type:element.dataset.entityType||'expense',currency:element.dataset.entityCurrency||selectedCurrency};}
function setMeta(element,info){element.dataset.entityKind=info.kind;element.dataset.entityId=info.id;if(info.type)element.dataset.entityType=info.type;if(info.currency)element.dataset.entityCurrency=info.currency;}
function closeShell(shell=openShell){if(!shell)return;shell.classList.remove('swipe-open','swipe-moving');shell.querySelector('.swipe-content').style.transform='';const b=shell.querySelector('.swipe-delete');b.inert=true;b.setAttribute('aria-hidden','true');if(openShell===shell)openShell=null;}
function openSwipe(shell){if(openShell&&openShell!==shell)closeShell();openShell=shell;shell.classList.add('swipe-open');shell.classList.remove('swipe-moving');shell.querySelector('.swipe-content').style.transform='';const b=shell.querySelector('.swipe-delete');b.inert=false;b.removeAttribute('aria-hidden');}
function attach(element,info,existingButton){
 if(!element||element.closest('.swipe-shell')||element.classList.contains('swipe-shell'))return;
 if(info.kind==='entry'&&(page==='history'||element.closest('#chartDialog'))){if(existingButton){existingButton.dataset.entityDelete='true';setMeta(existingButton,info);}return;}
 const shell=document.createElement('div');shell.className='swipe-shell'+(element.classList.contains('card')?' swipe-card':'');setMeta(shell,info);
 const content=document.createElement('div');content.className='swipe-content';
 const action=document.createElement('button');action.type='button';action.className='swipe-delete';action.textContent='Удалить';action.setAttribute('aria-label','Удалить запись');action.setAttribute('aria-hidden','true');action.inert=true;setMeta(action,info);action.dataset.entityDelete='true';
 element.replaceWith(shell);content.append(element);shell.append(action,content);
 let x=existingButton;
 if(!x){x=document.createElement('button');x.type='button';x.textContent='×';x.className='entity-x';element.classList.add('entity-has-x');element.append(x);}
 x.dataset.entityDelete='true';setMeta(x,info);x.setAttribute('aria-label',x.getAttribute('aria-label')||'Удалить '+({entry:'операцию',payment:'платёж',goal:'цель',account:'счёт',category:'категорию',limit:'лимит',ticket:'черновик',deposit:'вклад',reminder:'напоминание'}[info.kind]||'запись'));x.title=x.getAttribute('aria-label');
 if(info.kind==='payment'){x.textContent='×';x.className='entity-x';element.classList.add('entity-has-x');}
}
function decorate(container=document.querySelector('#pageBody')){
 if(!container)return;
 container.querySelectorAll('.payment-summary-card[data-payment-record]').forEach(el=>attach(el,{kind:'payment',id:el.dataset.paymentRecord}));
 container.querySelectorAll('.entry').forEach(el=>{const b=el.querySelector('[data-delete]');if(b)attach(el,{kind:'entry',id:b.dataset.delete},b);});
 for(const [selector,kind,key] of [['[data-edit-account]','account','editAccount'],['[data-edit-goal]','goal','editGoal'],['[data-delete-payment]','payment','deletePayment'],['[data-ticket]','ticket','ticket'],['[data-edit-deposit]','deposit','editDeposit'],['[data-edit-reminder]','reminder','editReminder']])container.querySelectorAll(selector).forEach(b=>attach(b.closest('.card'),{kind,id:b.dataset[key]},kind==='payment'?b:null));
 container.querySelectorAll('[data-entity-kind]').forEach(el=>{if(el.classList.contains('category-item')||el.classList.contains('limit-item'))attach(el,metadata(el));});
 if(openShell&&!openShell.isConnected)openShell=null;
}
function refresh(){refreshAccounts();renderHomeReminders();if(page!=='home')render();root.MonoCharts?.refresh?.();}
function showUndo(before,after,label){
 undoBar?.remove();undoTimer?.cancel();const bar=document.createElement('div');bar.className='delete-undo';bar.setAttribute('role','status');const text=document.createElement('span');text.textContent=label;const undo=document.createElement('button');undo.type='button';undo.textContent='Отменить';bar.append(text,undo);
 (document.querySelector('#chartDialog[open]')||document.body).append(bar);undoBar=bar;
 undo.onclick=()=>{if(!undoTimer||undoTimer.remaining()<=0)return;if(JSON.stringify(state)!==after){bar.remove();undoTimer?.cancel();notify('После новых изменений отмена недоступна.');return;}if(persist(structuredClone(before))){refresh();bar.remove();undoTimer?.cancel();notify('Удаление отменено',false,{duration:2500,fade:160});}};
 undoTimer=MonoNoticeLifetime.mount(bar,()=>{bar.remove();if(undoBar===bar)undoBar=null;});
}
function remove(info){
 closeShell();let result;
 try{result=MonoDeletion.plan(state,info);if(info.kind==='limit'){const form=document.querySelector('#limitForm'),limits=state.limits[info.currency]||{};if(form&&state.categories.some((c,i)=>c!==info.id&&Math.round(Number(form.elements['limit'+i]?.value||0)*100)!==(limits[c]||0)))result.warning+=' Несохранённые изменения других лимитов будут сброшены.';}}catch(error){notify(error.message);return;}
 if(!confirm(result.warning))return;
 const before=structuredClone(state);if(!persist(result.next))return;
 refresh();showUndo(before,JSON.stringify(state),result.label);
}
// A row owns horizontal gestures that begin on it. Page navigation explicitly excludes the shell.
document.addEventListener('pointerdown',event=>{
 if(!event.isPrimary||event.button!==0)return;const shell=event.target.closest('.swipe-shell');
 if(!shell){if(openShell)closeShell();return;}
 if(holding||listening||tourActive||event.target.closest('input,select,textarea,.category-drag-handle,.swipe-delete,.entity-x,.delete-entry'))return;
 if(openShell&&openShell!==shell)closeShell();gesture={shell,id:event.pointerId,x:event.clientX,y:event.clientY,offset:shell.classList.contains('swipe-open')?-revealWidth:0,dx:0,horizontal:false,cancelled:false};
},{passive:true});
document.addEventListener('pointermove',event=>{
 const g=gesture;if(!g||event.pointerId!==g.id||g.cancelled)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;
 if(!g.horizontal){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){g.cancelled=true;return;}if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.4)return;g.horizontal=true;g.shell.classList.add('swipe-moving');}
 g.dx=dx;const x=Math.max(-revealWidth,Math.min(0,g.offset+dx));g.shell.querySelector('.swipe-content').style.transform=`translateX(${x}px)`;if(event.cancelable)event.preventDefault();
},{passive:false});
function finishGesture(event){const g=gesture;if(!g||event.pointerId!==g.id)return;gesture=null;if(!g.horizontal||g.cancelled)return;suppressUntil=performance.now()+100;g.shell.classList.remove('swipe-moving');if(g.offset+g.dx<-revealWidth*.42)openSwipe(g.shell);else closeShell(g.shell);}
document.addEventListener('pointerup',finishGesture,{passive:true});document.addEventListener('pointercancel',()=>{if(gesture)closeShell(gesture.shell);gesture=null;},{passive:true});
document.addEventListener('click',event=>{
 if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();return;}
 const button=event.target.closest('[data-entity-delete]');if(button){event.preventDefault();event.stopImmediatePropagation();remove(metadata(button));}
},{capture:true});
document.querySelector('#chartDialog').addEventListener('close',()=>{if(undoBar?.isConnected&&undoBar.closest('dialog'))document.body.append(undoBar);});
root.MonoSwipe={decorate,close:closeShell,cancelGesture:()=>{if(gesture)closeShell(gesture.shell);gesture=null;}};root.MonoDeleteUI={remove};decorate();
})(window);
