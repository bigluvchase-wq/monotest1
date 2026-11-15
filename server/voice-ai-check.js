'use strict';
require('dotenv').config({quiet:true});
const {settings}=require('./voice-ai');
(async()=>{
 const cfg=settings(process.env);
 console.log('Node.js:',process.version);
 console.log('Умный разбор:',cfg.enabled?'включён':'выключен');
 console.log('Каталог:',cfg.folder?'задан':'не задан');
 console.log('API-ключ:',cfg.key?'задан':'не задан');
 if(!cfg.folder||!cfg.key)throw Error('Добавьте YANDEX_FOLDER_ID и YANDEX_API_KEY в .env.');
 console.log('Модель:',cfg.model);
 if(!process.argv.includes('--request')){console.log('Для одного платного тестового запроса: node voice-ai-check.js --request');return;}
 const response=await fetch('https://ai.api.cloud.yandex.net/foundationModels/v1/completion',{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:'Api-Key '+cfg.key,'Content-Type':'application/json','x-folder-id':cfg.folder,'x-data-logging-enabled':'false'},body:JSON.stringify({modelUri:cfg.model,completionOptions:{stream:false,temperature:0,maxTokens:'50'},jsonObject:true,messages:[{role:'system',text:'Верни только JSON: {"ready":true}'},{role:'user',text:'Проверка подключения.'}]})});
 if(!response.ok)throw Error('Yandex Cloud: HTTP '+response.status+'. Проверьте каталог, модель, роль сервисного аккаунта, область API-ключа и биллинг.');
 const data=await response.json();
 if(data.result?.alternatives?.[0]?.status!=='ALTERNATIVE_STATUS_FINAL')throw Error('Yandex Cloud вернул незавершённый ответ.');
 console.log('Yandex Cloud ответил успешно. Секретный ключ не выводился.');
})().catch(error=>{console.error(error.name==='TimeoutError'?'Yandex Cloud не ответил за 12 секунд.':error.message);process.exitCode=1;});
