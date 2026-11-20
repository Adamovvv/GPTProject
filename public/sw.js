const CACHE='kyro-shell-v10';
const ASSET_CACHE='kyro-assets-v1';
const SHELL=['/','/manifest.webmanifest','/kyro-icon.svg'];

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>![CACHE,ASSET_CACHE].includes(key)).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;

 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put('/',copy));}
   return response;
  }).catch(()=>caches.match('/')));
  return;
 }

 const isStatic=request.destination==='script'||request.destination==='style'||request.destination==='image'||request.destination==='font'||/\\.(?:js|css|svg|png|jpe?g|webp|woff2?)$/i.test(url.pathname);
 if(!isStatic)return;

 event.respondWith(caches.open(ASSET_CACHE).then(async cache=>{
  const cached=await cache.match(request);
  const update=fetch(request).then(response=>{
   if(response.ok&&response.type==='basic')void cache.put(request,response.clone());
   return response;
  });
  if(cached){event.waitUntil(update.catch(()=>{}));return cached;}
  return update;
 }));
});

self.addEventListener('push',event=>{
 let payload={title:'KYRO',body:'У вас новое уведомление',url:'/notifications'};
 try{if(event.data)payload={...payload,...event.data.json()};}catch{if(event.data)payload.body=event.data.text();}
 event.waitUntil(self.registration.showNotification(payload.title||'KYRO',{body:payload.body||'У вас новое уведомление',icon:'/kyro-icon.svg',badge:'/kyro-icon.svg',data:{url:payload.url||'/notifications'},tag:payload.tag||'kyro-notification'}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=event.notification.data?.url||'/notifications';
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
  const existing=clients.find(client=>new URL(client.url).origin===self.location.origin);
  if(existing){void existing.focus();return existing.navigate(url);}
  return self.clients.openWindow(url);
 }));
});
