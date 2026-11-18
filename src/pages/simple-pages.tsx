import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Bell,CheckCircle2,Loader2,Mail,ShieldCheck,Smartphone} from 'lucide-react';
import {Card,CardContent} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {APP_VERSION} from '@/config/app';
import {supabase} from '@/lib/supabase';
import {toast} from 'sonner';

function decodeVapidKey(value:string){
 const padding='='.repeat((4-value.length%4)%4);
 const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
 const raw=window.atob(base64);
 return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)));
}

export function SettingsPage(){
 const [email,setEmail]=useState('');
 const [currentEmail,setCurrentEmail]=useState('');
 const [verified,setVerified]=useState(false);
 const [loading,setLoading]=useState(true);
 const [savingEmail,setSavingEmail]=useState(false);
 const [pushBusy,setPushBusy]=useState(false);
 const [pushEnabled,setPushEnabled]=useState(false);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   if(!supabase){setLoading(false);return;}
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){setLoading(false);return;}
   if(active){setCurrentEmail(user.email||'');setEmail(user.email||'');}
   const {data:profile}=await supabase.from('profiles').select('is_verified').eq('id',user.id).maybeSingle();
   if(active){setVerified(Boolean(profile?.is_verified));setLoading(false);}
   if('serviceWorker' in navigator&&'PushManager' in window){
    const registration=await navigator.serviceWorker.ready;
    const subscription=await registration.pushManager.getSubscription();
    if(active)setPushEnabled(Boolean(subscription));
   }
  })();
  return()=>{active=false};
 },[]);
 const saveEmail=async()=>{
  if(!supabase||!email.trim())return;
  setSavingEmail(true);
  const {error}=await supabase.auth.updateUser({email:email.trim().toLowerCase()});
  setSavingEmail(false);
  if(error){toast.error(error.message);return;}
  toast.success('Письмо подтверждения отправлено на новый адрес');
 };
 const enablePush=async()=>{
  if(!supabase)return;
  const publicKey=import.meta.env.VITE_VAPID_PUBLIC_KEY as string|undefined;
  if(!publicKey){toast.error('Push ещё не настроен на сервере: отсутствует VITE_VAPID_PUBLIC_KEY');return;}
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){toast.error('Этот браузер не поддерживает push-уведомления');return;}
  setPushBusy(true);
  try{
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw new Error('Разрешение на уведомления не предоставлено');
   const registration=await navigator.serviceWorker.ready;
   const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(publicKey)});
   const json=subscription.toJSON();
   if(!json.endpoint||!json.keys?.p256dh||!json.keys?.auth)throw new Error('Браузер вернул неполную push-подписку');
   const {data:{user}}=await supabase.auth.getUser();
   if(!user)throw new Error('Сессия завершена');
   const {error:deleteError}=await supabase.from('kyro_push_subscriptions').delete().eq('user_id',user.id);
   if(deleteError)throw deleteError;
   const {error}=await supabase.from('kyro_push_subscriptions').insert({user_id:user.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth_secret:json.keys.auth});
   if(error)throw error;
   setPushEnabled(true);toast.success('Push-уведомления включены');
  }catch(error){toast.error(error instanceof Error?error.message:'Не удалось включить уведомления')}
  finally{setPushBusy(false)}
 };
 const disablePush=async()=>{
  if(!supabase)return;
  setPushBusy(true);
  try{
   const registration=await navigator.serviceWorker.ready;
   const subscription=await registration.pushManager.getSubscription();
   const endpoint=subscription?.endpoint;
   await subscription?.unsubscribe();
   if(endpoint){const {error}=await supabase.from('kyro_push_subscriptions').delete().eq('endpoint',endpoint);if(error)throw error;}
   setPushEnabled(false);toast.success('Push-уведомления отключены');
  }catch(error){toast.error(error instanceof Error?error.message:'Не удалось отключить уведомления')}
  finally{setPushBusy(false)}
 };
 if(loading)return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-neutral-400"/></div>;
 return <div className="mx-auto max-w-3xl space-y-5">
  <div><h1 className="text-3xl font-semibold">Настройки</h1><p className="mt-2 text-sm text-neutral-500">Управление аккаунтом и уведомлениями.</p></div>
  <Card><CardContent className="space-y-4 p-5">
   <div className="flex items-center gap-3"><Mail size={19}/><div><h2 className="font-semibold">Подтверждение аккаунта</h2><p className="text-xs text-neutral-500">Подтверждённый email отображается значком в профиле.</p></div><div className="ml-auto">{verified?<CheckCircle2 className="text-emerald-600" size={20}/>:<span className="text-xs text-neutral-400">Не подтверждён</span>}</div></div>
   <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input type="email" inputMode="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><Button onClick={()=>void saveEmail()} disabled={savingEmail||!email.trim()||email.trim().toLowerCase()===currentEmail.toLowerCase()}>{savingEmail?<Loader2 className="animate-spin" size={15}/>:null}Отправить подтверждение</Button></div>
   <p className="text-xs leading-5 text-neutral-400">После перехода по ссылке из письма статус аккаунта обновится автоматически. Для старых аккаунтов с техническим адресом KYRO можно указать настоящий email.</p>
  </CardContent></Card>
  <Card><CardContent className="space-y-4 p-5">
   <div className="flex items-center gap-3"><Bell size={19}/><div><h2 className="font-semibold">Push-уведомления</h2><p className="text-xs text-neutral-500">Уведомления о новых действиях в KYRO.</p></div><div className="ml-auto text-xs text-neutral-400">{pushEnabled?'Включены':'Выключены'}</div></div>
   <div className="flex flex-wrap gap-2">{pushEnabled?<Button variant="outline" onClick={()=>void disablePush()} disabled={pushBusy}>{pushBusy?<Loader2 className="animate-spin" size={15}/>:null}Отключить</Button>:<Button onClick={()=>void enablePush()} disabled={pushBusy}>{pushBusy?<Loader2 className="animate-spin" size={15}/>:<Smartphone size={15}/>}Включить push</Button>}</div>
   <p className="text-xs leading-5 text-neutral-400">Для фоновой доставки серверу нужны VAPID-ключи. Подписка браузера будет сохранена в защищённом профилем хранилище.</p>
  </CardContent></Card>
  <Card><CardContent className="divide-y p-0">
   <Link to="/privacy" className="flex items-center gap-3 p-5 hover:bg-neutral-50"><ShieldCheck size={19}/><span className="text-sm font-medium">Конфиденциальность</span></Link>
   <div className="flex items-center justify-between p-5"><span className="text-sm font-medium">Версия платформы</span><span className="text-sm text-neutral-500">KYRO v{APP_VERSION}</span></div>
  </CardContent></Card>
 </div>;
}

export function PlaceholderPage({title,description}:{title:string;description:string}){
 return <div className="mx-auto max-w-2xl py-10"><Card><CardContent className="p-8 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100"><SettingsIcon/></div><h1 className="text-2xl font-semibold">{title}</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">{description}</p><p className="mt-5 text-xs text-neutral-400">Раздел запланирован к реализации на следующем этапе.</p></CardContent></Card></div>;
}
function SettingsIcon(){return <ShieldCheck size={20}/>}
