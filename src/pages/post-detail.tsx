import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,Heart,Loader2,MessageCircle} from 'lucide-react';
import {Card,CardContent} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {PostComments,type SharedPost,type PostAuthor} from '@/components/social/post-card';
import {VerifiedBadge} from '@/components/social/verified-badge';
import {supabase} from '@/lib/supabase';
import {toast} from 'sonner';

type DetailAuthor=PostAuthor&{is_private?:boolean};
const dateLabel=(value:string)=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
export function PostDetailPage(){
 const {postId=''}=useParams();const [post,setPost]=useState<SharedPost|null>(null);const [loading,setLoading]=useState(true);const [notFound,setNotFound]=useState(false);const [userId,setUserId]=useState('');const [savingLike,setSavingLike]=useState(false);
 useEffect(()=>{let active=true;const load=async()=>{
  if(!supabase||!postId){setLoading(false);setNotFound(true);return;}
  const {data:{user}}=await supabase.auth.getUser();if(active)setUserId(user?.id||'');
  const {data,error}=await supabase.from('social_posts').select('id,user_id,content,created_at,author:profiles!social_posts_user_id_fkey(id,username,full_name,avatar_url,is_verified,is_private)').eq('id',postId).eq('moderation_status','visible').maybeSingle();
  if(!active)return;if(error||!data){setNotFound(true);setLoading(false);return;}
  const author=data.author as unknown as DetailAuthor;
  if(author?.is_private&&data.user_id!==user?.id){const {data:follow}=await supabase.from('social_follows').select('follower_id').eq('follower_id',user?.id||'').eq('following_id',data.user_id).maybeSingle();if(!follow){setNotFound(true);setLoading(false);return;}}
  const [{data:likes},{data:mine}]=await Promise.all([supabase.from('social_likes').select('post_id').eq('post_id',postId),user?supabase.from('social_likes').select('post_id').eq('post_id',postId).eq('user_id',user.id):Promise.resolve({data:[]})]);
  if(!active)return;setPost({id:data.id,user_id:data.user_id,content:data.content,created_at:data.created_at,author,likes:likes?.length||0,liked:Boolean(mine?.length)});setLoading(false);
 };void load();return()=>{active=false};},[postId]);
 const toggleLike=async()=>{if(!supabase||!userId||!post||savingLike)return;setSavingLike(true);const current=post;const liked=Boolean(current.liked);setPost({...current,liked:!liked,likes:Math.max(0,(current.likes||0)+(liked?-1:1))});const result=liked?await supabase.from('social_likes').delete().eq('post_id',postId).eq('user_id',userId):await supabase.from('social_likes').upsert({post_id:postId,user_id:userId},{onConflict:'post_id,user_id'});setSavingLike(false);if(result.error){setPost(current);toast.error('Не удалось изменить отметку «Нравится»');}};
 const author=post?.author;const authorHref=author?.username?'/u/'+author.username:'/profile';
 return <div className="mx-auto max-w-2xl space-y-4 pb-4">
  <div className="flex items-center justify-between"><Link to="/social" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-neutral-600 transition hover:bg-white hover:text-neutral-950"><ArrowLeft size={17}/>Лента</Link><span className="text-xs font-medium uppercase tracking-[.16em] text-neutral-400">KYRO / POST</span></div>
  {loading?<Card><CardContent className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-neutral-400"/></CardContent></Card>:notFound||!post||!author?<Card><CardContent className="py-16 text-center"><p className="font-semibold">Публикация не найдена</p><p className="mt-2 text-sm text-neutral-500">Возможно, она удалена или доступ к ней ограничен.</p><Button asChild variant="outline" className="mt-5"><Link to="/social">Вернуться в ленту</Link></Button></CardContent></Card>:<>
   <Card className="overflow-hidden border-neutral-200 shadow-sm"><CardContent className="p-5 sm:p-7">
    <div className="flex items-center gap-3"><Link to={authorHref} className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600">{author.avatar_url?<img src={author.avatar_url} alt="" className="h-full w-full object-cover"/>:(author.full_name||author.username||'KY').slice(0,2).toUpperCase()}</Link><div className="min-w-0 flex-1"><Link to={authorHref} className="inline-flex max-w-full items-center gap-1.5 text-sm font-semibold hover:underline"><span className="truncate">{author.full_name||author.username||'Пользователь KYRO'}</span>{author.is_verified&&<VerifiedBadge size={14}/>}</Link><p className="mt-0.5 text-xs text-neutral-400">{author.username?'@'+author.username+' · ':''}{dateLabel(post.created_at)}</p></div></div>
    <p className="mt-6 whitespace-pre-wrap break-words text-[15px] leading-7 text-neutral-800 sm:text-base sm:leading-8">{post.content}</p>
    <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4"><Button type="button" variant="ghost" disabled={!userId||savingLike} aria-pressed={Boolean(post.liked)} onClick={()=>void toggleLike()} className={'h-10 gap-2 px-3 '+(post.liked?'text-rose-600':'text-neutral-500')}><Heart size={18} fill={post.liked?'currentColor':'none'}/><span className="tabular-nums">{post.likes||0}</span><span className="text-xs">Нравится</span></Button><span className="inline-flex items-center gap-2 text-sm text-neutral-400"><MessageCircle size={17}/>Обсуждение</span></div>
   </CardContent></Card>
   <Card className="overflow-hidden border-neutral-200 shadow-sm"><CardContent className="p-5 sm:p-7"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Обсуждение</h2><p className="mt-1 text-xs text-neutral-400">Ответы собраны в одной ветке, без вложенных уровней</p></div><MessageCircle size={20} className="text-neutral-400"/></div><PostComments postId={post.id} openByDefault/></CardContent></Card>
  </>}
 </div>;
}
