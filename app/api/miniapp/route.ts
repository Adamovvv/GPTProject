import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type TgUser = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };

function verifyInitData(initData: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userRaw = params.get("user");
  if (!hash || !userRaw || !Number.isFinite(authDate) || Date.now() / 1000 - authDate > 86400 || authDate > Date.now() / 1000 + 60) return null;
  params.delete("hash");
  params.delete("signature");
  const dataCheck = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => k + "=" + v).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const calculated = createHmac("sha256", secret).update(dataCheck).digest("hex");
  const a = Buffer.from(calculated, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const user = JSON.parse(userRaw) as TgUser; return user && Number.isSafeInteger(user.id) ? user : null; } catch { return null; }
}

async function authorized(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("tma ") ? verifyInitData(header.slice(4)) : null;
}
async function ensureUser(user: TgUser) {
  const { error } = await getDatabase().from("telegram_users").upsert({
    telegram_id: user.id, first_name: user.first_name || "", last_name: user.last_name || null,
    username: user.username || null, language_code: user.language_code || null, updated_at: new Date().toISOString()
  }, { onConflict: "telegram_id" });
  if (error) throw error;
}
async function notify(id: number, kind: string, title: string, body = "") {
  const { error } = await getDatabase().from("app_notifications").insert({ telegram_id: id, kind, title, body });
  if (error) console.warn("Notification insert failed:", error.message);
}
async function load(user: TgUser) {
  const db = getDatabase();
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const [tx, tasks, posts, products, users, messages, notifications, follows] = await Promise.all([
    db.from("finance_transactions").select("id,kind,amount,currency,category,note,occurred_at").eq("telegram_id", user.id).gte("occurred_at", month.toISOString()).order("occurred_at", { ascending: false }).limit(100),
    db.from("planner_tasks").select("id,title,is_done,due_at,priority,created_at").eq("telegram_id", user.id).order("is_done", { ascending: true }).order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(100),
    db.from("social_posts").select("id,telegram_id,body,created_at").order("created_at", { ascending: false }).limit(60),
    db.from("marketplace_products").select("id,seller_telegram_id,title,description,price,currency,category,created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(60),
    db.from("telegram_users").select("telegram_id,username,first_name,bio,avatar_url").order("updated_at", { ascending: false }).limit(60),
    db.from("app_messages").select("id,sender_telegram_id,recipient_telegram_id,body,created_at,read_at").or("sender_telegram_id.eq." + user.id + ",recipient_telegram_id.eq." + user.id).order("created_at", { ascending: true }).limit(100),
    db.from("app_notifications").select("id,kind,title,body,is_read,created_at").eq("telegram_id", user.id).order("created_at", { ascending: false }).limit(50),
    db.from("social_follows").select("following_telegram_id").eq("follower_telegram_id", user.id)
  ]);
  for (const result of [tx, tasks, posts, products, users, messages, notifications, follows]) if (result.error) throw result.error;
  const transactions = tx.data || [];
  const income = transactions.filter(x => x.kind === "income").reduce((s, x) => s + Number(x.amount), 0);
  const expenses = transactions.filter(x => x.kind === "expense").reduce((s, x) => s + Number(x.amount), 0);
  return {
    user: { id: String(user.id), first_name: user.first_name || "Привет", username: user.username },
    transactions, tasks: tasks.data || [],
    totals: { income: Number(income.toFixed(2)), expenses: Number(expenses.toFixed(2)) },
    posts: posts.data || [], products: products.data || [],
    users: (users.data || []).filter(x => x.telegram_id !== user.id),
    messages: messages.data || [], notifications: notifications.data || [],
    following: (follows.data || []).map(x => String(x.following_telegram_id))
  };
}
function fail(error: unknown) {
  console.error("Mini App API:", error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ error: "Не удалось обработать запрос. Попробуй ещё раз." }, { status: 500 });
}
export async function GET(req: NextRequest) {
  const user = await authorized(req);
  if (!user) return NextResponse.json({ error: "Не удалось подтвердить вход Telegram. Закрой приложение и открой его кнопкой в чате с ботом." }, { status: 401 });
  try { await ensureUser(user); return NextResponse.json(await load(user)); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  const user = await authorized(req);
  if (!user) return NextResponse.json({ error: "Telegram authorization failed" }, { status: 401 });
  try {
    await ensureUser(user);
    const body = await req.json();
    const db = getDatabase();
    if (body.action === "transaction") {
      const amount = Number(body.amount);
      if (!["income", "expense"].includes(body.kind) || !Number.isFinite(amount) || amount <= 0 || amount > 100000000 || typeof body.category !== "string" || body.category.length > 40) return NextResponse.json({ error: "Проверь сумму и категорию" }, { status: 400 });
      const { error } = await db.from("finance_transactions").insert({ telegram_id: user.id, kind: body.kind, amount, currency: "EUR", category: body.category, note: typeof body.note === "string" ? body.note.slice(0, 240) : null });
      if (error) throw error;
    } else if (body.action === "task") {
      if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 120 || !["low", "normal", "high"].includes(body.priority)) return NextResponse.json({ error: "Проверь название и приоритет" }, { status: 400 });
      const due = body.due_at ? new Date(body.due_at + "T12:00:00Z") : null;
      if (due && Number.isNaN(due.getTime())) return NextResponse.json({ error: "Неверная дата" }, { status: 400 });
      const { error } = await db.from("planner_tasks").insert({ telegram_id: user.id, title: body.title.trim(), due_at: due?.toISOString() || null, priority: body.priority });
      if (error) throw error;
    } else if (body.action === "post") {
      if (typeof body.body !== "string" || !body.body.trim() || body.body.length > 2000) return NextResponse.json({ error: "Публикация должна содержать до 2000 символов" }, { status: 400 });
      const { error } = await db.from("social_posts").insert({ telegram_id: user.id, body: body.body.trim() });
      if (error) throw error;
    } else if (body.action === "product") {
      const price = Number(body.price);
      if (typeof body.title !== "string" || body.title.trim().length < 2 || body.title.length > 120 || !Number.isFinite(price) || price < 0 || price > 100000000) return NextResponse.json({ error: "Проверь название и цену товара" }, { status: 400 });
      const { error } = await db.from("marketplace_products").insert({ seller_telegram_id: user.id, title: body.title.trim(), description: typeof body.description === "string" ? body.description.slice(0, 2000) : "", price, currency: "EUR", category: typeof body.category === "string" ? body.category.slice(0, 60) : "Другое" });
      if (error) throw error;
    } else if (body.action === "follow") {
      const target = Number(body.telegram_id);
      if (!Number.isSafeInteger(target) || target === user.id) return NextResponse.json({ error: "Некорректный профиль" }, { status: 400 });
      const { error } = await db.from("social_follows").upsert({ follower_telegram_id: user.id, following_telegram_id: target }, { onConflict: "follower_telegram_id,following_telegram_id", ignoreDuplicates: true });
      if (error) throw error;
      await notify(target, "follow", "Новый подписчик", (user.first_name || "Пользователь") + " подписался на ваш профиль");
    } else if (body.action === "message") {
      const target = Number(body.recipient_telegram_id);
      if (!Number.isSafeInteger(target) || target === user.id || typeof body.body !== "string" || !body.body.trim() || body.body.length > 2000) return NextResponse.json({ error: "Проверь получателя и текст сообщения" }, { status: 400 });
      const { error } = await db.from("app_messages").insert({ sender_telegram_id: user.id, recipient_telegram_id: target, body: body.body.trim() });
      if (error) throw error;
      await notify(target, "message", "Новое сообщение", "У вас новое сообщение в EVERYTHING");
    } else if (body.action === "profile") {
      const { error } = await db.from("telegram_users").update({ bio: typeof body.bio === "string" ? body.bio.slice(0, 240) : "" }).eq("telegram_id", user.id);
      if (error) throw error;
    } else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    return NextResponse.json(await load(user));
  } catch (e) { return fail(e); }
}
export async function PATCH(req: NextRequest) {
  const user = await authorized(req);
  if (!user) return NextResponse.json({ error: "Telegram authorization failed" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === "notification" && typeof body.id === "string") {
      const { error } = await getDatabase().from("app_notifications").update({ is_read: true }).eq("id", body.id).eq("telegram_id", user.id);
      if (error) throw error;
    } else if (typeof body.id === "string" && typeof body.is_done === "boolean") {
      const { error } = await getDatabase().from("planner_tasks").update({ is_done: body.is_done, completed_at: body.is_done ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", body.id).eq("telegram_id", user.id);
      if (error) throw error;
    } else return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    return NextResponse.json(await load(user));
  } catch (e) { return fail(e); }
}
export async function DELETE(req: NextRequest) {
  const user = await authorized(req);
  if (!user) return NextResponse.json({ error: "Telegram authorization failed" }, { status: 401 });
  try {
    const body = await req.json();
    if (typeof body.id !== "string") return NextResponse.json({ error: "Invalid task" }, { status: 400 });
    const { error } = await getDatabase().from("planner_tasks").delete().eq("id", body.id).eq("telegram_id", user.id);
    if (error) throw error;
    return NextResponse.json(await load(user));
  } catch (e) { return fail(e); }
}
