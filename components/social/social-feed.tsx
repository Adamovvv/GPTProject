"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Bookmark, Check, ChevronDown, Compass, Heart, House, Image as ImageIcon,
  MessageCircle, MoreHorizontal, Plus, Search, Send, Users, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Person = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };
export type SocialPost = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: Person | null;
  likes: string[];
  comments_count: number;
};
type Comment = { id: string; content: string; created_at: string; user_id: string; author: Person | null };
type Suggestion = Person;

function timeAgo(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн. назад`;
}

export function SocialFeed({
  initialPosts,
  initialFollowing,
  suggestions,
  userId,
  currentProfile,
  loadError,
}: {
  initialPosts: SocialPost[];
  initialFollowing: string[];
  suggestions: Suggestion[];
  userId: string | null;
  currentProfile: Person | null;
  loadError?: string | null;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeComments, setActiveComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [following, setFollowing] = useState<string[]>(initialFollowing);
  const [notice, setNotice] = useState<string | null>(null);

  const visiblePosts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("ru");
    if (!q) return posts;
    return posts.filter((post) =>
      post.content.toLocaleLowerCase("ru").includes(q) ||
      (post.author?.full_name || "").toLocaleLowerCase("ru").includes(q) ||
      (post.author?.username || "").toLocaleLowerCase("ru").includes(q)
    );
  }, [posts, search]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = content.trim();
    if (!text || busy) return;
    if (!userId) { router.push("/login"); return; }
    setBusy(true);
    setNotice(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("social_posts")
      .insert({ user_id: userId, content: text })
      .select("id, user_id, content, created_at")
      .single();
    if (error || !data) {
      setNotice(error?.message || "Не удалось опубликовать запись. Проверьте настройки Social в Supabase.");
      setBusy(false);
      return;
    }
    setPosts((current) => [{
      ...data,
      author: currentProfile,
      likes: [],
      comments_count: 0,
    }, ...current]);
    setContent("");
    setBusy(false);
  }

  async function toggleLike(post: SocialPost) {
    if (!userId) { router.push("/login"); return; }
    const liked = post.likes.includes(userId);
    const supabase = createClient();
    const result = liked
      ? await supabase.from("social_likes").delete().eq("post_id", post.id).eq("user_id", userId)
      : await supabase.from("social_likes").insert({ post_id: post.id, user_id: userId });
    if (result.error) { setNotice("Не удалось изменить отметку. Проверьте миграцию KYRO Social."); return; }
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, likes: liked ? item.likes.filter((id) => id !== userId) : [...item.likes, userId] }
      : item));
  }

  async function toggleComments(postId: string) {
    if (activeComments === postId) { setActiveComments(null); return; }
    setActiveComments(postId);
    if (comments[postId]) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("social_comments")
      .select("id, content, created_at, user_id")
      .eq("post_id", postId).order("created_at", { ascending: true });
    if (error || !data) { setNotice("Не удалось загрузить комментарии."); return; }
    const ids = [...new Set(data.map((item) => item.user_id))];
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", ids)
      : { data: [] as Person[] };
    const byId = new Map((people || []).map((person) => [person.id, person]));
    setComments((current) => ({
      ...current,
      [postId]: data.map((item) => ({ ...item, author: byId.get(item.user_id) || null })),
    }));
  }

  async function addComment(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    if (!userId) { router.push("/login"); return; }
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("social_comments")
      .insert({ post_id: postId, user_id: userId, content: text })
      .select("id, content, created_at, user_id").single();
    if (error || !data) { setNotice("Не удалось отправить комментарий."); return; }
    setComments((current) => ({
      ...current,
      [postId]: [...(current[postId] || []), { ...data, author: currentProfile }],
    }));
    setPosts((current) => current.map((post) => post.id === postId
      ? { ...post, comments_count: post.comments_count + 1 } : post));
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
  }

  async function toggleFollow(personId: string) {
    if (!userId) { router.push("/login"); return; }
    const isFollowing = following.includes(personId);
    const supabase = createClient();
    const result = isFollowing
      ? await supabase.from("social_follows").delete().eq("follower_id", userId).eq("following_id", personId)
      : await supabase.from("social_follows").insert({ follower_id: userId, following_id: personId });
    if (result.error) { setNotice("Не удалось обновить подписки."); return; }
    setFollowing((current) => isFollowing ? current.filter((id) => id !== personId) : [...current, personId]);
  }

  const displayName = currentProfile?.full_name || currentProfile?.username || "Ваш профиль";

  return (
    <main className="min-h-screen bg-[#f7f7f8] text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1320px] items-center gap-5 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-neutral-200 text-sm font-semibold tracking-tight">K</span>
            <span className="hidden sm:block"><span className="block text-sm font-semibold tracking-[.16em]">KYRO</span><span className="block text-[9px] text-neutral-400">EVERYTHING. CONNECTED.</span></span>
          </Link>
          <div className="relative mx-auto hidden w-full max-w-[470px] sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск публикаций и людей" className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-4 text-sm outline-none transition focus:border-neutral-400 focus:bg-white" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Уведомления"><Bell className="h-[18px] w-[18px]" /></Button>
            <Link href="/profile" className="flex items-center gap-2 rounded-full p-1 hover:bg-neutral-100">
              <Avatar src={currentProfile?.avatar_url} name={displayName} className="h-8 w-8" />
              <span className="hidden max-w-[120px] truncate text-xs font-medium sm:block">{displayName}</span>
            </Link>
          </div>
        </div>
        <div className="px-4 pb-3 sm:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск публикаций и людей" className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-4 text-sm outline-none" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-6 px-4 pb-28 pt-6 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)_270px] lg:px-8 lg:pt-8">
        <aside className="hidden lg:block">
          <div className="sticky top-[92px] space-y-2">
            <p className="mb-4 px-3 text-[10px] font-semibold tracking-[.16em] text-neutral-400">ВАШЕ ПРОСТРАНСТВО</p>
            <Link href="/social" className="flex items-center gap-3 rounded-xl bg-neutral-200/70 px-3 py-3 text-sm font-semibold"><Compass className="h-[18px] w-[18px]" />Лента</Link>
            <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-neutral-600 hover:bg-neutral-100"><Users className="h-[18px] w-[18px]" />Мой профиль</Link>
            <button onClick={() => setNotice("Раздел закладок появится в следующем обновлении.")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-neutral-600 hover:bg-neutral-100"><Bookmark className="h-[18px] w-[18px]" />Сохранённое</button>
            <div className="mt-8 border-t border-neutral-200 pt-5">
              <p className="px-3 text-[10px] font-semibold tracking-[.16em] text-neutral-400">KYRO</p>
              <Link href="/" className="mt-3 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-neutral-600 hover:bg-neutral-100">Главная платформа <ChevronDown className="ml-auto h-4 w-4 -rotate-90" /></Link>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div><p className="text-[10px] font-semibold tracking-[.18em] text-neutral-400">KYRO / SOCIAL</p><h1 className="mt-2 text-[27px] font-semibold tracking-tight sm:text-[30px]">Лента</h1><p className="mt-1 text-sm text-neutral-500">Общение и идеи в одном пространстве</p></div>
            <Button onClick={() => document.getElementById("post-composer")?.focus()} variant="outline" size="sm" className="shrink-0 gap-2"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Новая запись</span><span className="sm:hidden">Создать</span></Button>
          </div>

          {notice && <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-600"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Закрыть"><X className="h-4 w-4" /></button></div>}
          {loadError && <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs leading-5 text-neutral-600">{loadError}</div>}

          <form onSubmit={publish} className="mb-5 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
            <div className="flex gap-3">
              <Avatar src={currentProfile?.avatar_url} name={displayName} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="mb-3 text-sm font-medium">{userId ? "Поделитесь тем, что у вас нового" : "Войдите, чтобы публиковать записи"}</p>
                <Textarea id="post-composer" value={content} onChange={(e) => setContent(e.target.value)} maxLength={3000} disabled={!userId || busy} placeholder="О чём вы хотите рассказать?" className="min-h-[92px] border-0 bg-neutral-50 px-3 py-3 focus-visible:ring-1 focus-visible:ring-neutral-300" />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 text-xs text-neutral-400"><ImageIcon className="h-4 w-4" /><span>Фото и видео — скоро</span></div>
                  {userId ? <Button type="submit" size="sm" disabled={!content.trim() || busy}>{busy ? "Публикуем..." : "Опубликовать"}<Send className="ml-2 h-3.5 w-3.5" /></Button> : <Button type="button" size="sm" onClick={() => router.push("/login")}>Войти в KYRO</Button>}
                </div>
              </div>
            </div>
          </form>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Последние публикации</h2>
            <span className="text-xs text-neutral-400">{visiblePosts.length} записей</span>
          </div>
          <div className="space-y-4">
            {visiblePosts.map((post) => {
              const authorName = post.author?.full_name || post.author?.username || "Пользователь KYRO";
              const liked = !!userId && post.likes.includes(userId);
              return (
                <article key={post.id} className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <Avatar src={post.author?.avatar_url} name={authorName} />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">{post.author?.id === userId ? <Link href="/profile" className="truncate text-sm font-semibold hover:underline">{authorName}</Link> : <span className="truncate text-sm font-semibold">{authorName}</span>}{post.author?.username && <span className="text-xs text-neutral-400">@{post.author.username}</span>}</div>
                      <p className="mt-1 text-[11px] text-neutral-400">{timeAgo(post.created_at)}</p>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Дополнительные действия"><MoreHorizontal className="h-5 w-5" /></Button>
                  </div>
                  <p className="whitespace-pre-wrap break-words py-4 text-[14px] leading-7 text-neutral-700">{post.content}</p>
                  <div className="flex items-center gap-5 border-t border-neutral-100 pt-3">
                    <button onClick={() => toggleLike(post)} className={`inline-flex items-center gap-2 text-xs transition ${liked ? "font-semibold text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}`}><Heart className={`h-[17px] w-[17px] ${liked ? "fill-neutral-900" : ""}`} />{post.likes.length || "Нравится"}</button>
                    <button onClick={() => toggleComments(post.id)} className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-900"><MessageCircle className="h-[17px] w-[17px]" />{post.comments_count || "Комментировать"}</button>
                    <button onClick={() => setNotice("Поделиться публикацией можно будет в следующем обновлении.")} className="ml-auto inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-900"><Send className="h-4 w-4" /><span className="hidden sm:inline">Поделиться</span></button>
                  </div>
                  {activeComments === post.id && <div className="mt-4 border-t border-neutral-100 pt-4">
                    <div className="space-y-3">
                      {(comments[post.id] || []).map((comment) => <div key={comment.id} className="flex gap-2.5"><Avatar src={comment.author?.avatar_url} name={comment.author?.full_name || comment.author?.username} className="h-7 w-7 text-[10px]" /><div className="min-w-0 flex-1 rounded-xl bg-neutral-50 px-3 py-2"><p className="text-xs font-semibold">{comment.author?.full_name || comment.author?.username || "Пользователь"}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-neutral-600">{comment.content}</p></div></div>)}
                      {comments[post.id]?.length === 0 && <p className="text-xs text-neutral-400">Пока нет комментариев. Начните обсуждение.</p>}
                    </div>
                    <form onSubmit={(event) => addComment(event, post.id)} className="mt-3 flex gap-2">
                      <input value={commentDrafts[post.id] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} maxLength={1200} placeholder="Написать комментарий..." className="h-10 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-neutral-400" />
                      <Button type="submit" size="icon" aria-label="Отправить комментарий" disabled={!(commentDrafts[post.id] || "").trim()}><Send className="h-4 w-4" /></Button>
                    </form>
                  </div>}
                </article>
              );
            })}
            {!visiblePosts.length && <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100"><MessageCircle className="h-5 w-5 text-neutral-500" /></div>
              <h3 className="mt-4 text-base font-semibold">{search ? "Ничего не найдено" : "Лента пока пуста"}</h3>
              <p className="mx-auto mt-2 max-w-[320px] text-sm leading-6 text-neutral-500">{search ? "Попробуйте изменить запрос." : "Опубликуйте первую запись или подпишитесь на интересных людей, чтобы начать общение."}</p>
            </div>}
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-[92px] space-y-4">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Кого читать</h2><Users className="h-4 w-4 text-neutral-400" /></div>
              <div className="mt-4 space-y-4">
                {suggestions.length ? suggestions.map((person) => {
                  const name = person.full_name || person.username || "Пользователь";
                  const isFollowing = following.includes(person.id);
                  return <div key={person.id} className="flex items-center gap-2.5">
                    <Avatar src={person.avatar_url} name={name} className="h-9 w-9" />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{name}</p><p className="truncate text-[10px] text-neutral-400">{person.username ? `@${person.username}` : "Участник KYRO"}</p></div>
                    <button onClick={() => toggleFollow(person.id)} aria-label={isFollowing ? "Отписаться" : "Подписаться"} className="grid h-8 w-8 place-items-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50">{isFollowing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</button>
                  </div>;
                }) : <p className="text-xs leading-5 text-neutral-500">Здесь появятся люди, с которыми можно познакомиться.</p>}
              </div>
            </section>
            <section className="rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-[10px] font-semibold tracking-[.16em] text-neutral-400">KYRO SOCIAL</p>
              <p className="mt-2 text-sm font-semibold">Ваше пространство для общения</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">Публикуйте мысли, находите единомышленников и оставайтесь на связи.</p>
              <Link href="/profile" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-neutral-800 hover:underline">Открыть профиль <ChevronDown className="h-3.5 w-3.5 -rotate-90" /></Link>
            </section>
          </div>
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[66px] items-center justify-around border-t border-neutral-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <Link href="/" className="flex min-w-[54px] flex-col items-center gap-1 text-neutral-400"><House className="h-5 w-5" /><span className="text-[10px]">Главная</span></Link>
        <Link href="/social" className="flex min-w-[54px] flex-col items-center gap-1 text-neutral-900"><Compass className="h-5 w-5" /><span className="text-[10px] font-semibold">Social</span></Link>
        <Link href="/market" className="flex min-w-[54px] flex-col items-center gap-1 text-neutral-400"><Bookmark className="h-5 w-5" /><span className="text-[10px]">Market</span></Link>
        <Link href="/events" className="flex min-w-[54px] flex-col items-center gap-1 text-neutral-400"><Bell className="h-5 w-5" /><span className="text-[10px]">Events</span></Link>
        <Link href="/profile" className="flex min-w-[54px] flex-col items-center gap-1 text-neutral-400"><Avatar src={currentProfile?.avatar_url} name={displayName} className="h-5 w-5 text-[8px]" /><span className="text-[10px]">Профиль</span></Link>
      </nav>
    </main>
  );
}
