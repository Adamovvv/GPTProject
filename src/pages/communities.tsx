import {useCallback,useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {Users,Plus,ArrowLeft,Loader2,MessageSquare,Send} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {supabase} from '@/lib/supabase';
import {toast} from 'sonner';

type Community={id:string;name:string;slug:string;description:string;category:string;owner_id:string;created_at:string};
type CommunityPost={id:string;content:string;created_at:string;user_id:string};
const slugify=(value:string)=>{const map:Record<string,string>={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};return value.toLowerCase().replace(/[а-яё]/g,ch=>map[ch]??ch).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)};
export function CommunitiesPage(){
 const {slug}=useParams();
 const [items,setItems]=useState<Community[]>([]);const [members,setMembers]=useState<string[]>([]);const [posts,setPosts]=useState<CommunityPost[]>([]);
 const [loading,setLoading]=useState(true);const [me,setMe]=useState('');const [emailAllowed,setEmailAllowed]=useState(false);
 const [showForm,setShowForm]=useState(false);const [saving,setSaving]=useState(false);const [form,setForm]=useState({name:'',slug:'',description:'',category:'Общее'});const [message,setMessage]=useState('');
 const load=useCallback(async()=>{
  if(!supabase){setLoading(false);return;}setLoading(true);
  const {data:{user}}=await supabase.auth.getUser();if(user){setMe(user.id);const {data:p}=await supabase.from('profiles').select('email_verification_required,email_verified_at').eq('id',user.id).maybeSingle();setEmailAllowed(Boolean(p?.email_verified_at));}
  const {data,error}=await supabase.from('kyro_communities').select('id,name,slug,description,category,owner_id,created_at').order('created_at',{ascending:false}).limit(100);
  if(error)toast.error('Не удалось загрузить сообщества');const rows=(data||[]) as Community[];setItems(rows);
  if(user){const [{data:m}]=await Promise.all([supabase.from('kyro_community_members').select('community_id').eq('user_id',user.id)]);setMembers((m||[]).map(x=>x.community_id));}
  if(slug){const current=rows.find(x=>x.slug===slug);if(current){const {data:p}=await supabase.from('kyro_community_posts').select('id,content,created_at,user_id').eq('community_id',current.id).eq('moderation_status','visible').order('created_at',{ascending:false}).limit(50);setPosts((p||[]) as CommunityPost[]);}}
  setLoading(false);
 },[slug]);
 useEffect(()=>{void load()},[load]);
 const create=async()=>{if(!supabase||!me)return;if(!emailAllowed){toast.error('Подтвердите email в настройках, чтобы создавать сообщества');return;}
  const cleanSlug=slugify(form.slug);
  if(form.name.trim().length<3||cleanSlug.length<3){toast.error('Укажите название и адрес сообщества (минимум 3 символа)');return;}
  setSaving(true);const {error}=await supabase.from('kyro_communities').insert({owner_id:me,name:form.name.trim(),slug:cleanSlug,description:form.description.trim(),category:form.category});
  setSaving(false);if(error){toast.error(error.message.includes('duplicate')?'Этот адрес уже занят':error.message||'Не удалось создать сообщество');return;}
  toast.success('Сообщество создано');setShowForm(false);setForm({name:'',slug:'',description:'',category:'Общее'});await load();
 };
 const join=async(item:Community)=>{if(!supabase||!me||item.owner_id===me)return;if(!emailAllowed){toast.error('Подтвердите email в настройках, чтобы вступать в сообщества');return;}const isMember=members.includes(item.id);
  const {error}=isMember?await supabase.from('kyro_community_members').delete().eq('community_id',item.id).eq('user_id',me):await supabase.from('kyro_community_members').insert({community_id:item.id,user_id:me,role:'member'});
  if(error){toast.error('Не удалось изменить участие');return;}setMembers(v=>isMember?v.filter(x=>x!==item.id):[...v,item.id]);toast.success(isMember?'Вы покинули сообщество':'Вы вступили в сообщество');
 };
 const publish=async()=>{if(!supabase||!me||!slug||!message.trim())return;const current=items.find(x=>x.slug===slug);if(!current)return;const {error}=await supabase.from('kyro_community_posts').insert({community_id:current.id,user_id:me,content:message.trim()});if(error){toast.error(error.message||'Не удалось опубликовать сообщение');return;}setMessage('');await load();};
 const current=items.find(x=>x.slug===slug);
 if(loading)return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-neutral-400"/></div>;
 if(slug&&current)return <div className="mx-auto max-w-3xl space-y-5"><Link to="/communities" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900"><ArrowLeft size={16}/>Все сообщества</Link><Card><CardContent className="p-6"><p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">{current.category}</p><h1 className="mt-2 text-2xl font-semibold">{current.name}</h1><p className="mt-2 text-sm leading-6 text-neutral-500">{current.description||'Сообщество KYRO'}</p><div className="mt-4 flex items-center gap-2 text-xs text-neutral-400"><Users size={15}/>Сообщество KYRO</div><Button className="mt-4" disabled={current.owner_id===me} variant={members.includes(current.id)?'outline':'default'} onClick={()=>void join(current)}>{current.owner_id===me?'Вы создатель':members.includes(current.id)?'Покинуть сообщество':'Вступить'}</Button></CardContent></Card>
 {members.includes(current.id)&&<Card><CardContent className="p-4"><textarea value={message} onChange={e=>setMessage(e.target.value.slice(0,2000))} placeholder="Поделитесь новостью с участниками…" rows={3} className="w-full resize-none rounded-lg border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-neutral-200"/><div className="mt-2 flex justify-end"><Button onClick={()=>void publish()} disabled={!message.trim()}><Send size={15}/>Опубликовать</Button></div></CardContent></Card>}
 <div className="space-y-3">{posts.length?posts.map(post=><Card key={post.id}><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-neutral-400"><MessageSquare size={14}/>{new Date(post.created_at).toLocaleString('ru-RU')}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{post.content}</p></CardContent></Card>):<Card><CardContent className="py-10 text-center text-sm text-neutral-500">Пока нет обсуждений. Вступите и начните первым.</CardContent></Card>}</div></div>;
 return <div className="mx-auto max-w-5xl space-y-6"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-neutral-400">KYRO / COMMUNITY</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Сообщества</h1><p className="mt-2 text-sm text-neutral-500">Находите единомышленников, вступайте в группы и обсуждайте интересные темы.</p></div><Button onClick={()=>setShowForm(v=>!v)}><Plus size={16}/>Создать сообщество</Button></header>
 {showForm&&<Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2"><Input placeholder="Название сообщества" value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value,slug:v.slug||slugify(e.target.value)}))}/><Input placeholder="Адрес: design-club" value={form.slug} onChange={e=>setForm(v=>({...v,slug:e.target.value}))}/><Input placeholder="Категория" value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}/><textarea placeholder="Описание сообщества" value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value.slice(0,1000)}))} rows={3} className="rounded-lg border p-3 text-sm outline-none focus:ring-2 focus:ring-neutral-200 sm:col-span-2"/><div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-neutral-400">Нужен подтверждённый email. До 3 сообществ за 24 часа.</p><div className="flex gap-2"><Button variant="outline" onClick={()=>setShowForm(false)}>Отмена</Button><Button onClick={()=>void create()} disabled={saving}>{saving?<Loader2 className="animate-spin" size={15}/>:null}Создать</Button></div></div></CardContent></Card>}
 {items.length?<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(item=><Card key={item.id} className="h-full"><CardContent className="flex h-full flex-col p-5"><p className="text-xs font-medium text-neutral-400">{item.category}</p><h2 className="mt-2 text-lg font-semibold">{item.name}</h2><p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-neutral-500">{item.description||'Присоединяйтесь к обсуждению.'}</p><div className="mt-4 flex gap-2"><Button asChild variant="outline" className="flex-1"><Link to={'/communities/'+item.slug}>Открыть</Link></Button><Button disabled={item.owner_id===me} variant={members.includes(item.id)?'outline':'default'} onClick={()=>void join(item)}>{item.owner_id===me?'Создатель':members.includes(item.id)?'Вы участник':'Вступить'}</Button></div></CardContent></Card>)}</div>:<Card><CardContent className="py-12 text-center"><Users className="mx-auto text-neutral-300" size={30}/><p className="mt-3 font-medium">Пока нет сообществ</p><p className="mt-1 text-sm text-neutral-500">Создайте первое сообщество KYRO.</p></CardContent></Card>}
 </div>;
}
