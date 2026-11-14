"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, Bell, Bookmark, Check, ChevronDown, CircleHelp,
  Compass, Flag, Heart, Home, LogIn, MapPin, MessageCircle, Plus,
  Search, Send, ShieldCheck, Sparkles, Users, X, Menu, Newspaper,
  BriefcaseBusiness, CalendarDays, Megaphone, LogOut
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = { id: string; display_name: string; username: string | null; city: string | null; avatar_url: string | null };
type Post = {
  id: string; author_id: string; city: string | null; category: string; body: string;
  created_at: string; profiles: Profile | null; post_likes: { user_id: string }[];
  comments: { count: number }[];
};
type Issue = { id: string; title: string; city: string; address: string | null; category: string; description: string; status: string; created_at: string; profiles: Profile | null };

const supabase = createClient();
const categories = ["Все", "Общее", "Город", "Вопрос", "Помощь", "Культура", "Спорт"];
const navItems = [
  { id: "feed", label: "Лента", icon: Home },
  { id: "news", label: "Новости", icon: Newspaper },
  { id: "issues", label: "Народный контроль", icon: Flag },
  { id: "events", label: "События", icon: CalendarDays },
  { id: "jobs", label: "Работа", icon: BriefcaseBusiness },
];

function timeAgo(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "только что";
  if (seconds < 3600) return Math.floor(seconds / 60) + " мин. назад";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " ч. назад";
  return Math.floor(seconds / 86400) + " дн. назад";
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "Ж";
}

export default function Portal() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeNav, setActiveNav] = useState("feed");
  const [category, setCategory] = useState("Все");
  const [cityFilter, setCityFilter] = useState("Все города");
  const [search, setSearch] = useState("");
  const [postText, setPostText] = useState("");
  const [postCity, setPostCity] = useState("");
  const [postCategory, setPostCategory] = useState("Общее");
  const [issueOpen, setIssueOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [issueCity, setIssueCity] = useState("");
  const [issueAddress, setIssueAddress] = useState("");
  const [issueCategory, setIssueCategory] = useState("Инфраструктура");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  async function loadData() {
    setLoading(true);
    const [{ data: postData }, { data: issueData }] = await Promise.all([
      supabase.from("posts").select("id,author_id,city,category,body,created_at,profiles(id,display_name,username,city,avatar_url),post_likes(user_id),comments(count)").eq("status", "published").order("created_at", { ascending: false }).limit(40),
      supabase.from("issues").select("id,title,city,address,category,description,status,created_at,profiles(id,display_name,username,city,avatar_url)").order("created_at", { ascending: false }).limit(8),
    ]);
    setPosts((postData || []) as unknown as Post[]);
    setIssues((issueData || []) as unknown as Issue[]);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      if (data.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
        if (mounted) setProfile(p as Profile | null);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
    });
    loadData();
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const filteredPosts = useMemo(() => posts.filter((post) => {
    const matchesCategory = category === "Все" || post.category === category;
    const matchesCity = cityFilter === "Все города" || post.city === cityFilter;
    const haystack = (post.body + " " + (post.city || "") + " " + post.category).toLowerCase();
    return matchesCategory && matchesCity && haystack.includes(search.toLowerCase());
  }), [posts, category, cityFilter, search]);

  const cities = useMemo(() => ["Все города", ...Array.from(new Set(posts.map((post) => post.city).filter(Boolean) as string[]))], [posts]);

  async function refreshProfile(id: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    setProfile(data as Profile | null);
  }

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setAuthMessage("");
    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName || email.split("@")[0] } } });
      if (error) return setAuthMessage(error.message);
      if (data.user && data.session) await refreshProfile(data.user.id);
      setAuthMessage(data.session ? "Аккаунт создан. Добро пожаловать!" : "Проверьте почту и подтвердите регистрацию.");
      if (data.session) setAuthOpen(false);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setAuthMessage(error.message);
      if (data.user) await refreshProfile(data.user.id);
      setAuthOpen(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function createPost(event: React.FormEvent) {
    event.preventDefault();
    if (!user) { setAuthOpen(true); return; }
    if (!postText.trim()) return;
    const { error } = await supabase.from("posts").insert({
      author_id: user.id, body: postText.trim(), city: postCity.trim() || profile?.city || null, category: postCategory,
    });
    if (error) return setNotice(error.message);
    setPostText("");
    setNotice("Публикация размещена");
    await loadData();
  }

  async function toggleLike(post: Post) {
    if (!user) { setAuthOpen(true); return; }
    const liked = post.post_likes?.some((like) => like.user_id === user.id);
    const result = liked
      ? await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
    if (result.error) return setNotice(result.error.message);
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, post_likes: liked ? item.post_likes.filter((x) => x.user_id !== user.id) : [...(item.post_likes || []), { user_id: user.id }] }
      : item));
  }

  async function addComment(postId: string) {
    if (!user) { setAuthOpen(true); return; }
    const body = (commentDrafts[postId] || "").trim();
    if (!body) return;
    const { error } = await supabase.from("comments").insert({ post_id: postId, author_id: user.id, body });
    if (error) return setNotice(error.message);
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
    setExpandedComments(postId);
    await loadData();
  }

  async function createIssue(event: React.FormEvent) {
    event.preventDefault();
    if (!user) { setIssueOpen(false); setAuthOpen(true); return; }
    const { error } = await supabase.from("issues").insert({
      author_id: user.id, title: issueTitle.trim(), description: issueDescription.trim(),
      city: issueCity.trim(), address: issueAddress.trim() || null, category: issueCategory,
    });
    if (error) return setNotice(error.message);
    setIssueTitle(""); setIssueDescription(""); setIssueCity(""); setIssueAddress(""); setIssueOpen(false);
    setNotice("Сообщение о проблеме отправлено");
    await loadData();
  }

  async function reportPost(postId: string) {
    if (!user) { setAuthOpen(true); return; }
    const { error } = await supabase.from("content_reports").insert({ reporter_id: user.id, post_id: postId, reason: "Нарушение правил сообщества" });
    setNotice(error ? error.message : "Жалоба отправлена модераторам");
  }

  const issueStatus: Record<string, string> = { new: "Новая", reviewing: "На рассмотрении", in_progress: "В работе", resolved: "Решена", rejected: "Отклонена" };

  return (
    <div className="portal-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">Р</span><span>республика<span className="brand-dot">.</span><small>пространство жителей</small></span></a>
        <div className="top-search"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по публикациям и городам"/></div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Уведомления"><Bell size={19}/><i/></button>
          {user ? <button className="profile-chip" onClick={signOut}><span className="avatar tiny">{initials(profile?.display_name || user.email || "Ж")}</span><span>{profile?.display_name || "Мой профиль"}</span><LogOut size={15}/></button> : <button className="login-button" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}><LogIn size={16}/> Войти</button>}
        </div>
      </header>

      <div className="page-grid">
        <aside className="left-sidebar">
          <div className="city-switch"><MapPin size={16}/><span>Вся республика</span><ChevronDown size={15}/></div>
          <div className="side-label">ПЛАТФОРМА</div>
          <nav className="side-nav">
            {navItems.map((item) => <button key={item.id} className={activeNav === item.id ? "active" : ""} onClick={() => setActiveNav(item.id)}><item.icon size={18}/>{item.label}{item.id === "issues" && <span className="nav-count">{issues.length}</span>}</button>)}
          </nav>
          <div className="side-label community-label">СООБЩЕСТВА</div>
          <button className="community-link" onClick={() => { setActiveNav("feed"); setCategory("Город"); }}><span className="community-emoji blue">⌂</span> Городская жизнь</button>
          <button className="community-link" onClick={() => { setActiveNav("feed"); setCategory("Культура"); }}><span className="community-emoji orange">✳</span> Культура и события</button>
          <button className="community-link" onClick={() => { setActiveNav("feed"); setCategory("Спорт"); }}><span className="community-emoji green">↗</span> Спорт</button>
          <button className="community-link" onClick={() => { setActiveNav("feed"); setCategory("Помощь"); }}><span className="community-emoji purple">♡</span> Взаимопомощь</button>
          <div className="sidebar-promo"><div className="promo-icon"><Sparkles size={18}/></div><strong>Твой голос важен</strong><p>Делись идеями и помогай делать города лучше.</p><button onClick={() => setIssueOpen(true)}>Сообщить о проблеме <ArrowRight size={14}/></button></div>
          <div className="sidebar-foot">Независимая общественная платформа<br/>© 2026 Республика</div>
        </aside>

        <main className="main-column">
          <section className="welcome-banner">
            <div className="welcome-copy"><span className="eyebrow"><span className="live-dot"/> ЕДИНОЕ ПРОСТРАНСТВО ЖИТЕЛЕЙ</span><h1>Республика начинается <em>с тебя.</em></h1><p>Общайся, узнавай новости и меняй жизнь вокруг себя.</p><div className="welcome-actions"><button className="primary-button" onClick={() => user ? document.getElementById("composer")?.scrollIntoView({ behavior: "smooth" }) : setAuthOpen(true)}><Plus size={17}/> Создать публикацию</button><button className="ghost-button" onClick={() => setActiveNav("issues")}>Народный контроль <ArrowRight size={15}/></button></div></div>
            <div className="banner-art"><div className="art-sun"/><div className="art-hill hill-one"/><div className="art-hill hill-two"/><div className="art-building building-one"/><div className="art-building building-two"/><div className="art-building building-three"/><div className="art-pin"><MapPin size={17}/></div></div>
          </section>

          <div className="mobile-nav">{navItems.map((item) => <button key={item.id} className={activeNav === item.id ? "active" : ""} onClick={() => setActiveNav(item.id)}><item.icon size={17}/>{item.label}</button>)}</div>

          {activeNav === "feed" && <>
            <div className="section-heading"><div><span className="eyebrow muted">СООБЩЕСТВО</span><h2>Лента жителей</h2></div><button className="sort-button">Сначала новое <ChevronDown size={15}/></button></div>
            <div className="filter-row"><div className="category-tabs">{categories.map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>{cities.map((city) => <option key={city}>{city}</option>)}</select></div>
            <form id="composer" className="composer card" onSubmit={createPost}>
              <div className="composer-top"><span className="avatar">{initials(profile?.display_name || "Вы")}</span><textarea value={postText} onChange={(e) => setPostText(e.target.value)} placeholder={user ? "Что нового в твоём городе?" : "Войдите, чтобы поделиться новостью или идеей"} maxLength={3000}/></div>
              <div className="composer-bottom"><div className="composer-meta"><label><MapPin size={14}/><input value={postCity} onChange={(e) => setPostCity(e.target.value)} placeholder="Город"/></label><select value={postCategory} onChange={(e) => setPostCategory(e.target.value)}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></div><button className="send-button" type="submit"><Send size={15}/> Опубликовать</button></div>
            </form>
            {notice && <div className="notice"><Check size={15}/>{notice}<button onClick={() => setNotice("")}><X size={14}/></button></div>}
            <div className="feed-list">
              {loading ? <div className="empty-state">Загружаем публикации…</div> : filteredPosts.length === 0 ? <div className="empty-state"><MessageCircle size={25}/><strong>Пока здесь тихо</strong><span>Станьте первым, кто поделится новостью или идеей.</span></div> : filteredPosts.map((post) => {
                const author = post.profiles?.display_name || "Житель республики";
                const liked = post.post_likes?.some((like) => like.user_id === user?.id);
                const likeCount = post.post_likes?.length || 0;
                const commentCount = post.comments?.[0]?.count || 0;
                return <article className="post-card card" key={post.id}>
                  <div className="post-head"><span className="avatar">{initials(author)}</span><div className="post-author"><strong>{author}</strong><span>{post.city || "Республика"} <i>·</i> {timeAgo(post.created_at)}</span></div><span className="post-category">{post.category}</span><button className="more-button" onClick={() => reportPost(post.id)} title="Пожаловаться"><CircleHelp size={18}/></button></div>
                  <p className="post-body">{post.body}</p>
                  <div className="post-footer"><button className={liked ? "post-action liked" : "post-action"} onClick={() => toggleLike(post)}><Heart size={17} fill={liked ? "currentColor" : "none"}/>{likeCount || "Нравится"}</button><button className="post-action" onClick={() => setExpandedComments(expandedComments === post.id ? null : post.id)}><MessageCircle size={17}/>{commentCount || "Комментировать"}</button><button className="post-action save-action"><Bookmark size={16}/>Сохранить</button></div>
                  {expandedComments === post.id && <div className="comments-area"><form onSubmit={(e) => { e.preventDefault(); addComment(post.id); }}><input value={commentDrafts[post.id] || ""} onChange={(e) => setCommentDrafts((current) => ({ ...current, [post.id]: e.target.value }))} placeholder="Напишите комментарий…"/><button type="submit"><Send size={15}/></button></form><Comments postId={post.id}/></div>}
                </article>;
              })}
            </div>
          </>}

          {activeNav === "issues" && <section className="content-section"><div className="section-heading"><div><span className="eyebrow muted">ОБРАТНАЯ СВЯЗЬ</span><h2>Народный контроль</h2><p className="section-description">Сообщайте о проблемах в городе и следите за их статусом.</p></div><button className="primary-button" onClick={() => user ? setIssueOpen(true) : setAuthOpen(true)}><Plus size={16}/> Сообщить о проблеме</button></div><div className="issue-intro card"><div className="issue-intro-icon"><Flag size={21}/></div><div><strong>Изменения начинаются с сигнала</strong><p>Опишите проблему, укажите место — другие жители смогут увидеть обращение.</p></div></div><div className="issue-list">{issues.map((issue) => <article className="issue-card card" key={issue.id}><div className="issue-card-top"><span className="issue-category">{issue.category}</span><span className={"status-pill status-" + issue.status}>{issueStatus[issue.status] || issue.status}</span></div><h3>{issue.title}</h3><p>{issue.description}</p><div className="issue-meta"><span><MapPin size={14}/>{issue.city}{issue.address ? ", " + issue.address : ""}</span><span>{timeAgo(issue.created_at)}</span></div></article>)}{issues.length === 0 && <div className="empty-state">Пока нет обращений. Вы можете создать первое.</div>}</div></section>}

          {activeNav === "news" && <section className="content-section"><div className="section-heading"><div><span className="eyebrow muted">ИНФОРМАЦИЯ</span><h2>Новости сообщества</h2><p className="section-description">Публикации жителей и важные обновления.</p></div></div><div className="feed-list">{filteredPosts.map((post) => <article className="post-card card" key={post.id}><div className="post-head"><span className="avatar">{initials(post.profiles?.display_name || "Житель")}</span><div className="post-author"><strong>{post.profiles?.display_name || "Житель"}</strong><span>{post.city || "Республика"} · {timeAgo(post.created_at)}</span></div></div><p className="post-body">{post.body}</p></article>)}</div></section>}

          {(activeNav === "events" || activeNav === "jobs") && <div className="coming-soon card"><div className="coming-icon">{activeNav === "events" ? <CalendarDays/> : <BriefcaseBusiness/>}</div><span className="eyebrow muted">СЛЕДУЮЩИЙ ЭТАП</span><h2>{activeNav === "events" ? "Афиша событий" : "Работа в республике"}</h2><p>{activeNav === "events" ? "Скоро здесь появятся местные мероприятия, фестивали и встречи." : "Скоро здесь появятся вакансии, стажировки и предложения от местных компаний."}</p><button className="ghost-button" onClick={() => setActiveNav("feed")}>Вернуться в ленту <ArrowRight size={15}/></button></div>}
        </main>

        <aside className="right-sidebar">
          <section className="side-card">
            <div className="side-card-title"><strong>Пульс сообщества</strong><Activity size={17}/></div>
            <div className="stat-row"><span>Публикаций</span><strong>{posts.length}</strong></div>
            <div className="stat-row"><span>Обращений жителей</span><strong>{issues.length}</strong></div>
            <div className="stat-row"><span>Городов в ленте</span><strong>{Math.max(0, cities.length - 1)}</strong></div>
            <div className="stat-note"><span className="live-dot"/> Обновляется в реальном времени</div>
          </section>
          <section className="side-card quick-card"><div className="side-card-title"><strong>Быстрые действия</strong><Sparkles size={17}/></div><button onClick={() => user ? document.getElementById("composer")?.scrollIntoView({ behavior: "smooth" }) : setAuthOpen(true)}><Plus size={16}/> Создать публикацию</button><button onClick={() => setIssueOpen(true)}><Flag size={16}/> Сообщить о проблеме</button><button onClick={() => setActiveNav("feed")}><Users size={16}/> Найти сообщество</button></section>
          <section className="side-card values-card"><div className="side-card-title"><strong>Наши принципы</strong><ShieldCheck size={17}/></div><div className="value-item"><span className="value-icon"><Users size={16}/></span><div><strong>Открытость</strong><p>Место для каждого жителя.</p></div></div><div className="value-item"><span className="value-icon"><Heart size={16}/></span><div><strong>Взаимопомощь</strong><p>Поддерживаем друг друга.</p></div></div><div className="value-item"><span className="value-icon"><Check size={16}/></span><div><strong>Ответственность</strong><p>Уважение и конструктивный диалог.</p></div></div></section>
          <div className="right-foot">Правила сообщества · Конфиденциальность<br/>Обратная связь</div>
        </aside>
      </div>

      {authOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setAuthOpen(false); }}><div className="modal-card"><button className="modal-close" onClick={() => setAuthOpen(false)}><X size={18}/></button><div className="modal-brand"><span className="brand-mark">Р</span></div><h2>{authMode === "signup" ? "Присоединяйтесь к республике" : "С возвращением"}</h2><p>Общайтесь с соседями и участвуйте в жизни своего города.</p><form onSubmit={submitAuth}>{authMode === "signup" && <label>Как вас зовут<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ваше имя" required/></label>}<label>Электронная почта<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required/></label><label>Пароль<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Не менее 6 символов" required/></label><button className="primary-button full-button" type="submit">{authMode === "signup" ? "Создать аккаунт" : "Войти"} <ArrowRight size={16}/></button></form>{authMessage && <div className="auth-message">{authMessage}</div>}<div className="auth-switch">{authMode === "signup" ? "Уже есть аккаунт?" : "Впервые здесь?"} <button onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthMessage(""); }}>{authMode === "signup" ? "Войти" : "Создать аккаунт"}</button></div><small>Продолжая, вы соглашаетесь с правилами сообщества.</small></div></div>}

      {issueOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setIssueOpen(false); }}><div className="modal-card issue-modal"><button className="modal-close" onClick={() => setIssueOpen(false)}><X size={18}/></button><div className="modal-brand issue-brand"><Flag size={21}/></div><h2>Сообщить о проблеме</h2><p>Расскажите, что нужно исправить в вашем городе.</p><form onSubmit={createIssue}><label>Заголовок<input value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} minLength={4} maxLength={120} placeholder="Например, не работает уличное освещение" required/></label><label>Город<input value={issueCity} onChange={(e) => setIssueCity(e.target.value)} placeholder="Название города" required/></label><label>Адрес или ориентир<input value={issueAddress} onChange={(e) => setIssueAddress(e.target.value)} placeholder="Улица, дом, перекрёсток"/></label><label>Категория<select value={issueCategory} onChange={(e) => setIssueCategory(e.target.value)}><option>Инфраструктура</option><option>Дороги</option><option>Освещение</option><option>Мусор и уборка</option><option>Транспорт</option><option>Другое</option></select></label><label>Описание<textarea value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} minLength={10} maxLength={2000} placeholder="Опишите проблему подробнее…" required/></label><button className="primary-button full-button" type="submit">Отправить обращение <Send size={16}/></button></form></div></div>}
    </div>
  );
}

function Comments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("comments").select("id,body,created_at,profiles(display_name)").eq("post_id", postId).order("created_at", { ascending: true }).then(({ data }) => setComments(data || []));
  }, [postId]);
  return <div className="comment-list">{comments.map((comment) => <div className="comment-item" key={comment.id}><span className="comment-avatar">{initials(comment.profiles?.display_name || "Ж")}</span><div><strong>{comment.profiles?.display_name || "Житель"}</strong><p>{comment.body}</p></div></div>)}</div>;
}