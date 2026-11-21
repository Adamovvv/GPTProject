import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,MessageCircle} from 'lucide-react';
import {Card,CardContent} from '@/components/ui/card';
import {PostCard,type SharedPost,type PostAuthor} from '@/components/social/post-card';
import {supabase} from '@/lib/supabase';

export function PostDetailPage(){
 const {postId=''}=useParams();
 const [post,setPost]=useState<SharedPost|null>(null);
 const [loading,setLoading]=useState(true);
 const [notFound,setNotFound]=useState(false);
 const [userId,setUserId]=useState('');
 const [likeBusy,setLikeBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   if(!supabase||!postId){setNotFound(true);setLoading(false);return;}
   const {data:{user}}=await supabase.auth.getUser();
   if(!active)return;
   setUserId(user?.id||'');
   const {data,error}=await supabase.from('social_posts').select('id,user_id,content,created_at,author:profiles!social_posts_user_id_fkey(id,username,full_name,avatar_url,is_verified,is_private)').eq('id',postId).eq('moderation_status','visible').maybeSingle();
   if(!active)return;
   if(error||!data){setNotFound(true);setLoading(false);return;}
   const author=data.author as unknown as (PostAuthor&{is_private?:boolean});
   if(author?.is_private&&data.user_id!==user?.id){
    const {data:follow}=await supabase.from('social_follows').select('follower_id').eq('follower_id',user?.id||'').eq('following_id',data.user_id).maybeSingle();
    if(!active)return;
    if(!follow){setNotFound(true);setLoading(false);return;}
   }
   const [{data:likes},{data:mine}]=await Promise.all([
    supabase.from('social_likes').select('post_id').eq('post_id',postId),
    user?supabase.from('social_likes').select('post_id').eq('post_id',postId).eq('user_id',user.id):Promise.resolve({data:[]})
   ]);
   if(!active)return;
   setPost({id:data.id,user_id:data.user_id,content:data.content,created_at:data.created_at,author,likes:likes?.length||0,liked:Boolean(mine?.length)});
   setLoading(false);
  };
  void load();return()=>{active=false};
 },[postId]);
 const toggleLike=async(current:SharedPost)=>{
  if(!supabase||!userId||likeBusy)return;
  setLikeBusy(true);
  const liked=Boolean(current.liked);
  setPost({...current,liked:!liked,likes:Math.max(0,(current.likes||0)+(liked?-1:1))});
  const result=liked?await supabase.from('social_likes').delete().eq('post_id',postId).eq('user_id',userId):await supabase.from('social_likes').upsert({post_id:postId,user_id:userId},{onConflict:'post_id,user_id'});
  setLikeBusy(false);if(result.error)setPost(current);
 };
 return <main className="mx-auto w-full max-w-[760px] space-y-4 px-3 pb-24 pt-3 sm:px-5 sm:pt-6">
  <header className="space-y-3">
   <Link to="/social" className="inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"><ArrowLeft size={17}/>Лента</Link>
   <div className="flex items-end justify-between gap-4 border-b border-neutral-200 pb-4">
    <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-neutral-400">KYRO / SOCIAL</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">Публикация</h1><p className="mt-1 text-sm text-neutral-500">Пост и всё обсуждение — в одном месте</p></div>
    <div className="mb-1 hidden items-center gap-2 text-xs text-neutral-400 sm:flex"><MessageCircle size={16}/>Обсуждение</div>
   </div>
  </header>
  {loading?<Card className="overflow-hidden"><CardContent className="space-y-5 p-5 sm:p-7"><div className="flex items-center gap-3"><div className="h-11 w-11 animate-pulse rounded-full bg-neutral-100"/><div className="space-y-2"><div className="h-3 w-32 animate-pulse rounded bg-neutral-100"/><div className="h-2.5 w-20 animate-pulse rounded bg-neutral-100"/></div></div><div className="h-24 animate-pulse rounded-xl bg-neutral-100"/><div className="h-10 animate-pulse rounded-lg bg-neutral-100"/></CardContent></Card>
  :notFound||!post?<Card><CardContent className="py-16 text-center"><p className="font-semibold text-neutral-900">Публикация недоступна</p><p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">Возможно, автор удалил её или ограничил доступ.</p><Link to="/social" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-neutral-700 hover:underline"><ArrowLeft size={15}/>Вернуться в ленту</Link></CardContent></Card>
  :<PostCard post={post} onLike={toggleLike} commentsOpen/>}
 </main>;
}
