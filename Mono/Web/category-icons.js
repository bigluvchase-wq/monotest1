(function(root){
'use strict';
const icons={
 market:['Маркетплейсы','<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M9 5v8h6V5"/>'],
 clothes:['Одежда и обувь','<path d="m8 4-5 3 2 5 3-1v9h8v-9l3 1 2-5-5-3a4 4 0 0 1-8 0Z"/>'],
 subscriptions:['Подписки','<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>'],
 bets:['Ставки','<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 8h.01M12 12h.01M16 16h.01"/>'],
 fitness:['Спорт','<path d="M2 12h3m14 0h3M8 12h8M5 8h3v8H5zm11 0h3v8h-3z"/>'],
 cafe:['Кафе','<path d="M4 4h12v9a5 5 0 0 1-10 0V4m10 2h2a3 3 0 0 1 0 6h-2M3 21h16"/>'],
 groceries:['Продукты','<path d="M2 3h3l3 13h11l3-10H6"/><circle cx="10" cy="21" r="1"/><circle cx="18" cy="21" r="1"/>'],
 transport:['Транспорт','<path d="m5 10 2-5h10l2 5M4 10h16v8H4zM7 18v2m10-2v2M7 14h2m6 0h2"/>'],
 shopping:['Покупки','<path d="M4 7h16v14H4zM8 8V6a4 4 0 0 1 8 0v2"/>'],
 home:['Дом','<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/>'],
 health:['Здоровье','<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M12 8v8m-4-4h8"/>'],
 fun:['Развлечения','<path d="M8 3v18m8-18v18M3 8h18M3 16h18"/><rect x="3" y="3" width="18" height="18" rx="2"/>'],
 work:['Работа','<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12l4 3h3m4 0h3l4-3"/><rect x="10" y="13" width="4" height="4" rx="1"/>'],
 beauty:['Красота','<path d="M4 20 17 7m-1-1 3-3 3 3-3 3zM4 3v4M2 5h4m7 12v5m-2-2h4"/>'],
 other:['Другое','<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'],
 salary:['Зарплата','<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 9h1m12 6h1"/>'],
 gift:['Подарки','<path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8C3 8 5 1 9 4l3 4c9 0 7-7 3-4z"/>'],
 interest:['Проценты','<path d="m5 19 14-14"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/>'],
 sales:['Продажи','<path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1.5"/>'],
 wallet:['Другие доходы','<path d="M3 7V5l15-3v5M3 7h17v14H3zM16 12h6v5h-6zM19 14.5h.1"/>'],
 pet:['Питомцы','<path d="M6 18c0-2 2-3 3-5a3.5 3.5 0 0 1 6 0c1 2 3 3 3 5 0 4-4 2-6 2s-6 2-6-2z"/><ellipse cx="4.5" cy="10" rx="1.7" ry="2.3"/><ellipse cx="9" cy="5.5" rx="1.7" ry="2.3"/><ellipse cx="15" cy="5.5" rx="1.7" ry="2.3"/><ellipse cx="19.5" cy="10" rx="1.7" ry="2.3"/>'],
 fuel:['Топливо','<rect x="3" y="3" width="11" height="18" rx="2"/><path d="M6 6h5v5H6zM1 21h15m-2-11h2v7a2 2 0 0 0 4 0V8l-3-4m1 2-2 2 4 3"/>'],
 education:['Образование','<path d="m2 8 10-5 10 5-10 5zM6 11v6c4 3 8 3 12 0v-6M22 8v9"/>'],
 travel:['Путешествия','<path d="m3 12 7-2 1-7h2l1 7 7 2v2l-7-1-1 6 3 2H8l3-2-1-6-7 1z"/>'],
 children:['Дети','<circle cx="12" cy="12" r="9"/><path d="M8 10h.1M16 10h.1M8 15c2 3 6 3 8 0M10 3c0 4 5 4 4 0"/>'],
 utilities:['Коммунальные услуги','<path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13zM9 16a3 3 0 0 0 3 3"/>'],
 phone:['Связь','<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>'],
 insurance:['Страховка','<path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6zM8 12l3 3 5-6"/>'],
 debt:['Долги и кредиты','<path d="M5 8h14m-4-4 4 4-4 4M19 16H5m4-4-4 4 4 4"/>'],
 charity:['Благотворительность','<path d="M12 20 4 12C0 6 7 2 12 7c5-5 12-1 8 5z"/>']
};
const defaults={expense:{'Кафе':'cafe','Продукты':'groceries','Транспорт':'transport','Покупки':'shopping','Дом':'home','Здоровье':'health','Развлечения':'fun','Работа':'work','Красота':'beauty','Маркетплейсы':'market','Одежда и обувь':'clothes','Подписки':'subscriptions','Ставки':'bets','Спорт':'fitness','Связь':'phone','Путешествия':'travel','Питомцы':'pet','Образование':'education','Другое':'other'},income:{'Зарплата':'salary','Работа':'work','Подарки':'gift','Проценты':'interest','Продажи':'sales','Кешбэк':'wallet','Возврат долга':'debt','Аренда':'home','Возвраты':'debt','Другое':'wallet'}};
function key(name,type='expense'){const saved=typeof state==='object'?state.settings.categoryIcons?.[type]:null,value=saved&&Object.hasOwn(saved,name)?saved[name]:null;return Object.hasOwn(icons,value)?value:(defaults[type]?.[name]||'other');}
function paths(id){return (icons[id]||icons.other)[1];}
function svg(id,cls='category-symbol'){return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths(id)}</svg>`;}
function category(name,type='expense'){return svg(key(name,type));}
function picker(selected='other'){return `<div class="category-icon-picker">${Object.entries(icons).map(([id,[label]])=>`<button type="button" data-category-icon="${id}" aria-label="${label}" aria-pressed="${id===selected}">${svg(id)}</button>`).join('')}</div>`;}
function field(){return `<div class="category-icon-control"><button type="button" class="category-icon-current" aria-label="Выбрать значок категории" aria-expanded="false">${svg('other')}</button><input name="icon" type="hidden" value="other"></div>`;}
function edit(name,type){actionDialog('Значок категории',picker(key(name,type)));const list=document.querySelector('#actionBody .category-icon-picker');list.onclick=e=>{const b=e.target.closest('[data-category-icon]');if(!b)return;if(commit(s=>{const values=s.settings.categoryIcons||{};s.settings.categoryIcons={...values,[type]:{...values[type],[name]:b.dataset.categoryIcon}};},'Значок сохранён'))document.querySelector('#actionDialog').close();};}
function decorate(){const form=document.querySelector('#categoryForm');if(!form||form.dataset.iconsBound)return;form.dataset.iconsBound='true';const button=form.querySelector('.category-icon-current'),picker=form.querySelector('.category-picker-reveal');button.onclick=()=>{picker.hidden=!picker.hidden;button.setAttribute('aria-expanded',String(!picker.hidden));};picker.onclick=e=>{const b=e.target.closest('[data-category-icon]');if(!b)return;form.elements.icon.value=b.dataset.categoryIcon;button.innerHTML=svg(b.dataset.categoryIcon);picker.querySelectorAll('[data-category-icon]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));picker.hidden=true;button.setAttribute('aria-expanded','false');};}
const api={svg,paths,key,category,picker,field,decorate,ids:Object.keys(icons),defaults};root.MonoCategoryIcons=api;if(typeof module==='object')module.exports=api;
if(typeof document==='object')document.addEventListener('click',e=>{const b=e.target.closest('[data-edit-category-icon]');if(b)edit(b.dataset.editCategoryIcon,b.dataset.categoryIconType);});
})(typeof window==='object'?window:globalThis);
