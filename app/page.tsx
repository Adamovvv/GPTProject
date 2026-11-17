import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

const services = [
  { key: "01", name: "SOCIAL", title: "Общение", description: "Лента, сообщества и личные сообщения", href: "/social", icon: "◎" },
  { key: "02", name: "MARKET", title: "Покупки", description: "Товары, предложения и новые находки", href: "/market", icon: "▧" },
  { key: "03", name: "EVENTS", title: "События", description: "Мероприятия и встречи рядом", href: "/events", icon: "▦" },
];

const highlights = [
  { title: "Популярные товары", description: "Интересные находки из KYRO Market", icon: "✳", href: "/market", tag: "MARKET" },
  { title: "Ближайшие события", description: "Встречи, идеи и впечатления", icon: "◷", href: "/events", tag: "EVENTS" },
  { title: "Лента Social", description: "Истории и публикации сообщества", icon: "◎", href: "/social", tag: "SOCIAL" },
];

export default async function Home() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: { claims: null } };
  const claims = data?.claims;
  const displayName =
    typeof claims?.user_metadata?.display_name === "string"
      ? claims.user_metadata.display_name
      : typeof claims?.email === "string"
        ? claims.email.split("@")[0]
        : null;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-symbol">K</span>
          <span className="brand-word">KYRO<span>Everything. Connected.</span></span>
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Основная навигация">
          <Link className="nav-item active" href="/"><span className="nav-icon">⌂</span>Главная</Link>
          <Link className="nav-item" href="/social"><span className="nav-icon">◎</span>Social</Link>
          <Link className="nav-item" href="/market"><span className="nav-icon">▧</span>Market</Link>
          <Link className="nav-item" href="/events"><span className="nav-icon">▦</span>Events</Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span />Все системы готовы</div>
          <Link className="profile-mini" href="/profile">
            <span className="avatar">{displayName ? displayName.slice(0, 1).toUpperCase() : "K"}</span>
            <span className="profile-mini-copy"><strong>{displayName ?? "Твой профиль"}</strong><small>{claims ? "Личный аккаунт" : "Присоединяйся к KYRO"}</small></span>
            <span className="profile-chevron">↗</span>
          </Link>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-symbol">K</span> KYRO</div>
          <label className="search-box"><span>⌕</span><input aria-label="Поиск" placeholder="Поиск в KYRO" /><kbd>⌘ K</kbd></label>
          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Уведомления">♧<i /></button>
            {claims ? (
              <div className="user-actions"><span className="topbar-name">{displayName}</span><SignOutButton /></div>
            ) : <Link className="button button-small" href="/login">Войти <span>↗</span></Link>}
          </div>
        </header>

        <div className="dashboard-content">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-dot" /> ТВОЁ ЦИФРОВОЕ ПРОСТРАНСТВО</div>
              <h1>{displayName ? `С возвращением, ${displayName}.` : "Добро пожаловать!"}</h1>
              <p>Твоё цифровое пространство для общения, покупок и новых возможностей. Всё, что важно, теперь связано.</p>
              <Link className="hero-link" href="#services">Открой новые возможности KYRO <span>↗</span></Link>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="visual-ring ring-one" /><div className="visual-ring ring-two" /><div className="visual-ring ring-three" />
              <div className="visual-core">K</div><span className="visual-spark spark-one">✳</span><span className="visual-spark spark-two">·</span>
            </div>
            <div className="hero-index">KYRO / 001</div>
          </section>

          <section className="section-block" id="services">
            <div className="section-heading">
              <div><div className="section-kicker">ТВОИ ВОЗМОЖНОСТИ</div><h2>My Services</h2></div>
              <span className="section-note">Одна экосистема. Три направления.</span>
            </div>
            <div className="service-grid">
              {services.map((service) => (
                <Link className="service-card" href={service.href} key={service.key}>
                  <div className="service-card-top"><span className="service-icon">{service.icon}</span><span className="service-index">{service.key}</span></div>
                  <div className="service-name">{service.name}</div><h3>{service.title}</h3>
                  <p>{service.description}</p><span className="card-arrow">↗</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="section-block popular-block">
            <div className="section-heading">
              <div><div className="section-kicker">БУДЬ В КУРСЕ</div><h2>Popular in KYRO</h2></div>
              <span className="section-note">Место для твоих открытий</span>
            </div>
            <div className="highlight-grid">
              {highlights.map((item) => (
                <Link className="highlight-card" href={item.href} key={item.tag}>
                  <div className="highlight-top"><span className="highlight-icon">{item.icon}</span><span className="highlight-tag">{item.tag}</span></div>
                  <h3>{item.title}</h3><p>{item.description}</p><span className="highlight-arrow">↗</span>
                </Link>
              ))}
            </div>
          </section>
          <footer className="dashboard-footer"><span>KYRO © 2026</span><span>Everything. Connected.</span><span>Создано для новых возможностей</span></footer>
        </div>

        <nav className="mobile-nav" aria-label="Мобильная навигация">
          <Link className="mobile-nav-active" href="/"><span>⌂</span><small>Главная</small></Link>
          <Link href="/social"><span>◎</span><small>Social</small></Link>
          <Link href="/market"><span>▧</span><small>Market</small></Link>
          <Link href="/events"><span>▦</span><small>Events</small></Link>
          <Link href="/profile"><span>◉</span><small>Профиль</small></Link>
        </nav>
      </section>
    </main>
  );
}
