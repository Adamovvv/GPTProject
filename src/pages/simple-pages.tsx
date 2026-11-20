import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Check,CheckCircle2,Loader2,LogOut,ShieldCheck} from 'lucide-react';
import {Card,CardContent} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {APP_VERSION} from '@/config/app';
import {supabase} from '@/lib/supabase';
import {toast} from 'sonner';

export function SettingsPage(){
 const navigate=useNavigate();
 const [userId,setUserId]=useState('');
 const [verified,setVerified]=useState(false);
 const [verificationStatus,setVerificationStatus]=useState<string|null>(null);
 const [verificationNote,setVerificationNote]=useState('');
 const [loading,setLoading]=useState(true);
 const [savingVerification,setSavingVerification]=useState(false);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   if(!supabase){setLoading(false);return;}
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){setLoading(false);return;}
   setUserId(user.id);
   const [{data:profile},{data:request}]=await Promise.all([
    supabase.from('profiles').select('is_verified').eq('id',user.id).maybeSingle(),
    supabase.from('kyro_verification_requests').select('status,note').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle()
   ]);
   if(active){setVerified(Boolean(profile?.is_verified));setVerificationStatus(request?.status||null);setVerificationNote(request?.note||'');setLoading(false);}

  })();
  return()=>{active=false};
 },[]);
 const requestVerification=async()=>{
  if(!supabase||!userId)return;
  setSavingVerification(true);
  const {error}=await supabase.from('kyro_verification_requests').insert({user_id:userId,note:verificationNote.trim()});
  setSavingVerification(false);
  if(error){toast.error(error.code==='23505'?'Заявка уже находится на проверке':error.message||'Не удалось отправить заявку');return;}
  setVerificationStatus('pending');toast.success('Заявка на подтверждение отправлена');
 };
 if(loading)return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-neutral-400"/></div>;
 return <div className="mx-auto max-w-3xl space-y-5">
  <div><h1 className="text-3xl font-semibold">Настройки</h1><p className="mt-2 text-sm text-neutral-500">Управление аккаунтом.</p></div>
  <Card><CardContent className="space-y-4 p-5">
   <div className="flex items-center gap-3"><ShieldCheck size={19}/><div><h2 className="font-semibold">Подтверждение аккаунта</h2><p className="text-xs text-neutral-500">После проверки появится значок подтверждённого профиля.</p></div><div className="ml-auto">{verified?<Check className="text-neutral-700" size={21}/>:null}</div></div>
   {verified?<p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16}/>Ваш аккаунт подтверждён.</p>:verificationStatus==='pending'?<p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">Заявка отправлена и ожидает проверки администрацией.</p>:<><Input value={verificationNote} onChange={e=>setVerificationNote(e.target.value.slice(0,500))} placeholder="Кратко расскажите, почему аккаунт стоит подтвердить (необязательно)"/><Button onClick={()=>void requestVerification()} disabled={savingVerification}>{savingVerification?<Loader2 className="animate-spin" size={15}/>:null}Запросить подтверждение</Button>{verificationStatus==='rejected'&&<p className="text-xs text-neutral-400">Предыдущая заявка отклонена. Вы можете отправить новую.</p>}</>}
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
