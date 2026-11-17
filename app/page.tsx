const services = [
  { name: "SOCIAL", title: "Общение", description: "Лента, сообщества и личные сообщения", icon: "◎", href: "/social" },
  { name: "MARKET", title: "Покупки", description: "Товары, предложения и новые находки", icon: "▧", href: "/market" },
  { name: "EVENTS", title: "События", description: "Мероприятия и встречи рядом", icon: "▦", href: "/events" },
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="KYRO home"><span className="brand-mark">K</span><span>KYRO<small>Everything. Connected.</small></span></a>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="active" href="/">⌂ <span>Главная</span></a>
          <a href="/social">◎ <span>Social</span></a>
          <a href="/market">▧ <span>Market</span></a>
          <a href="/events">▦ <span>Events</span></a>
        </nav>
        <div className="sidebar-bottom"><span className="avatar">K</span><span><b>Мой профиль</b><small>Личное пространство</small></span></div>
      </aside>
      <section className="workspace">
        <header className="topbar"><div className="mobile-brand">KYRO</div><div className="search">⌕ <span>Поиск в KYRO</span><kbd>⌘ K</kbd></div><div className="top-actions"><button aria-label="Уведомления">♧</button><span className="avatar">K</span></div></header>
        <div className="content">
          <section className="welcome">
            <div><span className="eyebrow">ТВОЁ ПРОСТРАНСТВО</span><h1>Добро пожаловать!</h1><p>Твоё цифровое пространство для общения, покупок и новых возможностей.</p><a className="welcome-link" href="#services">Открой новые возможности KYRO <span>↗</span></a></div>
            <div className="welcome-art" aria-hidden="true"><div className="orb orb-one"/><div className="orb orb-two"/><div className="orb-core">K</div></div>
          </section>
          <section id="services" className="section"><div className="section-heading"><div><span className="eyebrow">ТВОИ ВОЗМОЖНОСТИ</span><h2>My Services</h2></div><span className="muted">Всё важное — в одном месте</span></div>
            <div className="service-grid">{services.map((service) => <a className="service-card" href={service.href} key={service.name}><div className="service-top"><span className="service-icon">{service.icon}</span><span className="arrow">↗</span></div><span className="service-name">{service.name}</span><h3>{service.title}</h3><p>{service.description}</p></a>)}</div>
          </section>
          <section className="section popular"><div className="section-heading"><div><span className="eyebrow">ОТКРЫВАЙ НОВОЕ</span><h2>Popular in KYRO</h2></div><span className="muted">Скоро здесь появится самое интересное</span></div>
            <div className="empty-grid"><article className="empty-card"><span>✳</span><h3>Популярные товары</h3><p>Интересные находки из KYRO Market</p></article><article className="empty-card"><span>◷</span><h3>Ближайшие события</h3><p>То, что происходит рядом с тобой</p></article><article className="empty-card"><span>◎</span><h3>Лента Social</h3><p>Новости и публикации сообщества</p></article></div>
          </section>
          <footer>KYRO <span>·</span> Everything. Connected.</footer>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation"><a className="active" href="/">⌂<small>Главная</small></a><a href="/social">◎<small>Social</small></a><a href="/market">▧<small>Market</small></a><a href="/events">▦<small>Events</small></a><a href="/profile">◉<small>Профиль</small></a></nav>
      </section>
    </main>
  );
}
