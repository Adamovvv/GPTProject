import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {isSupabaseConfigured,supabase} from '@/lib/supabase';
import {toast} from 'sonner';

const schema=z.object({
 username:z.string().min(3,'Минимум 3 символа').max(24).regex(/^[a-zA-Z0-9_]+$/,'Латиница, цифры и _'),
 password:z.string().min(8,'Минимум 8 символов'),
 email:z.string().email('Введите корректный email').or(z.literal('')).optional()
});
type Values=z.infer<typeof schema>;

export function AuthPage(){
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [busy,setBusy]=useState(false);
 const nav=useNavigate();
 const {register,handleSubmit,formState:{errors}}=useForm<Values>({resolver:zodResolver(schema)});
 const submit=async(v:Values)=>{
  if(!supabase){toast.error('Supabase не настроен');return}
  if(mode==='register'&&!v.email?.trim()){toast.error('Для подтверждения аккаунта укажите email');return}
  setBusy(true);
  try{
   const {data,error}=await supabase.functions.invoke('username-auth',{body:{action:mode,username:v.username,password:v.password,email:v.email?.trim().toLowerCase()}});
   if(error)throw error;
   if(data?.error)throw new Error(data.error);
   if(data?.verification_required){toast.success('Письмо отправлено. Подтвердите email, затем войдите по username и паролю.');setMode('login');return;}
   if(!data?.access_token||!data?.refresh_token)throw new Error('Auth endpoint вернул некорректную сессию');
   const {error:sessionError}=await supabase.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
   if(sessionError)throw sessionError;
   toast.success('С возвращением');
   nav('/');
  }catch(e){toast.error(e instanceof Error?e.message:'Не удалось выполнить вход')}
  finally{setBusy(false)}
 };
 return <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-4 py-10"><div className="w-full max-w-[420px]">
  <div className="mb-6 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950 text-lg font-bold text-white">K</div><p className="text-xl font-semibold tracking-[.18em]">KYRO</p><p className="mt-1 text-xs text-neutral-400">Everything. Connected.</p></div>
  <Card><CardHeader><CardTitle>{mode==='login'?'Вход в KYRO':'Создать аккаунт'}</CardTitle><CardDescription>{mode==='login'?'Войдите по username и паролю.':'Для подтверждения аккаунта понадобится email.'}</CardDescription></CardHeader><CardContent>
   <form onSubmit={handleSubmit(submit)} className="space-y-4">
    <div><label className="mb-1.5 block text-sm font-medium">Username</label><Input autoComplete="username" placeholder="your_username" {...register('username')}/>{errors.username&&<p className="mt-1 text-xs text-red-600">{errors.username.message}</p>}</div>
    {mode==='register'&&<div><label className="mb-1.5 block text-sm font-medium">Email</label><Input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" {...register('email')}/>{errors.email&&<p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}</div>}
    <div><label className="mb-1.5 block text-sm font-medium">Пароль</label><Input type="password" autoComplete={mode==='login'?'current-password':'new-password'} placeholder="Не менее 8 символов" {...register('password')}/>{errors.password&&<p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}</div>
    <Button className="w-full" disabled={busy||!isSupabaseConfigured}>{busy&&<Loader2 className="animate-spin" size={16}/>} {mode==='login'?'Войти':'Зарегистрироваться'}</Button>
   </form>
   <p className="mt-5 text-center text-sm text-neutral-500">{mode==='login'?'Нет аккаунта?':'Уже есть аккаунт?'} <button className="font-medium text-neutral-900 underline" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Регистрация':'Войти'}</button></p>
   {!isSupabaseConfigured&&<p className="mt-4 text-xs text-neutral-400">Требуются переменные Supabase и Edge Function username-auth.</p>}
  </CardContent></Card>
  <p className="mt-5 text-center text-xs text-neutral-400">Продолжая, вы соглашаетесь с <button onClick={()=>nav('/privacy')} className="underline">политикой конфиденциальности</button>.</p>
 </div></div>
}