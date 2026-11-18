import {useCallback,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {Compass,Loader2,UserPlus,Users,Sparkles} from 'lucide-react';
import {Card,CardContent} from '@/components/ui/card';
import {supabase} from '@/lib/supabase';
import {toast} from 'sonner';
import {PostCard,PostComposer,type SharedPost,type PostAuthor} from '@/components/social/post-card';

type Profile=PostAuthor&{id:string;bio?:string};
type FeedTab='for-you'|'following'|'all';

export function SocialPage(){
 const [userId,setUserId]=useState('');
 const [posts,setPosts]=useState<SharedPost[]>([]);
 const [people,setPeople]=useState<Profile[]>([]);
 const [following,setFollowing]=useState<string[]>([]);
 const [tab,setTab]=useState<FeedTab>('for-you');
 const [content,setContent]=useState('');
 const [loading,setLoading]=useState(true);
 const [publishing,setPublishing]=useState(false);
 const [myInterests,setMyInterests]=useState<string[]>([]);
 const [peopleInterests,setPeopleInterests]=useState<Record<string,string[]>>({});

 const load=useCallback(async()=>{
  if(!supabase)return;
  setLoading(true);
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setLoading(false);return;}
  setUserId(user.id);
  const [{data:follows,error:followError},{data:profiles},{data:raw,error:postError},{data:ownTags,error:ownError}]=await Promise.all([
   supabase.from('social_follows').select('following_id').eq('follower_id',user.id),
   supabase.from('profiles').select('id,username,full_name,avatar_url,bio').neq('id',user.id).order('created_at',{ascending:false}).limit(24),
   supabase.from('social_posts').select('id,user_id,content,created_at,author:profiles!social_posts_user_id_fkey(id,username,full_name,avatar_url)').eq('moderation_status','visible').order('created_at',{ascending:false}).limit(100),
   supabase.from('kyro_interests').select('interest').eq('user_id',user.id)
  ]);
  if(followError||postError||ownError){toast.error('Не удалось загрузить ленту');setLoading(false);return;}
  const ids=(follows||[]).map(x=>x.following_id);
  setFollowing(ids);
  setPeople((profiles||[]) as Profile[]);
  const own=(ownTags||[]).map(x=>x.interest);
  setMyInterests(own);
  const rows=(raw||[]) as unknown as Array<{id:string;user_id:string;content:string;created_at:string;author:Profile}>;
  const authorIds=[...new Set([...rows.map(p=>p.user_id),...(profiles||[]).map(p=>p.id)])];
  const {data:allTags,error:tagsError}=authorIds.length?await supabase.from('kyro_interests').select('user_id,interest').in('user_id',authorIds):{data:[],error:null};
  if(tagsError)toast.error('Не удалось загрузить интересы авторов');
  const grouped:Record<string,string[]>={};
  (allTags||[]).forEach(x=>{(grouped[x.user_id]??=[]).push(x.interest)});
  setPeopleInterests(grouped);
  const postIds=rows.map(p=>p.id);
  const [{data:likes},{data:mine}]=postIds.length?await Promise.all([
   supabase.from('social_likes').select('post_id').in('post_id',postIds),
   supabase.from('social_likes').select('post_id').eq('user_id',user.id).in('post_id',postIds)
  ]):[{data:[]},{data:[]}];
  const mineSet=new Set((mine||[]).map(x=>x.post_id));
  const counts=new Map<string,number>();
  (likes||[]).forEach(x=>counts.set(x.post_id,(counts.get(x.post_id)||0)+1));
  setPosts(rows.map(p=>({...p,author:p.author,likes:counts.get(p.id)||0,liked:mineSet.has(p.id)})));
  setLoading(false);
 },[]);

 useEffect(()=>{void load()},[load]);

 const forYouPosts=useMemo(()=>{
  const now=Date.now();
  const scored=posts.map(post=>{
   const tags=peopleInterests[post.user_id||'']||[];
   const matched=tags.filter(tag=>myInterests.includes(tag)).length;
   const ageHours=Math.max(0,(now-new Date(post.created_at).getTime())/3600000);
   const freshness=Math.exp(-ageHours/72);
   const followed=following.includes(post.user_id||'');
   const engagement=Math.log1p(post.likes||0);
   const score=matched*8+(followed?2.5:0)+freshness*4+engagement*0.8;
   return {post,score,matched};
  }).sort((a,b)=>b.score-a.score);
  const authorCounts=new Map<string,number>();
  const selected:SharedPost[]=[];
  for(const item of scored){
   const author=item.post.user_id||item.post.author.id||item.post.id;
   const count=authorCounts.get(author)||0;
   if(count>=3)continue;
   authorCounts.set(author,count+1);
   selected.push(item.post);
  }
  return selected;
 },[posts,peopleInterests,myInterests,following]);

 const visiblePosts=useMemo(()=>{
  if(tab==='following')return posts.filter(p=>following.includes(p.user_id||'')||p.user_id===userId);
  if(tab==='all')return posts;
  return forYouPosts;
 },[tab,posts,following,userId,forYouPosts]);

 const publish=async()=>{
  const text=content.trim();
  if(!supabase||!userId||!text||publishing)return;
  setPublishing(true);
  const {error}=await supabase.from('social_posts').insert({user_id:userId,content:text});
  setPublishing(false);
  if(error){toast.error('Не удалось опубликовать пост');return;}
  setContent('');toast.success('Публикация добавлена');await load();
 };
 const toggleFollow=async(id:string)=>{
  if(!supabase||!userId||id===userId)return;
  const active=following.includes(id);
  const {error}=active?await supabase.from('social_follows').delete().eq('follower_id',userId).eq('following_id',id):await supabase.from('social_follows').insert({follower_id:userId,following_id:id});
  if(error){toast.error('Не удалось изменить подписку');return;}
  setFollowing(v=>active?v.filter(x=>x!==id):[...v,id]);
 };
 const toggleLike=async(post:SharedPost)=>{
  if(!supabase||!userId)return;
  const {error}=post.liked?await supabase.from('social_likes').delete().eq('post_id',post.id).eq('user_id',userId):await supabase.from('social_likes').insert({post_id:post.id,user_id:userId});
  if(error){toast.error('Не удалось обновить отметку');return;}
  setPosts(v=>v.map(p=>p.id===post.id?{...p,liked:!p.liked,likes:(p.likes||0)+(p.liked?-1:1)}:p));
 };
 const suggestions=useMemo(()=>people.filter(p=>!following.includes(p.id)).sort((a,b)=>(peopleInterests[b.id]||[]).filter(x=>myInterests.includes(x)).length-(peopleInterests[a.id]||[]).filter(x=>myInterests.includes(x)).length),[people,following,peopleInterests,myInterests]);


 return <div className="mx-auto max-w-6xl">
  <div className="mb-7"><p className="text-xs font-semibold uppercase tracking-[.18em] text-neutral-400">KYRO / COMMUNITY</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Лента</h1><p className="mt-2 text-sm text-neutral-500">Публикации, подобранные под ваши интересы и подписки.</p></div>
  <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
   <section className="min-w-0 space-y-5">
    <PostComposer value={content} onChange={setContent} onSubmit={()=>void publish()} publishing={publishing}/>
    <Card><CardContent className="p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Рекомендации пользователей</h2><Users size={17} className="text-neutral-400"/></div>{suggestions.length===0?<p className="text-sm text-neutral-500">Пока нет подходящих профилей. Рекомендации появятся по мере активности сообщества.</p>:<div className="grid gap-3 sm:grid-cols-2">{suggestions.slice(0,6).map(p=><div key={p.id} className="flex min-w-0 items-center gap-3"><Link to={p.username?'/u/'+p.username:'/profile'} className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-xs font-semibold">{p.avatar_url?<img src={p.avatar_url} alt="" className="h-full w-full object-cover"/>:(p.full_name||p.username||'KY').slice(0,2).toUpperCase()}</Link><div className="min-w-0 flex-1"><Link to={p.username?'/u/'+p.username:'/profile'} className="block truncate text-sm font-medium hover:underline">{p.full_name||p.username||'Пользователь'}</Link><p className="truncate text-xs text-neutral-400">{(peopleInterests[p.id]||[]).filter(x=>myInterests.includes(x)).length>0?'Есть общие интересы':p.username?'@'+p.username:'Участник KYRO'}</p></div><button onClick={()=>void toggleFollow(p.id)} aria-label="Подписаться" className="rounded-full border p-2 hover:bg-neutral-100"><UserPlus size={15}/></button></div>)}</div>}</CardContent></Card>
    <div className="flex flex-wrap items-center gap-2">
     <button onClick={()=>setTab('for-you')} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${tab==='for-you'?'bg-neutral-900 text-white':'border bg-white text-neutral-500'}`}><Sparkles size={15}/>Для вас</button>
     <button onClick={()=>setTab('following')} className={`rounded-full px-4 py-2 text-sm ${tab==='following'?'bg-neutral-900 text-white':'border bg-white text-neutral-500'}`}>Подписки</button>
     <button onClick={()=>setTab('all')} className={`rounded-full px-4 py-2 text-sm ${tab==='all'?'bg-neutral-900 text-white':'border bg-white text-neutral-500'}`}>Все</button>
    </div>
    {loading?<div className="flex justify-center py-16 text-neutral-400"><Loader2 className="animate-spin"/></div>:visiblePosts.length===0?<Card><CardContent className="py-14 text-center"><Compass className="mx-auto text-neutral-300" size={28}/><p className="mt-3 font-medium">{tab==='following'?'Нет публикаций от подписок':'Пока нет публикаций для ленты'}</p><p className="mt-1 text-sm text-neutral-500">{tab==='following'?'Подпишитесь на интересных авторов.':'Добавьте интересы или опубликуйте первую запись.'}</p></CardContent></Card>:<div className="space-y-3">{visiblePosts.map(post=><PostCard key={post.id} post={post} onLike={toggleLike}/>)}</div>}
   </section>
   <aside className="space-y-5">

   </aside>
  </div>
 </div>;
}
