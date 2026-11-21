import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,Loader2} from 'lucide-react';
import {Card,CardContent} from '@/components/ui/card';
import {PostCard,type SharedPost,type PostAuthor} from '@/components/social/post-card';
import {supabase} from '@/lib/supabase';

export function PostDetailPage(){
 const {postId=''}=useParams();const [post,setPost]=useState<SharedPost|null>(null);const [loading,setLoading]=useState(true);const [notFound,setNotFound]=useState(false);const [userId,setUserId]=useState('');
 useEffect(()=>{let active=true;const load=async()=>{
  if(!supabase||!postId){setLoading(false);setNotFound(true);return;}
  const {data:{user}}=await supabase.auth.getUser();if(active)setUserId(user?.id||'');
  const {data,error}=await supabase.from('social_posts').select('id,user_id,content,created_at,author:profiles!social_posts_user_id_fkey(id,username,full_name,avatar_url,is_verified,is_private)').eq('id',postId).eq('moderation_status','visible').maybeSingle();
  if(!active)return;
  if(error||!data){setNotFound(true);setLoading(false);return;}
  const author=data.author as unknown as (PostAuthor&{is_private?:boolean});
  if(author?.is_private&&data.user_id!==user?.id){
   const {data:follow}=await supabase.from('social_follows').select('follower_id').eq('follower_id',user?.id||'').eq('following_id',data.user_id).maybeSingle();
   if(!follow){setNotFound(true);setLoading(false);return;}
  }
  const [{data:likes},{data:mine}]=await Promise.all([
   supabase.from('social_likes').select('post_id').eq('post_id',postId),
   user?supabase.from('social_likes').select('post_id').eq('post_id',postId).eq('user_id',user.id):Promise.resolve({data:[]})
  ]);
  if(!active)return;
  setPost({id:data.id,user_id:data.user_id,content:data.content,created_at:data.created_at,author,likes:likes?.length||0,liked:Boolean(mine?.length)});
  setLoading(false);
 };void load();return()=>{active=false};},[postId]);
 const toggleLike=async(current:SharedPost)=>{if(!supabase||!userId)return;const liked=Boolean(current.liked);setPost({...current,liked:!liked,likes:Math.max(0,(current.likes||0)+(liked?-1:1))});const result=liked?await supabase.from('social_likes').delete().eq('post_id',postId).eq('user_id',userId):await supabase.from('social_likes').upsert({post_id:postId,user_id:userId},{onConflict:'post_id,user_id'});if(result.error){setPost(current);}};
 return <div className="mx-auto max-w-3xl space-y-4"><Link to="/social" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900"><ArrowLeft size={16}/>Назад к ленте</Link>{loading?<div className="flex justify-center py-16 text-neutral-400"><Loader2 className="animate-spin"/></div>:notFound||!post?<Card><CardContent className="py-14 text-center"><p className="font-medium">Публикация не найдена</p><p className="mt-1 text-sm text-neutral-500">Возможно, она удалена или доступ к ней ограничен.</p></CardContent></Card>:<PostCard post={post} onLike={toggleLike} commentsOpen/>}</div>;
}
