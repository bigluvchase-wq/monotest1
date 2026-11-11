(function(root){
'use strict';
// Вклады: простой процент на сумму вклада; проценты каждый день или раз в месяц попадают в доходы.
const CATEGORY='Проценты';
const DAY=86400000;
const parse=d=>{const [y,m,day]=d.split('-').map(Number);return Date.UTC(y,m-1,day);};
const fmt=ms=>new Date(ms).toISOString().slice(0,10);
const daysBetween=(a,b)=>Math.round((parse(b)-parse(a))/DAY);
const addDays=(d,n)=>fmt(parse(d)+n*DAY);
function addMonths(d,n){const [y,m,day]=d.split('-').map(Number),t=new Date(Date.UTC(y,m-1+n,1)),last=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();return fmt(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),Math.min(day,last)));}
const today=()=>E.dateString(new Date());
const termEnd=(start,term)=>term==='1m'?addMonths(start,1):term==='6m'?addMonths(start,6):addMonths(start,12);
// Накопленные проценты за k дней, в копейках.
const cumulative=(dep,k)=>Math.round(dep.principal*dep.rate/36500*Math.max(0,k));
const totalDays=dep=>Math.max(0,daysBetween(dep.start,dep.end));
const expectedTotal=dep=>cumulative(dep,totalDays(dep));
// Даты начисления: каждый день или по «месячным» датам плюс последний день срока.
function payoutDates(dep,upTo){
 const last=totalDays(dep),dates=[];
 if(dep.payout==='daily'){for(let k=1;k<=last;k++){const d=addDays(dep.start,k);if(d>upTo)break;dates.push([d,k]);}return dates;}
 for(let m=1;;m++){const d=addMonths(dep.start,m);if(d>dep.end)break;if(d>upTo)return dates;dates.push([d,daysBetween(dep.start,d)]);}
 if(dep.end<=upTo&&(!dates.length||dates[dates.length-1][0]!==dep.end))dates.push([dep.end,last]);
 return dates;
}
function nextPayout(dep){
 const now=today(),last=totalDays(dep);
 if(dep.posted>=last)return null;
 if(dep.payout==='daily'){const k=Math.min(last,dep.posted+1);return [addDays(dep.start,k),k];}
 for(let m=1;;m++){const d=addMonths(dep.start,m);if(d>dep.end)return [dep.end,last];if(daysBetween(dep.start,d)>dep.posted)return [d,daysBetween(dep.start,d)];}
}
function accrue(){
 if(typeof state!=='object'||!Array.isArray(state.deposits)||!state.deposits.length||storageProblem)return;
 const now=today(),jobs=[];
 for(const dep of state.deposits){
  if(!state.accounts.some(a=>a.id===dep.account))continue;
  const items=payoutDates(dep,now).filter(([,k])=>k>dep.posted);
  if(items.length)jobs.push([dep.id,items]);
 }
 if(!jobs.length)return;
 commit(s=>{
  if(!s.incomeCategories.includes(CATEGORY)){const i=s.incomeCategories.indexOf('Другое');s.incomeCategories.splice(i<0?s.incomeCategories.length:i,0,CATEGORY);}
  for(const [id,items] of jobs){
   const dep=s.deposits.find(d=>d.id===id);
   for(const [date,k] of items){
    const amount=cumulative(dep,k)-dep.postedAmount;
    dep.posted=k;
    if(amount<=0)continue;
    dep.postedAmount+=amount;
    s.entries.push({id:uid(),title:'Проценты · '+dep.name,amount,account:dep.account,type:'income',category:CATEGORY,date,createdAt:new Date().toISOString(),depositId:dep.id});
   }
  }
 });
}
const term={ '1m':'1 месяц','6m':'6 месяцев','1y':'1 год',custom:'Своя дата' };
function render(){
 const list=state.deposits||[];
 return `<div class="section-row"><button class="secondary" data-action="deposit">+ Добавить</button></div><p class="muted">Проценты сами попадают в доходы — каждый день или раз в месяц.</p><div class="goal-list">${list.map(dep=>{
  const currency=account(dep.account)?.currency||selectedCurrency,last=totalDays(dep),elapsed=Math.max(0,Math.min(last,daysBetween(dep.start,today()))),percent=last?elapsed/last*100:100,next=nextPayout(dep),done=dep.posted>=last&&today()>=dep.end;
  const nextText=done?'Срок вклада закончился':next?`Следующее начисление: ${fmtDate(next[0])} · ${money(cumulative(dep,next[1])-dep.postedAmount,currency)}`:'';
  return `<div class="card goal-card deposit-card" data-deposit-id="${esc(dep.id)}"><div class="category-head"><span class="goal-title">${esc(dep.name)}</span><span class="goal-percent">${String(dep.rate).replace('.',',')}%</span></div><div class="goal-value">${money(dep.principal,currency)} <small>· ${dep.payout==='daily'?'проценты каждый день':'проценты раз в месяц'}</small></div><div class="bar goal-bar"><span style="width:${percent.toFixed(1)}%"></span></div><div class="deposit-stats"><div><small>Начислено</small><b>${money(dep.postedAmount,currency)}</b></div><div><small>За весь срок</small><b>${money(expectedTotal(dep),currency)}</b></div><div><small>До</small><b>${dep.end.slice(8)}.${dep.end.slice(5,7)}.${dep.end.slice(2,4)}</b></div></div><p class="tiny muted">${esc(nextText)}</p><div class="action-row"><button class="small-link" data-edit-deposit="${esc(dep.id)}">Изменить вклад</button></div></div>`;
 }).join('')||empty('Пока нет вкладов','Потяните вниз, чтобы добавить.',false)}</div>`;
}
function form(id){
 if(!requireAccess('deposits'))return;
 const dep=(state.deposits||[]).find(d=>d.id===id),start=dep?.start||today(),selectedTerm=dep?(['1m','6m','1y'].find(t=>termEnd(dep.start,t)===dep.end)||'custom'):'1y',end=dep?.end||termEnd(start,'1y');
 actionDialog(dep?'Изменить вклад':'Новый вклад',`<form class="deposit-form"><label class="field">Название<input name="name" maxlength="100" required value="${esc(dep?.name||'')}" placeholder="Вклад в банке"></label><div class="form-grid"><label class="field">Сумма вклада<input name="principal" type="number" step="0.01" min="0.01" max="10000000000" required value="${dep?dep.principal/100:''}"></label><label class="field">Процент годовых<input name="rate" type="number" step="0.01" min="0.01" max="1000" required value="${dep?.rate??''}" inputmode="decimal"></label></div><label class="field">Счёт для начисления процентов<select name="account">${accountOptions(dep?.account||voiceAccount)}</select></label>${pickerField('Дата открытия','start','date',start)}<div class="form-grid"><label class="field">Срок<select name="term" id="depositTerm">${Object.entries(term).map(([v,t])=>`<option value="${v}" ${selectedTerm===v?'selected':''}>${t}</option>`).join('')}</select></label>${pickerField('Окончание','end','date',end)}</div><label class="field">Начислять проценты<select name="payout"><option value="daily" ${dep?.payout!=='monthly'?'selected':''}>Каждый день</option><option value="monthly" ${dep?.payout==='monthly'?'selected':''}>Раз в месяц</option></select></label><p class="tiny muted">Простой процент на сумму вклада. Проценты добавляются в доходы выбранного счёта; сама сумма вклада остаётся на вашем счёте.</p><button class="primary">Сохранить вклад</button>${dep?'<button type="button" class="secondary danger" id="deleteDeposit">Удалить вклад</button>':''}</form>`,f=>{
  const principal=cents(f.get('principal')),rate=Number(f.get('rate')),start=f.get('start'),end=f.get('end');
  if(!(principal>0)||!(rate>0))throw Error('Проверьте сумму и процент.');
  if(end<=start)throw Error('Дата окончания должна быть позже даты открытия.');
  if(daysBetween(start,end)>3660)throw Error('Срок вклада — не больше 10 лет.');
  const value={id:dep?.id||uid(),name:f.get('name').trim(),principal,rate,account:f.get('account'),start,end,payout:f.get('payout'),posted:dep?.posted||0,postedAmount:dep?.postedAmount||0};
  if(commit(s=>{s.deposits=s.deposits||[];const i=s.deposits.findIndex(x=>x.id===value.id);if(i<0)s.deposits.push(value);else s.deposits[i]=value;},'Вклад сохранён')){$('#actionDialog').close();accrue();}
 });
 const termSelect=$('#depositTerm'),startInput=$('#actionBody [name=start]'),endInput=$('#actionBody [name=end]');
 const setEnd=()=>{if(termSelect.value==='custom')return;endInput.value=termEnd(startInput.value,termSelect.value);endInput.dispatchEvent(new Event('input',{bubbles:true}));};
 termSelect.onchange=setEnd;startInput.addEventListener('change',setEnd);
 endInput.addEventListener('change',()=>{if(!['1m','6m','1y'].some(t=>termEnd(startInput.value,t)===endInput.value))termSelect.value='custom';else termSelect.value=['1m','6m','1y'].find(t=>termEnd(startInput.value,t)===endInput.value);});
 $('#deleteDeposit')?.addEventListener('click',()=>{if(!confirm('Удалить вклад? Уже начисленные проценты в доходах останутся.'))return;if(commit(s=>{s.deposits=s.deposits.filter(x=>x.id!==id);},'Вклад удалён'))$('#actionDialog').close();});
}
root.MonoDeposits={render,form,accrue,nextPayout,cumulative,payoutDates,addMonths};
})(window);
