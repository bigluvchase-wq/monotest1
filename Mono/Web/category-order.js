(function(root){
 'use strict';
 function apply(state,type,order){
  const key=type==='expense'?'categories':type==='income'?'incomeCategories':null;if(!key)throw Error('Неизвестный тип категории.');
  const previous=state[key];if(order.length!==previous.length||new Set(order).size!==previous.length||!order.every(name=>previous.includes(name)))throw Error('Список категорий изменился. Повторите перемещение.');
  const next=structuredClone(state);next[key]=[...order];return next;
 }
 function forLimits(state){const order=Array.isArray(state.settings.limitOrder)?state.settings.limitOrder:[];return [...new Set([...order,...state.categories])].filter(c=>state.categories.includes(c));}
 function applyLimits(state,order){apply(state,'expense',order);const next=structuredClone(state);next.settings.limitOrder=[...order];return next;}
 const api={apply,forLimits,applyLimits};root.MonoCategoryOrder=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
