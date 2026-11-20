import {useQuery} from '@tanstack/react-query';
import {ArrowUpRight,CalendarDays,Clock,MapPin,ShoppingBag,Users} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Button} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {APP_SLOGAN} from '@/config/app';
import {isSupabaseConfigured,supabase} from '@/lib/supabase';

type DashboardEvent={id:string;title:string;location:string;starts_at:string|null};
async function load(){
 if(!supabase)return {profile:null,events:[] as DashboardEvent[]};
 const [{data:{user}},{data:events}]=await Promise.all([
  supabase.auth.getUser(),
  supabase.from('kyro_events').select('id,title,location,starts_at').eq('status','published').eq('moderation_status','visible').gte('starts_at',new Date().toISOString()).order('starts_at',{ascending:true}).limit(3)
 ]);
 let profile=null;
 if(user){const r=await supabase.from('profiles').select('username,full_name').eq('id',user.id).maybeSingle();profile=r.data;}
 return {profile,events:(events||[]) as DashboardEvent[]};
}
export function DashboardPage(){
 const {data}=useQuery({queryKey:['dashboard'],queryFn:load});
 const name=(data?.profile as any)?.full_name||(data?.profile as any)?.username||'Добро пожаловать';
 return <div className="mx-auto max-w-6xl space-y-8">
  <section className="relative overflow-hidden rounded-3xl border bg-white p-6 sm:p-9"><div className="max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-neutral-400">{APP_SLOGAN}</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Добро пожаловать, {name}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-neutral-500">Ваше пространство для людей, идей и событий. KYRO помогает оставаться на связи и находить то, что действительно интересно.</p><div className="mt-6 flex flex-wrap gap-2"><Button asChild><Link to="/social">Создать публикацию</Link></Button><Button asChild variant="outline"><Link to="/search">Найти людей</Link></Button></div></div><div className="pointer-events-none absolute -right-12 -top-16 hidden h-64 w-64 rounded-full border-[36px] border-neutral-100 sm:block"/><div className="pointer-events-none absolute -right-2 bottom-[-80px] hidden h-48 w-48 rounded-full border-[28px] border-neutral-100 sm:block"/></section>
  <section><div className="mb-4"><h2 className="font-semibold">Быстрый доступ</h2><p className="mt-1 text-xs text-neutral-500">Основные разделы KYRO в одном месте.</p></div><div className="grid grid-cols-2 gap-3"><Link to="/market"><Card className="transition hover:border-neutral-400"><CardContent className="p-4"><ShoppingBag size={20} className="text-neutral-400"/><p className="mt-3 text-sm font-semibold">Маркет</p><p className="mt-1 text-xs text-neutral-500">Товары и объявления</p></CardContent></Card></Link><Link to="/communities"><Card className="transition hover:border-neutral-400"><CardContent className="p-4"><Users size={20} className="text-neutral-400"/><p className="mt-3 text-sm font-semibold">Сообщества</p><p className="mt-1 text-xs text-neutral-500">Люди и интересы</p></CardContent></Card></Link></div></section>
  <section><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="font-semibold">Ближайшие события</h2><p className="mt-1 text-xs text-neutral-500">Что интересного скоро произойдёт.</p></div><Link to="/events" className="flex items-center gap-1 text-xs text-neutral-500">Все события <ArrowUpRight size={14}/></Link></div><div className="grid gap-3 sm:grid-cols-3">{data?.events.length?data.events.map(event=><Link key={event.id} to="/events"><Card className="h-full transition hover:border-neutral-400"><CardContent className="p-4"><CalendarDays size={18} className="text-neutral-400"/><p className="mt-3 line-clamp-2 text-sm font-semibold">{event.title}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">{event.starts_at&&<span className="flex items-center gap-1"><Clock size={13}/>{new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(event.starts_at))}</span>}{event.location&&<span className="flex items-center gap-1"><MapPin size={13}/>{event.location}</span>}</div></CardContent></Card></Link>):<Card className="sm:col-span-3"><CardContent className="p-7 text-center"><CalendarDays className="mx-auto mb-3 text-neutral-300"/><p className="text-sm font-medium">Пока нет предстоящих событий</p><p className="mt-1 text-xs text-neutral-400">Создайте событие или загляните позже.</p><Button asChild variant="outline" className="mt-3"><Link to="/events">Открыть события</Link></Button></CardContent></Card>}</div></section>
  {!isSupabaseConfigured&&<Card className="border-dashed"><CardContent className="py-5 text-sm text-neutral-500">Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env.local, чтобы подключить данные.</CardContent></Card>}
 </div>;
}
