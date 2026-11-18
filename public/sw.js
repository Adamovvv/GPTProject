const CACHE='kyro-shell-v3';
const SHELL=['/','/manifest.webmanifest','/kyro-icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;if(request.mode==='navigate'){event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('/',copy));return response;}).catch(()=>caches.match('/')));return;}event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;})));});
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
