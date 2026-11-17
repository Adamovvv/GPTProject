import Link from "next/link";

type ModulePageProps = { code: string; title: string; description: string; icon: string };

export function ModulePage({ code, title, description, icon }: ModulePageProps) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-symbol">K</span><span className="brand-word">KYRO<span>Everything. Connected.</span></span></Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Основная навигация">
          <Link className="nav-item" href="/"><span className="nav-icon">⌂</span>Главная</Link>
          <Link className={code === "SOCIAL" ? "nav-item active" : "nav-item"} href="/social"><span className="nav-icon">◎</span>Social</Link>
          <Link className={code === "MARKET" ? "nav-item active" : "nav-item"} href="/market"><span className="nav-icon">▧</span>Market</Link>
          <Link className={code === "EVENTS" ? "nav-item active" : "nav-item"} href="/events"><span className="nav-icon">▦</span>Events</Link>
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-status"><span />Модуль KYRO</div></div>
      </aside>
      <section className="main-panel">
        <header className="topbar"><Link className="mobile-brand" href="/"><span className="brand-symbol">K</span> KYRO</Link><div className="section-kicker">{code} / KYRO</div><Link className="button button-small" href="/">На главную</Link></header>
        <div className="dashboard-content">
          <div className="section-heading"><div><div className="section-kicker">ТВОЯ ЭКОСИСТЕМА</div><h2>{title}</h2></div><span className="section-note">Модуль KYRO</span></div>
          <section className="module-empty"><div><div className="module-empty-icon">{icon}</div><span className="module-pill">СЛЕДУЮЩИЙ ЭТАП РАЗРАБОТКИ</span><h2>{title} скоро здесь</h2><p>{description} Сейчас мы создаём надёжную основу KYRO. Этот раздел уже подготовлен и будет развиваться независимо от остальных модулей.</p><Link className="button" href="/">Вернуться на главную <span>↗</span></Link></div></section>
        </div>
        <nav className="mobile-nav" aria-label="Мобильная навигация"><Link href="/"><span>⌂</span><small>Главная</small></Link><Link className={code === "SOCIAL" ? "mobile-nav-active" : ""} href="/social"><span>◎</span><small>Social</small></Link><Link className={code === "MARKET" ? "mobile-nav-active" : ""} href="/market"><span>▧</span><small>Market</small></Link><Link className={code === "EVENTS" ? "mobile-nav-active" : ""} href="/events"><span>▦</span><small>Events</small></Link><Link href="/profile"><span>◉</span><small>Профиль</small></Link></nav>
      </section>
    </main>
  );
}
