(function(root){
'use strict';
const icons={
 car:['Машина','<path d="m5 10 2-5h10l2 5M4 10h16v8H4zM7 18v2m10-2v2M7 14h2m6 0h2"/>'],
 home:['Дом','<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/>'],
 gift:['Подарок','<path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13"/><path d="M12 8C3 8 5 1 9 4l3 4c9 0 7-7 3-4z"/>'],
 palm:['Отпуск','<path d="M12 10c2 3 2 7 1 11M12 10C6 3 3 7 3 10c4-2 7-1 9 0zm0 0c5-8 9-4 9 0-4-2-6-2-9 0zm0 0C10 2 15 1 17 4M7 21h12"/>'],
 bike:['Мотоцикл','<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-7h6l3 7M9 17h5l-4-7M14 5h3l2 12M6 9h4"/>'],
 phone:['Телефон','<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>'],
 camera:['Камера','<path d="m8 5 2-2h4l2 2h5v15H3V5z"/><circle cx="12" cy="12" r="4"/>'],
 appliance:['Техника','<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="14" r="5"/><path d="M7 6h1m4 0h5"/>'],
 study:['Обучение','<path d="m2 9 10-5 10 5-10 5zM6 11v6c4 3 8 3 12 0v-6M22 9v8"/>'],
 heart:['Здоровье','<path d="M12 21 3 12C-2 5 7 0 12 7c5-7 14-2 9 5z"/>'] ,
 laptop:['Ноутбук','<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M2 20h20l-2-4H4z"/>'],
 plane:['Путешествие','<path d="m3 12 7-2 1-7h2l1 7 7 2v2l-7-1-1 6 3 2H8l3-2-1-6-7 1z"/>'],
 ring:['Свадьба','<circle cx="12" cy="15" r="7"/><path d="m7 5 3-3h4l3 3-5 5zM7 5h10M10 2l2 8 2-8"/>'],
 pet:['Питомец','<path d="M6 18c0-2 2-3 3-5a3.5 3.5 0 0 1 6 0c1 2 3 3 3 5 0 4-4 2-6 2s-6 2-6-2z"/><ellipse cx="4.5" cy="10" rx="1.7" ry="2.3"/><ellipse cx="9" cy="5.5" rx="1.7" ry="2.3"/><ellipse cx="15" cy="5.5" rx="1.7" ry="2.3"/><ellipse cx="19.5" cy="10" rx="1.7" ry="2.3"/>'],
 fitness:['Спорт','<path d="M8 12h8M3 7h4v10H3zM17 7h4v10h-4zM1 10v4m22-4v4"/>'],
 music:['Музыка','<path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="5.5" cy="18.5" rx="3.5" ry="2.5"/><ellipse cx="17.5" cy="16.5" rx="3.5" ry="2.5"/>'],
 renovation:['Ремонт','<rect x="4" y="3" width="14" height="6" rx="2"/><path d="M18 6h3v7H11v4M9 17h4v5H9z"/>'],
 safety:['Подушка','<path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6zM8 12l3 3 5-6"/>'],
 business:['Бизнес','<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12l4 3h3m4 0h3l4-3"/><rect x="10" y="13" width="4" height="4" rx="1"/>'],
 boat:['Лодка','<path d="M12 2v13H3l3 6h12l3-6h-9M12 3l8 10h-8M9 5l-6 8h6"/>']
};
function svg(key){return `<svg class="goal-symbol" viewBox="0 0 24 24" aria-hidden="true">${(icons[key]||icons.palm)[1]}</svg>`;}
function field(key='palm'){return `<div class="goal-icon-control"><button type="button" class="goal-icon-current" aria-label="Выбрать иконку цели" aria-expanded="false">${svg(key)}</button><input type="hidden" name="icon" value="${key}"></div>`;}
function picker(){return `<div class="goal-icon-picker" hidden>${Object.entries(icons).map(([key,[label]])=>`<button type="button" data-goal-icon="${key}" aria-label="${label}">${svg(key)}</button>`).join('')}</div>`;}
function bind(container){const open=container.querySelector('.goal-icon-current'),list=container.querySelector('.goal-icon-picker');open.onclick=()=>{list.hidden=!list.hidden;open.setAttribute('aria-expanded',String(!list.hidden));};list.onclick=e=>{const b=e.target.closest('[data-goal-icon]');if(!b)return;container.querySelector('[name=icon]').value=b.dataset.goalIcon;open.innerHTML=svg(b.dataset.goalIcon);list.hidden=true;open.setAttribute('aria-expanded','false');};}
root.MonoGoalIcons={svg,field,picker,bind,ids:Object.keys(icons)};
})(window);
