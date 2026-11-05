(function(root){
 'use strict';
 const limit=record=>record?.digits===4?4:12;
 const clean=(value,max=4)=>String(value).replace(/[^0-9]/g,'').slice(0,max);
 async function hash(pin,salt){
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new Uint8Array(salt),iterations:150000,hash:'SHA-256'},material,256);
  return [...new Uint8Array(bits)].map(v=>v.toString(16).padStart(2,'0')).join('');
 }
 async function create(pin){
  if(!/^[0-9]{4}$/.test(pin))throw Error('Введите ровно 4 цифры.');
  const salt=[...crypto.getRandomValues(new Uint8Array(16))];
  return {salt,hash:await hash(pin,salt),digits:4};
 }
 async function verify(pin,record){
  if(!record||!new RegExp('^[0-9]{4,'+limit(record)+'}$').test(pin))return false;
  return await hash(pin,record.salt)===record.hash;
 }
 const api={limit,clean,create,verify};root.MonoPIN=api;
 if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
