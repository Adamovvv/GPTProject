"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/sign-out-button";

type ProfileEditorProps = { initialName: string; email: string | null };

export function ProfileEditor({ initialName, email }: ProfileEditorProps) {
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("Сначала войди в аккаунт.");
      const { error: updateError } = await supabase.auth.updateUser({ data: { display_name: name.trim() } });
      if (updateError) throw updateError;
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userData.user.id,
        full_name: name.trim(),
      });
      if (profileError) throw profileError;
      setMessage("Профиль обновлён.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сохранить профиль.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="profile-panel">
      <div className="profile-row">
        <span className="avatar profile-large">{name.trim().slice(0, 1).toUpperCase() || "K"}</span>
        <div className="profile-detail"><h2>{name || "Пользователь KYRO"}</h2><p>{email}</p></div>
      </div>
      <form className="profile-form" onSubmit={saveProfile}>
        <div className="field"><label htmlFor="profile-name">Имя в KYRO</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} minLength={2} required /></div>
        {message && <div className="auth-message" role="status">{message}</div>}
        {error && <div className="auth-message auth-error" role="alert">{error}</div>}
        <div className="profile-actions"><button className="button" type="submit" disabled={loading}>{loading ? "Сохраняю..." : "Сохранить изменения"}</button><SignOutButton /></div>
      </form>
    </section>
  );
}
