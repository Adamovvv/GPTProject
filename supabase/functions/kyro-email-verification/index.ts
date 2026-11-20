import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254;

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const {action,email}=await req.json();
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const bearer=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';

  if(action==='send'||action==='get'){
   if(!bearer)return json({error:'Требуется авторизация'},401);
   const {data:{user},error:userError}=await auth.auth.getUser(bearer);
   if(userError||!user)return json({error:'Сессия недействительна'},401);
   if(action==='get'){
    const [{data:row},{data:profile}]=await Promise.all([
     admin.from('kyro_user_emails').select('email').eq('user_id',user.id).maybeSingle(),
     admin.from('profiles').select('email_verification_required,email_verified_at').eq('id',user.id).maybeSingle()
    ]);
    return json({email:row?.email||'',verified:Boolean(profile?.email_verified_at),required:Boolean(profile?.email_verification_required)});
   }
   if(typeof email!=='string'||!validEmail(email.trim()))return json({error:'Укажите корректный email'},400);
   const normalized=email.trim().toLowerCase();
   const {data:existing}=await admin.from('kyro_user_emails').select('user_id').eq('email',normalized).maybeSingle();
   if(existing&&existing.user_id!==user.id)return json({error:'Этот email уже привязан к другому аккаунту KYRO'},409);
   const {data:current}=await admin.from('kyro_user_emails').select('last_sent_at,daily_window_started_at,daily_send_count').eq('user_id',user.id).maybeSingle();
   const now=Date.now();
   if(current?.last_sent_at&&now-new Date(current.last_sent_at).getTime()<60000)return json({error:'Подождите минуту перед повторной отправкой письма'},429);
   const sameDay=Boolean(current?.daily_window_started_at&&now-new Date(current.daily_window_started_at).getTime()<86400000);
   const count=sameDay?(current?.daily_send_count||0):0;
   if(count>=5)return json({error:'Достигнут лимит: не более 5 писем подтверждения за сутки'},429);
   const {error:saveError}=await admin.from('kyro_user_emails').upsert({
    user_id:user.id,email:normalized,last_sent_at:new Date(now).toISOString(),
    daily_window_started_at:sameDay?current?.daily_window_started_at:new Date(now).toISOString(),
    daily_send_count:count+1,updated_at:new Date(now).toISOString()
   },{onConflict:'user_id'});
   if(saveError)throw saveError;
   const {error:profileError}=await admin.from('profiles').update({email_verification_required:true,email_verified_at:null}).eq('id',user.id);
   if(profileError)throw profileError;
   const site=(Deno.env.get('KYRO_SITE_URL')||'https://gptproject-gamma.vercel.app').replace(/\/$/,'');
   const {error:sendError}=await auth.auth.signInWithOtp({
    email:normalized,
    options:{shouldCreateUser:true,emailRedirectTo:site+'/email/confirm'}
   });
   if(sendError){console.error('email OTP send failed',sendError);return json({error:'Не удалось отправить письмо. Проверьте настройки SMTP в Supabase и попробуйте снова.'},503);}
   return json({sent:true,email:normalized});
  }

  if(action==='verify'){
   if(!bearer)return json({error:'Не найден токен подтверждения'},401);
   const {data:{user},error:userError}=await auth.auth.getUser(bearer);
   if(userError||!user?.email)return json({error:'Ссылка подтверждения недействительна или устарела'},401);
   if(!user.email_confirmed_at)return json({error:'Сначала подтвердите email по ссылке из письма'},403);
   const {data:link,error:linkError}=await admin.from('kyro_user_emails').select('user_id').eq('email',user.email.toLowerCase()).maybeSingle();
   if(linkError)throw linkError;
   if(!link)return json({error:'Для этого адреса не найден ожидающий запрос подтверждения KYRO'},404);
   const {error:updateError}=await admin.from('profiles').update({email_verified_at:new Date().toISOString(),email_verification_required:true}).eq('id',link.user_id);
   if(updateError)throw updateError;
   return json({verified:true});
  }
  return json({error:'Неизвестное действие'},400);
 }catch(error){console.error('kyro-email-verification failure',error);return json({error:'Не удалось выполнить операцию с email'},500);}
});
