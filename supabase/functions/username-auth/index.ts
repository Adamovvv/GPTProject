import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
async function hashBucket(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(digest)].map((b)=>b.toString(16).padStart(2,'0')).join('');}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const {action,username,password,email:requestedEmail}=await req.json();
  if(!['login','register'].includes(action)||typeof username!=='string'||typeof password!=='string')return json({error:'Некорректный запрос'},400);
  const normalized=username.trim().toLowerCase();
  if(!/^[a-z0-9_]{3,24}$/.test(normalized)||password.length<8||password.length>128)return json({error:'Проверьте username и пароль (не менее 8 символов)'},400);
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
  const buckets=await Promise.all([hashBucket('ip-user:'+ip+':'+normalized),hashBucket('username:'+normalized)]);
  const limits=await Promise.all(buckets.map((p_bucket_hash)=>admin.rpc('kyro_consume_auth_attempt',{p_bucket_hash,p_limit:8,p_window_seconds:900})));
  if(limits.some(({error})=>error))throw new Error('Rate limit check failed');
  if(limits.some(({data})=>data!==true))return json({error:'Слишком много попыток. Повторите позже.'},429);
  let email='';
  if(action==='register'){
   const signupEmail=typeof requestedEmail==='string'?requestedEmail.trim().toLowerCase():'';
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)||signupEmail.endsWith('.invalid'))return json({error:'Укажите действующий email для подтверждения аккаунта'},400);
   const {data:existing,error:lookupError}=await admin.from('profiles').select('id').ilike('username',normalized).maybeSingle();
   if(lookupError)throw lookupError;
   if(existing)return json({error:'Этот username уже занят'},409);
   const {data:created,error:createError}=await admin.auth.admin.createUser({email:signupEmail,password,email_confirm:false,user_metadata:{username:normalized}});
   if(createError)return json({error:createError.message.includes('already been registered')?'Этот email уже используется':'Не удалось создать аккаунт'},409);
   const {error:profileError}=await admin.from('profiles').upsert({id:created.user.id,username:normalized,full_name:normalized},{onConflict:'id'});
   if(profileError){await admin.auth.admin.deleteUser(created.user.id);throw profileError;}
   return json({verification_required:true});
  }
  const {data:profile,error:profileError}=await admin.from('profiles').select('id').ilike('username',normalized).maybeSingle();
  if(profileError)throw profileError;
  if(!profile)return json({error:'Неверный username или пароль'},401);
  const {data:userData,error:userError}=await admin.auth.admin.getUserById(profile.id);
  if(userError||!userData.user?.email)return json({error:'Неверный username или пароль'},401);
  if(!userData.user.email_confirmed_at)return json({error:'Подтвердите email по ссылке из письма, затем войдите снова.'},403);
  email=userData.user.email;
  const {data,error}=await auth.auth.signInWithPassword({email,password});
  if(error||!data.session)return json({error:'Неверный username или пароль'},401);
  return json({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
 }catch(error){console.error('username-auth failure',error);return json({error:'Не удалось выполнить запрос авторизации'},500);}
});
