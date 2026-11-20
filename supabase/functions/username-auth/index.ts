import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
async function hashBucket(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(digest)].map((b)=>b.toString(16).padStart(2,'0')).join('');}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const {action,username,password,email:contactEmail}=await req.json();
  if(!['login','register'].includes(action)||typeof username!=='string'||typeof password!=='string'||(action==='register'&&contactEmail!==undefined&&contactEmail!==''&&(typeof contactEmail!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()))))return json({error:'Некорректный запрос'},400);
  const normalized=username.trim().toLowerCase();
  if(!/^[a-z0-9_]{3,24}$/.test(normalized)||password.length<8||password.length>128)return json({error:'Проверьте username и пароль (не менее 8 символов)'},400);
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
  const buckets=await Promise.all([hashBucket('ip-user:'+ip+':'+normalized),hashBucket('username:'+normalized)]);
  if(action==='register'){
   const registrationBuckets=await Promise.all([
    hashBucket('register-ip-hour:'+ip),
    hashBucket('register-ip-day:'+ip)
   ]);
   const registrationLimits=await Promise.all([
    admin.rpc('kyro_consume_auth_attempt',{p_bucket_hash:registrationBuckets[0],p_limit:4,p_window_seconds:3600}),
    admin.rpc('kyro_consume_auth_attempt',{p_bucket_hash:registrationBuckets[1],p_limit:12,p_window_seconds:86400})
   ]);
   if(registrationLimits.some(({error})=>error))throw new Error('Registration rate limit check failed');
   if(registrationLimits.some(({data})=>data!==true))return json({error:'Слишком много регистраций с этого подключения. Попробуйте позже.'},429);
  }
  const limits=await Promise.all(buckets.map((p_bucket_hash)=>admin.rpc('kyro_consume_auth_attempt',{p_bucket_hash,p_limit:8,p_window_seconds:900})));
  if(limits.some(({error})=>error))throw new Error('Rate limit check failed');
  if(limits.some(({data})=>data!==true))return json({error:'Слишком много попыток. Повторите позже.'},429);
  let email=normalized+'@auth.kyro.invalid';
  let verificationSent=false;
  if(action==='register'){
   const {data:existing,error:lookupError}=await admin.from('profiles').select('id').ilike('username',normalized).maybeSingle();
   if(lookupError)throw lookupError;
   if(existing)return json({error:'Этот username уже занят'},409);
   if(typeof contactEmail==='string'&&contactEmail.trim()){
    const {data:emailOwner,error:emailLookupError}=await admin.from('kyro_user_emails').select('user_id').eq('email',contactEmail.trim().toLowerCase()).maybeSingle();
    if(emailLookupError)throw emailLookupError;
    if(emailOwner)return json({error:'Этот email уже привязан к другому аккаунту KYRO'},409);
   }
   const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username:normalized}});
   if(createError)return json({error:createError.message.includes('already been registered')?'Этот username уже занят':'Не удалось создать аккаунт'},409);
   const {error:profileError}=await admin.from('profiles').upsert({id:created.user.id,username:normalized,full_name:normalized,email_verification_required:true,email_verified_at:null},{onConflict:'id'});
   if(profileError){await admin.auth.admin.deleteUser(created.user.id);throw profileError;}
   if(typeof contactEmail==='string'&&contactEmail.trim()){
    const normalizedEmail=contactEmail.trim().toLowerCase();
    const {error:emailSaveError}=await admin.from('kyro_user_emails').insert({user_id:created.user.id,email:normalizedEmail,last_sent_at:new Date().toISOString(),daily_window_started_at:new Date().toISOString(),daily_send_count:1});
    if(emailSaveError)throw emailSaveError;
    const emailAuth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const site=(Deno.env.get('KYRO_SITE_URL')||'https://gptproject-gamma.vercel.app').replace(/\/$/,'');
    const {error:emailSendError}=await emailAuth.auth.signInWithOtp({email:normalizedEmail,options:{shouldCreateUser:true,emailRedirectTo:site+'/email/confirm'}});
    if(emailSendError)console.error('Registration verification email could not be sent',emailSendError);else verificationSent=true;
   }
  }else{
   const {data:profile,error:profileError}=await admin.from('profiles').select('id').ilike('username',normalized).maybeSingle();
   if(profileError)throw profileError;
   if(!profile)return json({error:'Неверный username или пароль'},401);
   const {data:suspension}=await admin.from('kyro_user_suspensions').select('expires_at').eq('user_id',profile.id).maybeSingle();
   if(suspension&&(!suspension.expires_at||new Date(suspension.expires_at).getTime()>Date.now()))return json({error:'Аккаунт временно или навсегда заблокирован. Обратитесь в поддержку KYRO.'},403);
   const {data:userData,error:userError}=await admin.auth.admin.getUserById(profile.id);
   if(userError||!userData.user?.email)return json({error:'Неверный username или пароль'},401);
   email=userData.user.email;
  }
  const {data,error}=await auth.auth.signInWithPassword({email,password});
  if(error||!data.session)return json({error:'Неверный username или пароль'},401);
  return json({access_token:data.session.access_token,refresh_token:data.session.refresh_token,email_verification_required:action==='register',email_verification_sent:verificationSent});
 }catch(error){console.error('username-auth failure',error);return json({error:'Не удалось выполнить запрос авторизации'},500);}
});
