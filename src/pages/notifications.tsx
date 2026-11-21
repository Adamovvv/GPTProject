import {useEffect,useState} from 'react';
import {Bell,Check,Loader2,UserCheck,UserX} from 'lucide-react';
import {Card,CardContent} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {supabase} from '@/lib/supabase';
import {toast} from 'sonner';

type Notice={id:string;kind:string;title:string;body:string;target_url:string|null;read_at:string|null;created_at:string};
const requestId=(notice:Notice)=>{if(!notice.target_url)return null;try{return new URL(notice.target_url,'https://kyro.local').searchParams.get('request_id')}catch{return null}};
export function NotificationsPage(){
 const [rows,setRows]=useState<Notice[]>([]);
 const [loading,setLoading]=useState(true);
 const [actingId,setActingId]=useState('');
 const refreshBadges=()=>window.dispatchEvent(new Event('kyro:refresh-badges'));
 const load=async()=>{
  if(!supabase){setLoading(false);return;}
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setLoading(false);return;}
  const {data,error}=await supabase.from('kyro_notifications').select('id,kind,title,body,target_url,read_at,created_at').order('created_at',{ascending:false}).limit(100);
  if(error)toast.error('Не удалось загрузить уведомления');
  setRows((data||[]) as Notice[]);
  setLoading(false);
  const {error:readError}=await supabase.from('kyro_notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);
  if(readError)toast.error('Не удалось обновить статус уведомлений');
  else {
   setRows(current=>current.map(item=>item.read_at?item:{...item,read_at:new Date().toISOString()}));
   refreshBadges();
  }
 };
 useEffect(()=>{void load()},[]);
 const read=async(id:string)=>{
  if(!supabase)return;
  const now=new Date().toISOString();
  const {error}=await supabase.from('kyro_notifications').update({read_at:now}).eq('id',id);
  if(error){toast.error('Не удалось отметить уведомление');return;}
  setRows(v=>v.map(n=>n.id===id?{...n,read_at:now}:n));
  refreshBadges();
 };
 const respond=async(notice:Notice,accept:boolean)=>{
  if(!supabase)return;
  const id=requestId(notice);
  if(!id){toast.error('В уведомлении нет идентификатора запроса. Обновите страницу или отправьте новый запрос.');return;}
  setActingId(notice.id);
  const {error}=await supabase.rpc('kyro_respond_follow_request',{p_request_id:id,p_accept:accept});
  setActingId('');
  if(error){toast.error(error.message||'Не удалось обработать запрос');return;}
  const now=new Date().toISOString();
  setRows(current=>current.map(item=>item.id===notice.id?{...item,kind:'follow_request_handled',title:accept?'Запрос на подписку одобрен':'Запрос на подписку отклонён',body:accept?'Пользователь добавлен в ваши подписчики.':'Запрос отклонён.',read_at:now,target_url:null}:item));
  refreshBadges();
  toast.success(accept?'Подписка подтверждена':'Запрос отклонён');
 };
 const unread=rows.filter(n=>!n.read_at).length;
 return <div className="mx-auto max-w-3xl space-y-5">
  <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-neutral-400">KYRO / ACTIVITY</p><h1 className="mt-2 text-3xl font-semibold">Уведомления</h1><p className="mt-1 text-sm text-neutral-500">{unread} непрочитанных</p></div><Bell className="text-neutral-400" size={22}/></div>
  <Card><CardContent className="divide-y p-0">
   {loading?<div className="flex justify-center py-14"><Loader2 className="animate-spin text-neutral-400"/></div>:rows.length===0?<div className="py-14 text-center text-sm text-neutral-500">Пока нет уведомлений.</div>:rows.map(n=>{
    const followRequest=n.kind==='follow_request'&&Boolean(requestId(n));
    return <div key={n.id} className={'flex items-start gap-3 p-4 '+(!n.read_at?'bg-neutral-50':'')}>
     <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-neutral-400" style={{opacity:n.read_at?0:1}}/>
     <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{n.title}</p>{n.body&&<p className="mt-1 text-sm text-neutral-600">{n.body}</p>}
      {followRequest&&<div className="mt-3 flex flex-wrap gap-2">
       <Button size="sm" disabled={actingId===n.id} onClick={()=>void respond(n,true)}>{actingId===n.id?<Loader2 className="animate-spin" size={14}/>:<UserCheck size={14}/>}Одобрить</Button>
       <Button size="sm" variant="outline" disabled={actingId===n.id} onClick={()=>void respond(n,false)}><UserX size={14}/>Отклонить</Button>
      </div>}
      <p className="mt-2 text-xs text-neutral-400">{new Date(n.created_at).toLocaleString('ru-RU')}</p>
     </div>
     {!n.read_at&&<Button size="icon" variant="ghost" aria-label="Отметить прочитанным" onClick={()=>void read(n.id)}><Check size={16}/></Button>}
    </div>;
   })}
  </CardContent></Card>
 </div>;
}
