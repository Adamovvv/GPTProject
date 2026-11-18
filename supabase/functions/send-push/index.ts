import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const authorization=req.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return json({error:'Unauthorized'},401);
  const url=Deno.env.get('SUPABASE_URL')!;
  const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await authClient.auth.getUser();
  if(userError||!user)return json({error:'Unauthorized'},401);
  const {notificationId}=await req.json();
  if(typeof notificationId!=='string')return json({error:'notificationId required'},400);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:notice,error:noticeError}=await admin.from('kyro_notifications').select('id,user_id,title,body,target_url').eq('id',notificationId).eq('user_id',user.id).maybeSingle();
  if(noticeError)throw noticeError;
  if(!notice)return json({error:'Notification not found'},404);
  const {data:claimed,error:claimError}=await admin.rpc('kyro_claim_push_delivery',{p_notification_id:notice.id});
  if(claimError)throw claimError;
  if(claimed!==true)return json({sent:0,deduplicated:true});
  const candidate=webpush.generateVAPIDKeys();
  const {data:keyRows,error:keyError}=await admin.rpc('kyro_ensure_vapid_keys',{p_public:candidate.publicKey,p_private:candidate.privateKey});
  if(keyError)throw keyError;
  const keys=Array.isArray(keyRows)?keyRows[0]:keyRows;
  if(!keys?.public_key||!keys?.private_key)throw new Error('VAPID keys unavailable');
  webpush.setVapidDetails('https://gptproject-gamma.vercel.app',keys.public_key,keys.private_key);
  const {data:subscriptions,error:subscriptionsError}=await admin.from('kyro_push_subscriptions').select('id,endpoint,p256dh,auth_secret').eq('user_id',user.id);
  if(subscriptionsError)throw subscriptionsError;
  const payload=JSON.stringify({title:notice.title,body:notice.body,url:notice.target_url||'/notifications',tag:'kyro-'+notice.id});
  let sent=0;
  await Promise.all((subscriptions||[]).map(async subscription=>{
   try{
    await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth_secret}},payload,{TTL:3600});
    sent++;
   }catch(error){
    const status=(error as {statusCode?:number}).statusCode;
    if(status===404||status===410)await admin.from('kyro_push_subscriptions').delete().eq('id',subscription.id);
    else console.error('KYRO push delivery failed',status);
   }
  }));
  return json({sent});
 }catch(error){console.error('send-push failure',error);return json({error:'Push delivery failed'},500);}
});
