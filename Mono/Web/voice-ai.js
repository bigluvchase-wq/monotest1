(function(root){
'use strict';
const CONSENT='mono-voice-ai-consent';
function enabled(){try{return localStorage.getItem(CONSENT)!=='0';}catch{return false;}}
function setEnabled(value){
 try{localStorage.setItem(CONSENT,value?'1':'0');return true;}catch{return false;}
}
async function parse(text,{signal}={}){
 if(!enabled()||!root.MONO_CONFIG?.voiceAIUrl)return null;
 const now=new Date();
 const context={time:String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),today:E.dateString(new Date()),account:voiceAccount,
  accounts:state.accounts.map(({id,name,currency})=>({id,name,currency})),
  goals:state.goals.map(({id,name,currency})=>({id,name,currency})),
  categories:state.categories.slice(),incomeCategories:state.incomeCategories.slice()};
 if(!root.MonoAccess?.parseVoice)throw Error('voice_unavailable');
 const data=await root.MonoAccess.parseVoice({text,context},{signal});
 if(!data?.ok||data.source!=='yandex'||!Array.isArray(data.entries)||data.entries.length>30||!Array.isArray(data.errors)||data.errors.length>10||!data.errors.every(e=>typeof e==='string'&&e.length<=300))throw Error('invalid_response');
 // Даже ответ нашего сервера проверяем перед показом. Состояние и историю не изменяем.
 const allowed=new Set(['title','type','amount','account','date','category','goalId','toAccount','toAmount','installmentTotal']);
 if(data.entries.some(e=>!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(k=>!allowed.has(k))))throw Error('invalid_response');
 if(data.entries.length)E.saveDrafts(state,data.entries);
 const commands=data.commands||[];
 const kinds=['reminder','goal','account','payment','deposit','limit','remove'];
 const targets=['entry','account','goal','payment','reminder','deposit','limit','category'];
 const fields=new Set(['name','title','text','date','time','repeat','currency','amount','target','initial','category','principal','rate','term','payout','last','strict']);
 if(!Array.isArray(commands)||commands.length>5||commands.some(cmd=>!cmd||!kinds.includes(cmd.kind)||!cmd.data||typeof cmd.data!=='object'||Object.keys(cmd.data).some(k=>!fields.has(k))))throw Error('invalid_response');
 for(const cmd of commands)if(cmd.kind==='remove'){
  if(!targets.includes(cmd.data.target)||!cmd.data.last&&!cmd.data.name)throw Error('invalid_response');
  if(cmd.data.last&&(cmd.data.target!=='entry'||!/последн/iu.test(text)))throw Error('invalid_response');
  cmd.data.strict=true;
 }
 return {entries:data.entries,commands,errors:data.errors};
}
root.MonoVoiceAI={enabled,setEnabled,parse};
})(window);
