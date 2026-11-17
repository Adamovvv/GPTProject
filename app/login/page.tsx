"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: window.location.origin + "/auth/callback",
          },
        });
        if (authError) throw authError;
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setMessage("Почти готово! Проверь почту и подтверди адрес, чтобы войти в KYRO.");
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.push("/");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось выполнить вход. Попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
  }

  return (
    <main className="auth-shell">
      <aside className="auth-aside">
        <Link className="brand" href="/"><span className="brand-symbol">K</span><span className="brand-word">KYRO<span>Everything. Connected.</span></span></Link>
        <div className="auth-orbit" aria-hidden="true" />
        <div className="auth-aside-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> ОДНА ЭКОСИСТЕМА</div>
          <h1>Всё важное.<br />В одном месте.</h1>
          <p>Общайся, находи интересное и открывай новые возможности вместе с KYRO.</p>
        </div>
        <div className="auth-aside-foot">KYRO © 2026 · Everything. Connected.</div>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <div className="section-kicker">ТВОЁ ПРОСТРАНСТВО НАЧИНАЕТСЯ ЗДЕСЬ</div>
          <h2>{mode === "signin" ? "С возвращением" : "Создать аккаунт"}</h2>
          <p className="auth-subtitle">{mode === "signin" ? "Войди, чтобы продолжить в KYRO." : "Присоединяйся к единой цифровой экосистеме."}</p>
          <div className="auth-tabs">
            <button className={mode === "signin" ? "auth-tab active" : "auth-tab"} type="button" onClick={() => switchMode("signin")}>Войти</button>
            <button className={mode === "signup" ? "auth-tab active" : "auth-tab"} type="button" onClick={() => switchMode("signup")}>Регистрация</button>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "signup" && <div className="field"><label htmlFor="display-name">Как тебя называть</label><input id="display-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Твоё имя" autoComplete="name" required maxLength={60} /></div>}
            <div className="field"><label htmlFor="email">Электронная почта</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required /></div>
            <div className="field"><label htmlFor="password">Пароль</label><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Не менее 6 символов" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required /></div>
            {error && <div className="auth-message auth-error" role="alert">{error}</div>}
            {message && <div className="auth-message" role="status">{message}</div>}
            <button className="button auth-submit" type="submit" disabled={loading}>{loading ? "Подожди..." : mode === "signin" ? "Войти в KYRO" : "Создать аккаунт"} <span>↗</span></button>
          </form>
          <Link className="auth-back" href="/">← Вернуться на главную</Link>
        </div>
      </section>
    </main>
  );
}
