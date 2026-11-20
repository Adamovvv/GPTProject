import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {createClient} from '@supabase/supabase-js';
import {CheckCircle2,Loader2,MailX} from 'lucide-react';
import {Card,CardContent} from '@/components/ui/card';
import {Button} from '@/components/ui/button';

const url=import.meta.env.VITE_SUPABASE_URL as string;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const emailClient=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'kyro-email-confirmation'}});

export function EmailConfirmPage(){
 const [state,setState]=useState<'loading'|'success'|'error'>('loading');
 const [message,setMessage]=useState('Проверяем ссылку подтверждения…');
 const navigate=useNavigate();
 useEffect(()=>{
  let active=true;
  void(async()=>{
   try{
    const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
    const accessToken=hash.get('access_token');
    const refreshToken=hash.get('refresh_token');
    if(!accessToken||!refreshToken)throw new Error('Ссылка подтверждения недействительна или уже использована. Запросите новое письмо в профиле.');
    const {data,error}=await emailClient.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
    if(error||!data.session)throw error||new Error('Не удалось подтвердить адрес');
    const {data:result,error:verifyError}=await emailClient.functions.invoke('kyro-email-verification',{body:{action:'verify'}});
    if(verifyError)throw verifyError;
    if(result?.error)throw new Error(result.error);
    if(!active)return;
    setState('success');setMessage('Email подтверждён. Теперь доступны публикации и подписки.');
   }catch(error){
    if(!active)return;
    setState('error');setMessage(error instanceof Error?error.message:'Не удалось подтвердить email');
   }
  })();
  return()=>{active=false};
 },[]);
 return <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-4"><Card className="w-full max-w-md"><CardContent className="p-7 text-center">{state==='loading'?<Loader2 className="mx-auto animate-spin text-neutral-400" size={28}/>:state==='success'?<CheckCircle2 className="mx-auto text-neutral-700" size={30}/>:<MailX className="mx-auto text-neutral-500" size={30}/>}<h1 className="mt-4 text-lg font-semibold">{state==='success'?'Почта подтверждена':state==='error'?'Не удалось подтвердить':'Подтверждение email'}</h1><p className="mt-2 text-sm text-neutral-500">{message}</p>{state!=='loading'&&<Button className="mt-5 w-full" onClick={()=>navigate(state==='success'?'/profile':'/profile')}>Перейти в профиль</Button>}</CardContent></Card></div>;
}
