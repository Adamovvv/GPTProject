import { SocialFeed, type SocialPost } from "@/components/social/social-feed";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  const supabase = await createClient();
  if (!supabase) {
    return <SocialFeed initialPosts={[]} initialFollowing={[]} suggestions={[]} userId={null} currentProfile={null} loadError="Для работы KYRO Social добавьте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY в переменные окружения. Затем примените миграцию supabase/migrations/20261117120000_create_kyro_social.sql." />;
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  if (!userId) return <SocialFeed initialPosts={[]} initialFollowing={[]} suggestions={[]} userId={null} currentProfile={null} />;

  const { data: currentProfileData } = await supabase
    .from("profiles").select("id, username, full_name, avatar_url").eq("id", userId).maybeSingle();
  const currentProfile = currentProfileData ?? null;

  const { data: postRows, error: postsError } = await supabase
    .from("social_posts").select("id, user_id, content, created_at")
    .order("created_at", { ascending: false }).limit(40);

  if (postsError) {
    return <SocialFeed initialPosts={[]} initialFollowing={[]} suggestions={[]} userId={userId} currentProfile={currentProfile} loadError="Таблицы KYRO Social пока не найдены. Примените миграцию supabase/migrations/20261117120000_create_kyro_social.sql в Supabase SQL Editor." />;
  }

  const postIds = (postRows || []).map((post) => post.id);
  const profileIds = [...new Set([userId, ...(postRows || []).map((post) => post.user_id)])];
  const [profilesResult, likesResult, commentsResult, suggestionsResult, followsResult] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", profileIds),
    postIds.length ? supabase.from("social_likes").select("post_id, user_id").in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
    postIds.length ? supabase.from("social_comments").select("post_id").in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("profiles").select("id, username, full_name, avatar_url").neq("id", userId).limit(5),
    supabase.from("social_follows").select("following_id").eq("follower_id", userId),
  ]);

  const profileMap = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const likesMap = new Map<string, string[]>();
  for (const like of likesResult.data || []) likesMap.set(like.post_id, [...(likesMap.get(like.post_id) || []), like.user_id]);
  const commentsMap = new Map<string, number>();
  for (const comment of commentsResult.data || []) commentsMap.set(comment.post_id, (commentsMap.get(comment.post_id) || 0) + 1);

  const initialPosts: SocialPost[] = (postRows || []).map((post) => ({
    ...post,
    author: profileMap.get(post.user_id) || null,
    likes: likesMap.get(post.id) || [],
    comments_count: commentsMap.get(post.id) || 0,
  }));

  return (
    <SocialFeed
      initialPosts={initialPosts}
      initialFollowing={(followsResult.data || []).map((follow) => follow.following_id)}
      suggestions={suggestionsResult.data || []}
      userId={userId}
      currentProfile={currentProfile}
    />
  );
}
