(function(root){
 'use strict';
 function validDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T12:00:00Z');
  return !isNaN(date)&&date.toISOString().slice(0,10)===value&&value>='0001-01-01';
 }
 function range(start,end){
  if(!validDate(start)||!validDate(end))throw Error('Выберите существующие даты.');
  if(start>end)throw Error('Дата начала должна быть раньше даты окончания.');
  return {start,end};
 }
 function month(value){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)||value<'0001-01')throw Error('Выберите месяц.');
  const year=Number(value.slice(0,4)),m=Number(value.slice(5)),leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
  return range(value+'-01',value+'-'+days);
 }
 function shift(value,step){
  month(value);const year=Number(value.slice(0,4)),m=Number(value.slice(5));
  const serial=year*12+m-1+step,y=Math.floor(serial/12),n=serial%12+1;
  if(!Number.isInteger(step)||y<1||y>9999)throw Error('Этот месяц недоступен.');
  return String(y).padStart(4,'0')+'-'+String(n).padStart(2,'0');
 }
 function filter(entries,period,predicate=()=>true){return entries.filter(e=>e.date>=period.start&&e.date<=period.end&&predicate(e));}
 function preset(kind,anchor){
  if(!validDate(anchor))throw Error('Выберите дату.');
  if(kind==='month')return month(anchor.slice(0,7));
  if(kind==='year')return range(anchor.slice(0,4)+'-01-01',anchor.slice(0,4)+'-12-31');
  if(kind!=='week')throw Error('Неизвестный период.');
  const date=new Date(anchor+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
  const start=date.toISOString().slice(0,10);date.setUTCDate(date.getUTCDate()+6);
  return range(start,date.toISOString().slice(0,10));
 }
 function label(period,locale='ru-RU',short=false){
  const format=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',...(short&&period.start.slice(0,4)===period.end.slice(0,4)?{}:{year:'numeric'}),timeZone:'UTC'});
  return format.formatRange(new Date(period.start+'T12:00:00Z'),new Date(period.end+'T12:00:00Z'));
 }
 const api={validDate,range,month,shift,filter,label,preset};root.MonoPeriod=api;
 if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
