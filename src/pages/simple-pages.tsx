import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Check,Bell,CheckCircle2,Loader2,LogOut,ShieldCheck,Smartphone} from 'lucide-react';
import {Card,CardContent} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {APP_VERSION} from '@/config/app';
import {supabase,emailVerificationClient} from '@/lib/supabase';
import {toast} from 'sonner';

function decodeVapidKey(value:string){
 const padding='='.repeat((4-value.length%4)%4);
 const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
 const raw=window.atob(base64);
 return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)));
}

export function SettingsPage(){
 const navigate=useNavigate();
 const [userId,setUserId]=useState('');
 const [verified,setVerified]=useState(false);
 const [verificationStatus,setVerificationStatus]=useState<string|null>(null);
 const [verificationNote,setVerificationNote]=useState('');
 const [loading,setLoading]=useState(true);
 const [savingVerification,setSavingVerification]=useState(false);
 const [pushBusy,setPushBusy]=useState(false);
 const [pushEnabled,setPushEnabled]=useState(false);
 const [contactEmail,setContactEmail]=useState('');
 const [emailVerified,setEmailVerified]=useState(false);
 const [emailSending,setEmailSending]=useState(false);\n const [emailCode,setEmailCode]=useState('');\n const [codeSent,setCodeSent]=useState(false);\n const [emailVerifying,setEmailVerifying]=useState(false);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   if(!supabase){setLoading(false);return;}
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){setLoading(false);return;}
   setUserId(user.id);
   const [{data:profile},{data:request}]=await Promise.all([
    supabase.from('profiles').select('is_verified,email_verification_required,email_verified_at').eq('id',user.id).maybeSingle(),
    supabase.from('kyro_verification_requests').select('status,note').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle()
   ]);
   if(active){setVerified(Boolean(profile?.is_verified));setEmailVerified(Boolean(profile?.email_verified_at));setVerificationStatus(request?.status||null);setVerificationNote(request?.note||'');setLoading(false);}
   const {data:emailInfo}=await supabase.functions.invoke('kyro-email-verification',{body:{action:'get'}});if(active)setContactEmail(emailInfo?.email||'');setCodeSent(false);
   if('serviceWorker' in navigator&&'PushManager' in window){
    const registration=await navigator.serviceWorker.ready;
    const subscription=await registration.pushManager.getSubscription();
    if(active)setPushEnabled(Boolean(subscription));
   }
  })();
  return()=>{active=false};
 },[]);
 const requestEmailVerification=async()=>{
  if(!supabase||!contactEmail.trim())return;setEmailSending(true);const {data,error}=await supabase.functions.invoke('kyro-email-verification',{body:{action:'send',email:contactEmail.trim()}});setEmailSending(false);if(error||data?.error){toast.error(data?.error||'Не удалось отправить код');return;}setEmailVerified(false);setCodeSent(true);setEmailCode('');toast.success('Шестизначный код отправлен на email.');
 };
 const confirmEmailCode=async()=>{
  if(!emailVerificationClient||!contactEmail.trim()||emailCode.length!==6)return;setEmailVerifying(true);
  const {data,error}=await emailVerificationClient.auth.verifyOtp({email:contactEmail.trim().toLowerCase(),token:emailCode,type:'email'});
  if(error||!data.user){setEmailVerifying(false);toast.error(error?.message||'Неверный или просроченный код');return;}
  const {data:result,error:verifyError}=await emailVerificationClient.functions.invoke('kyro-email-verification',{body:{action:'verify'}});
  setEmailVerifying(false);if(verifyError||result?.error){toast.error(result?.error||verifyError?.message||'Не удалось подтвердить email');return;}
  setEmailVerified(true);setCodeSent(false);setEmailCode('');toast.success('Email подтверждён. Все возможности аккаунта разблокированы.');
 };
 const requestVerification=async()=>{
  if(!supabase||!userId)return;
  setSavingVerification(true);
  const {error}=await supabase.from('kyro_verification_requests').insert({user_id:userId,note:verificationNote.trim()});
  setSavingVerification(false);
  if(error){toast.error(error.code==='23505'?'Заявка уже находится на проверке':error.message||'Не удалось отправить заявку');return;}
  setVerificationStatus('pending');toast.success('Заявка на подтверждение отправлена');
 };
 const enablePush=async()=>{
  if(!supabase)return;
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){toast.error('Этот браузер не поддерживает push-уведомления');return;}
  setPushBusy(true);
  try{
   const {data:config,error:configError}=await supabase.functions.invoke('push-config');
   if(configError||!config?.publicKey)throw new Error('Не удалось получить настройки Web Push');
   const publicKey=String(config.publicKey);
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw new Error('Разрешение на уведомления не предоставлено');
   const registration=await navigator.serviceWorker.ready;
   const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(publicKey)});
   const json=subscription.toJSON();
   if(!json.endpoint||!json.keys?.p256dh||!json.keys?.auth)throw new Error('Браузер вернул неполную push-подписку');
   const {data:{user}}=await supabase.auth.getUser();
   if(!user)throw new Error('Сессия завершена');
   const {error}=await supabase.from('kyro_push_subscriptions').upsert({user_id:user.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth_secret:json.keys.auth,last_seen_at:new Date().toISOString()},{onConflict:'endpoint'});
   if(error)throw error;
   setPushEnabled(true);toast.success('Push-подписка сохранена');
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
   setPushEnabled(false);toast.success('Push-подписка отключена');
  }catch(error){toast.error(error instanceof Error?error.message:'Не удалось отключить уведомления')}
  finally{setPushBusy(false)}
 };
 if(loading)return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-neutral-400"/></div>;
 return <div className="mx-auto max-w-3xl space-y-5">
  <div><h1 className="text-3xl font-semibold">Настройки</h1><p className="mt-2 text-sm text-neutral-500">Управление аккаунтом и уведомлениями.</p></div>
  <Card><CardContent className="space-y-4 p-5">
   <div className="flex items-center gap-3"><ShieldCheck size={19}/><div><h2 className="font-semibold">Подтверждение email</h2><p className="text-xs text-neutral-500">Подтверждение необходимо для публикаций, подписок, сообществ и маркета.</p></div><div className="ml-auto text-xs text-neutral-500">{emailVerified?'Подтверждён':'Не подтверждён'}</div></div>
   <div className="flex flex-col gap-2 sm:flex-row"><Input type="email" value={contactEmail} onChange={e=>{setContactEmail(e.target.value);setCodeSent(false);setEmailCode('');}} placeholder="you@example.com"/><Button onClick={()=>void requestEmailVerification()} disabled={emailSending||!contactEmail.trim()}>{emailSending?<Loader2 className="animate-spin" size={15}/>:null}{emailVerified?'Изменить email':'Отправить код'}</Button></div>
   {codeSent&&!emailVerified&&<div className="flex flex-col gap-2 sm:flex-row"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={emailCode} onChange={e=>setEmailCode(e.target.value.replace(/\\D/g,'').slice(0,6))} placeholder="Введите 6-значный код"/><Button variant="outline" onClick={()=>void confirmEmailCode()} disabled={emailVerifying||emailCode.length!==6}>{emailVerifying?<Loader2 className="animate-spin" size={15}/>:null}Подтвердить код</Button></div>}
   <p className="text-xs text-neutral-400">Код придёт на указанный адрес. Если email указан неверно, исправьте его и запросите новый код.</p>
  </CardContent></Card>
  <Card><CardContent className="space-y-4 p-5">
   <div className="flex items-center gap-3"><ShieldCheck size={19}/><div><h2 className="font-semibold">Подтверждение аккаунта</h2><p className="text-xs text-neutral-500">После проверки появится значок подтверждённого профиля.</p></div><div className="ml-auto">{verified?<Check className="text-neutral-700" size={21}/>:null}</div></div>
   {verified?<p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16}/>Ваш аккаунт подтверждён.</p>:verificationStatus==='pending'?<p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">Заявка отправлена и ожидает проверки администрацией.</p>:<><Input value={verificationNote} onChange={e=>setVerificationNote(e.target.value.slice(0,500))} placeholder="Кратко расскажите, почему аккаунт стоит подтвердить (необязательно)"/><Button onClick={()=>void requestVerification()} disabled={savingVerification}>{savingVerification?<Loader2 className="animate-spin" size={15}/>:null}Запросить подтверждение</Button>{verificationStatus==='rejected'&&<p className="text-xs text-neutral-400">Предыдущая заявка отклонена. Вы можете отправить новую.</p>}</>}
  </CardContent></Card>
  
  <Card><CardContent className="space-y-4 p-5">
   <div className="flex items-center gap-3"><Bell size={19}/><div><h2 className="font-semibold">Push-уведомления</h2><p className="text-xs text-neutral-500">Уведомления о новых действиях в KYRO.</p></div><div className="ml-auto text-xs text-neutral-400">{pushEnabled?'Включены':'Выключены'}</div></div>
   <div className="flex flex-wrap gap-2">{pushEnabled?<Button variant="outline" onClick={()=>void disablePush()} disabled={pushBusy}>{pushBusy?<Loader2 className="animate-spin" size={15}/>:null}Отключить</Button>:<Button onClick={()=>void enablePush()} disabled={pushBusy}>{pushBusy?<Loader2 className="animate-spin" size={15}/>:<Smartphone size={15}/>}Включить push</Button>}</div>
   <p className="text-xs leading-5 text-neutral-400">Браузерная подписка хранится отдельно для каждого аккаунта. Ключи шифруются и хранятся в Supabase Vault; отдельные секреты в Vercel не нужны.</p>
  </CardContent></Card>
  <Card><CardContent className="divide-y p-0">
   <Link to="/privacy" className="flex items-center gap-3 p-5 hover:bg-neutral-50"><ShieldCheck size={19}/><span className="text-sm font-medium">Конфиденциальность</span></Link>
   <button onClick={async()=>{if(!supabase)return;const {error}=await supabase.auth.signOut({scope:'local'});if(error){toast.error('Не удалось выйти из аккаунта');return;}navigate('/login',{replace:true});}} className="flex w-full items-center gap-3 p-5 text-left text-sm font-medium text-red-600 hover:bg-neutral-50"><LogOut size={19}/>Выйти из аккаунта</button>
   <div className="flex items-center justify-between p-5"><span className="text-sm font-medium">Версия платформы</span><span className="text-sm text-neutral-500">KYRO v{APP_VERSION}</span></div>
  </CardContent></Card>
 </div>;
}

export function PlaceholderPage({title,description}:{title:string;description:string}){
 return <div className="mx-auto max-w-2xl py-10"><Card><CardContent className="p-8 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100"><ShieldCheck size={20}/></div><h1 className="text-2xl font-semibold">{title}</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">{description}</p><p className="mt-5 text-xs text-neutral-400">Раздел запланирован к реализации на следующем этапе.</p></CardContent></Card></div>;
}
