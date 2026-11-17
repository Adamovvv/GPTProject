import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/profile-editor";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: { claims: null } };
  const claims = data?.claims;
  const email = typeof claims?.email === "string" ? claims.email : null;
  const name = typeof claims?.user_metadata?.display_name === "string"
    ? claims.user_metadata.display_name
    : email?.split("@")[0] ?? "Гость";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-symbol">K</span><span className="brand-word">KYRO<span>Everything. Connected.</span></span></Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Основная навигация">
          <Link className="nav-item" href="/"><span className="nav-icon">⌂</span>Главная</Link>
          <Link className="nav-item" href="/social"><span className="nav-icon">◎</span>Social</Link>
          <Link className="nav-item" href="/market"><span className="nav-icon">▧</span>Market</Link>
          <Link className="nav-item" href="/events"><span className="nav-icon">▦</span>Events</Link>
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-status"><span />Личный аккаунт</div></div>
      </aside>
      <section className="main-panel">
        <header className="topbar"><Link className="mobile-brand" href="/"><span className="brand-symbol">K</span> KYRO</Link><div className="section-kicker">ЛИЧНОЕ ПРОСТРАНСТВО</div><Link className="button button-small" href="/">На главную</Link></header>
        <div className="dashboard-content">
          <div className="section-heading"><div><div className="section-kicker">АККАУНТ</div><h2>Мой профиль</h2></div></div>
          {claims ? <ProfileEditor initialName={name} email={email} /> : (
            <section className="profile-panel"><div className="profile-row"><span className="avatar profile-large">K</span><div className="profile-detail"><h2>Ты ещё не вошёл в KYRO</h2><p>Войди или создай аккаунт, чтобы настроить профиль.</p></div></div><div className="profile-actions"><Link className="button" href="/login">Войти или зарегистрироваться <span>↗</span></Link></div></section>
          )}
        </div>
        <nav className="mobile-nav" aria-label="Мобильная навигация"><Link href="/"><span>⌂</span><small>Главная</small></Link><Link href="/social"><span>◎</span><small>Social</small></Link><Link href="/market"><span>▧</span><small>Market</small></Link><Link href="/events"><span>▦</span><small>Events</small></Link><Link className="mobile-nav-active" href="/profile"><span>◉</span><small>Профиль</small></Link></nav>
      </section>
    </main>
  );
}
