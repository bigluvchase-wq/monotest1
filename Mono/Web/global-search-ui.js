(function(root){
 'use strict';
 const dialog=$('#globalSearch'),input=dialog.querySelector('input'),results=dialog.querySelector('.search-results');
 const categoryDialog=$('#searchCategoryDialog');
 const sections=[['history','Операции'],['statistics','Статистика'],['limits','Лимиты'],['settings','Настройки'],['accounts','Счета'],['goals','Цели'],['payments','Обязательные платежи'],['categories','Категории'],['deposits','Вклады'],['reminders','Напоминания']];
 const {norm}=MonoSearch;
 const today=()=>E.dateString(new Date());
 const resultButton=(kind,id,title,detail='')=>`<button type="button" class="global-result" data-result="${kind}" data-id="${esc(id)}"><strong>${esc(title)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</button>`;
 const group=(title,items)=>items.length?`<section><h3>${title}</h3>${items.join('')}</section>`:'';
 function renderSearch(){
  const value=norm(input.value);
  dialog.querySelector('[data-search-clear]').hidden=!value;
  if(!value){results.innerHTML='<p class="muted">Попробуйте поискать</p><div class="search-examples">'+['такси вчера','1 500 ₽','лимиты'].map(s=>`<button class="secondary" data-example="${s}" type="button">${s}</button>`).join('')+'</div>';return;}
  const query=MonoSearch.parse(value,today(),MonoPeriod),exact=[],groups=[];
  const entities=(label,kind,items)=>{
   const rest=[];
   for(const item of items){
    const name=norm(item.name);
    if(!name.includes(value))continue;
    const html=resultButton(kind,item.id,item.name);
    (name===value?exact:rest).push(html);
   }
   groups.push(group(label,rest));
  };
  entities('Разделы','section',sections.map(([id,name])=>({id,name})));
  entities('Платежи','payment',state.payments);
  entities('Цели','goal',state.goals);
  entities('Счета','account',state.accounts);
  const cats=[...new Set([...state.categories,...state.incomeCategories])];
  if(query.words.length&&query.amount===null)groups.push(group('Категории',cats.filter(c=>query.words.every(w=>norm(c).includes(w))).map(c=>resultButton('category',c,c))));
  const rows=state.entries.filter(e=>MonoSearch.matches(e,query,entryCurrency(e))).sort((a,b)=>b.date.localeCompare(a.date));
  for(const [type,title] of [['expense','Расходы'],['income','Доходы']]){
   groups.push(group(title,rows.filter(e=>e.type===type).map(e=>resultButton('entry',e.id,e.title,fmtDate(e.date)+' · '+money(e.amount,entryCurrency(e))))));
  }
  results.innerHTML=group('Точные совпадения',exact)+groups.join('')||'<p>Ничего не найдено</p><p class="muted">Попробуйте упростить запрос.</p>';
 }
 function open(){
  if(page!=='home'||holding||listening||tourActive||document.querySelector('dialog[open]'))return;
  renderSearch();dialog.showModal();input.focus({preventScroll:true});
 }
 function openCategory(name){
  const query=MonoSearch.parse(input.value,today(),MonoPeriod);
  const rows=state.entries.filter(e=>['income','expense'].includes(e.type)&&e.category===name&&(!query.period||e.date>=query.period.start&&e.date<=query.period.end)).sort((a,b)=>b.date.localeCompare(a.date));
  categoryDialog.querySelector('h2').textContent=name;
  categoryDialog.querySelector('.search-category-list').innerHTML=rows.length?groupedEntriesHTML(rows,false):'<p class="muted">Операций нет</p>';
  categoryDialog.showModal();
 }
 function showCard(kind,id){
  if(kind==='payment'){MonoPayments.show(id);return;}
  const record=(kind==='goal'?state.goals:state.accounts).find(item=>item.id===id);
  if(!record)return;
  const caption=kind==='goal'?'Накоплено':'На счёте',value=kind==='goal'?E.goalBalance(state,id):E.balance(state,id);
  actionDialog(record.name,`<p class="muted">${caption}</p><p class="entry-info-total">${money(value,record.currency)}</p>${kind==='goal'&&record.target?`<p class="muted">Цель · ${money(record.target,record.currency)}</p>`:''}`);
 }
 $('#searchLaunch').onclick=open;
 input.oninput=renderSearch;
 dialog.querySelector('[data-search-cancel]').onclick=()=>dialog.close();
 dialog.querySelector('[data-search-clear]').onclick=()=>{input.value='';renderSearch();input.focus();};
 categoryDialog.querySelector('button').onclick=()=>categoryDialog.close();
 dialog.addEventListener('click',event=>{
  if(event.target===dialog){dialog.close();return;}
  const b=event.target.closest('button');
  if(!b)return;
  if(b.dataset.example){input.value=b.dataset.example;renderSearch();input.focus();return;}
  const {result,id}=b.dataset;
  if(!result)return;
  input.blur();
  if(result==='section'){
   dialog.close();
   navigate(id==='statistics'?'history':id,{noPageMotion:true});
   if(id==='statistics')$('[data-operation="expense"]')?.click();
  }else if(result==='entry'){
   MonoEntryDetail.show(id);
  }else if(result==='category')openCategory(id);
  else showCard(result,id);
 });
 dialog.addEventListener('close',()=>{input.value='';renderSearch();});
 let start=null;
 $('#home').addEventListener('touchstart',event=>{
  start=null;
  if(event.touches.length!==1||scrollY>2||holding||listening||event.target.closest('button,input,select,textarea,a,label'))return;
  const t=event.touches[0];start={x:t.clientX,y:t.clientY,id:t.identifier};
 },{passive:true});
 $('#home').addEventListener('touchmove',event=>{
  if(event.touches.length!==1){start=null;return;}
  if(!start)return;
  const t=event.touches[0],dy=t.clientY-start.y,dx=t.clientX-start.x;
  if(dy>14&&Math.abs(dx)<dy*.55&&event.cancelable)event.preventDefault();
 },{passive:false});
 $('#home').addEventListener('touchcancel',()=>{start=null;},{passive:true});
 $('#home').addEventListener('touchend',event=>{
  const origin=start;start=null;
  const t=[...event.changedTouches].find(t=>t.identifier===origin?.id);
  if(!t||scrollY>2)return;
  const dy=t.clientY-origin.y,dx=t.clientX-origin.x;
  if(dy>65&&Math.abs(dx)<dy*.55)open();
 },{passive:true});
})(window);
