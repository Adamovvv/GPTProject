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
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const candidate=webpush.generateVAPIDKeys();
  const {data:keyRows,error:keyError}=await admin.rpc('kyro_ensure_vapid_keys',{p_public:candidate.publicKey,p_private:candidate.privateKey});
  if(keyError)throw keyError;
  const keys=Array.isArray(keyRows)?keyRows[0]:keyRows;
  if(!keys?.public_key)throw new Error('VAPID public key unavailable');
  return json({publicKey:keys.public_key});
 }catch(error){console.error('push-config failure',error);return json({error:'Push configuration unavailable'},500);}
});
