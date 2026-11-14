const modules = [
  { icon: "◈", title: "Финансы", text: "Расходы, доходы и быстрые финансовые действия прямо в чате." },
  { icon: "✓", title: "Планировщик", text: "Задачи, приоритеты и отметки о выполнении без лишних экранов." },
];

export default function Home() {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="#"><span className="brand-mark">E</span> EVERYTHING</a>
        <span className="nav-note">YOUR TELEGRAM HUB</span>
      </nav>
      <section className="hero">
        <div className="eyebrow"><span className="dot" /> ПЛАТФОРМА ВНУТРИ TELEGRAM</div>
        <h1>Всё нужное.<br /><em>В одном чате.</em></h1>
        <p className="lead">Финансы и планировщик в виде интерактивных виджетов, которые живут прямо в сообщениях Telegram.</p>
        {botUsername ? <a className="cta" href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer">Открыть Telegram-бота <span>↗</span></a> : <div className="setup-note">Бот подключается — скоро здесь появится ссылка для запуска.</div>}
        <div className="hint">Без отдельного приложения · Быстрые действия · Ваши данные в одном месте</div>
      </section>
      <section className="modules">
        <div className="section-label">ПЕРВЫЕ МОДУЛИ</div>
        <div className="module-grid">
          {modules.map((module) => <article className="module" key={module.title}><div className="module-icon">{module.icon}</div><h2>{module.title}</h2><p>{module.text}</p><span className="module-status">В первой версии</span></article>)}
        </div>
      </section>
      <footer>EVERYTHING <span>·</span> One Telegram. Everything you need.</footer>
    </main>
  );
}
