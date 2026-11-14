import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { mainMenu, sendMessage, telegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type User = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };
type Message = { message_id: number; text?: string; chat: { id: number; type: string }; from?: User; reply_to_message?: { text?: string } };
type Callback = { id: string; data?: string; from: User; message?: Message };
type Update = { update_id: number; message?: Message; callback_query?: Callback };
const db = () => getDatabase();

async function saveUser(user: User) {
  const { error } = await db().from("telegram_users").upsert({
    telegram_id: user.id, username: user.username ?? null, first_name: user.first_name ?? "",
    last_name: user.last_name ?? null, language_code: user.language_code ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
  if (error) throw error;
}

async function getTasks(id: number) {
  const { data, error } = await db().from("planner_tasks")
    .select("id,title,is_done,due_at,priority,created_at")
    .eq("telegram_id", id).order("is_done", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data ?? [];
}

function dateLabel(value: string | null) {
  if (!value) return "без срока";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value));
}

async function openPlanner(chatId: number, userId: number) {
  const tasks = await getTasks(userId);
  const active = tasks.filter(x => !x.is_done);
  const completed = tasks.filter(x => x.is_done);
  const lines = tasks.length ? tasks.map(x =>
    (x.is_done ? "✅ " : "▫️ ") + x.title + "\n   " +
    (x.is_done ? "Выполнено" : dateLabel(x.due_at)) + " · " +
    (x.priority === "high" ? "важно" : x.priority === "low" ? "низкий приоритет" : "обычно")
  ).join("\n") : "Пока задач нет. Нажми «➕ Добавить задачу» или отправь /addtask Купить продукты";
  const keyboard = { inline_keyboard: [
    ...active.slice(0, 8).map(x => [
      { text: "✅ " + x.title.slice(0, 24), callback_data: "task:done:" + x.id },
      { text: "🗑", callback_data: "task:delete:" + x.id },
    ]),
    [{ text: "➕ Добавить задачу", callback_data: "task:prompt" }, { text: "🔄 Обновить", callback_data: "open:planner" }],
    [{ text: "📅 Сегодня", callback_data: "open:today" }, { text: "✅ Выполненные", callback_data: "open:completed" }],
    [{ text: "⬅️ Главное меню", callback_data: "open:menu" }],
  ] };
  return sendMessage(chatId,
    "📋 МОЙ ПЛАНИРОВЩИК\n\nАктивных: " + active.length + " · Выполнено: " + completed.length +
    "\n\n" + lines + "\n\nДобавить задачу командой:\n/addtask Название задачи\n/addtask 2026-11-15 | Название задачи", keyboard);
}

async function addTask(userId: number, title: string, dueAt: string | null = null) {
  const { error } = await db().from("planner_tasks").insert({
    telegram_id: userId, title: title.trim().slice(0, 120), due_at: dueAt,
    priority: "normal", is_done: false,
  });
  if (error) throw error;
}

async function handleCallback(q: Callback) {
  const chatId = q.message?.chat.id;
  if (!chatId) return;
  await saveUser(q.from);
  const data = q.data ?? "";
  if (data === "open:planner") { await openPlanner(chatId, q.from.id); return; }
  if (data === "open:menu") { await sendMessage(chatId, "Выбери раздел. Сейчас запускаем планировщик.", mainMenu); return; }
  if (data === "task:prompt") {
    await telegram("answerCallbackQuery", { callback_query_id: q.id });
    await sendMessage(chatId, "✍️ Напиши задачу ответом на это сообщение.", { force_reply: true, input_field_placeholder: "Название новой задачи" });
    return;
  }
  if (data === "open:today" || data === "open:completed") {
    const tasks = await getTasks(q.from.id);
    const rows = data === "open:completed" ? tasks.filter(x => x.is_done) :
      tasks.filter(x => !x.is_done && (!x.due_at || new Date(x.due_at).toDateString() === new Date().toDateString()));
    const heading = data === "open:today" ? "📅 ЗАДАЧИ НА СЕГОДНЯ" : "✅ ВЫПОЛНЕННЫЕ ЗАДАЧИ";
    await sendMessage(chatId, heading + "\n\n" + (rows.map(x => (x.is_done ? "✓ " : "▫️ ") + x.title).join("\n") || "Задач нет."),
      { inline_keyboard: [[{ text: "📋 Все задачи", callback_data: "open:planner" }]] });
    return;
  }
  const done = data.match(/^task:done:([0-9a-f-]{36})$/i);
  const del = data.match(/^task:delete:([0-9a-f-]{36})$/i);
  if (done) {
    const { error } = await db().from("planner_tasks").update({
      is_done: true, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", done[1]).eq("telegram_id", q.from.id);
    if (error) throw error;
    await telegram("answerCallbackQuery", { callback_query_id: q.id, text: "Задача выполнена 🎉" });
    await openPlanner(chatId, q.from.id);
    return;
  }
  if (del) {
    const { error } = await db().from("planner_tasks").delete().eq("id", del[1]).eq("telegram_id", q.from.id);
    if (error) throw error;
    await telegram("answerCallbackQuery", { callback_query_id: q.id, text: "Задача удалена" });
    await openPlanner(chatId, q.from.id);
    return;
  }
  await telegram("answerCallbackQuery", { callback_query_id: q.id });
}

async function handleMessage(m: Message) {
  if (!m.from || !m.text || m.chat.type !== "private") return;
  await saveUser(m.from);
  const text = m.text.trim();
  const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();

  if (command === "/start" || command === "/menu") {
    await telegram("setChatMenuButton", { chat_id: m.chat.id, menu_button: { type: "default" } });
    await telegram("setMyCommands", { commands: [
      { command: "start", description: "Запустить бота" },
      { command: "planner", description: "Открыть планировщик" },
      { command: "addtask", description: "Добавить задачу" },
      { command: "help", description: "Помощь" },
    ] });
    return sendMessage(m.chat.id,
      "Привет, " + (m.from.first_name || "друг") + "! 👋\n\nЭто EVERYTHING BOT. Начинаем с планировщика: добавляй задачи, отмечай выполненные и следи за планами. Остальные разделы добавим постепенно.",
      mainMenu);
  }
  if (command === "/planner" || command === "/tasks" || text === "📋 Планировщик") return openPlanner(m.chat.id, m.from.id);
  if (command === "/help") return sendMessage(m.chat.id,
    "Команды:\n/planner — планировщик\n/addtask Название — добавить задачу\n/addtask ГГГГ-ММ-ДД | Название — задача со сроком\n/menu — меню", mainMenu);
  if (command === "/addtask") {
    const rest = text.replace(/^\/addtask(?:@\w+)?\s*/i, "");
    if (!rest) return sendMessage(m.chat.id, "Добавь название после команды. Пример: /addtask Купить продукты");
    const dated = rest.match(/^(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)$/);
    let dueAt: string | null = null;
    let title = rest;
    if (dated) {
      const date = new Date(dated[1] + "T12:00:00Z");
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dated[1])
        return sendMessage(m.chat.id, "Дата неверная. Используй формат ГГГГ-ММ-ДД, например 2026-11-15.");
      dueAt = date.toISOString();
      title = dated[2];
    }
    if (!title.trim() || title.length > 120) return sendMessage(m.chat.id, "Название должно быть от 1 до 120 символов.");
    await addTask(m.from.id, title, dueAt);
    await sendMessage(m.chat.id, "✅ Добавил задачу: " + title.trim());
    return openPlanner(m.chat.id, m.from.id);
  }
  if (m.reply_to_message?.text?.startsWith("✍️ Напиши задачу ответом на это сообщение")) {
    if (text.length > 120) return sendMessage(m.chat.id, "Слишком длинное название. Максимум 120 символов.");
    await addTask(m.from.id, text);
    await sendMessage(m.chat.id, "✅ Задача добавлена: " + text);
    return openPlanner(m.chat.id, m.from.id);
  }
  if (text === "➕ Добавить задачу") {
    return sendMessage(m.chat.id, "✍️ Напиши задачу ответом на это сообщение.", { force_reply: true, input_field_placeholder: "Название новой задачи" });
  }
  if (text === "💰 Финансы") return sendMessage(m.chat.id, "Финансовый раздел добавим следующим этапом. Планировщик уже доступен: /planner");
  return sendMessage(m.chat.id, "Я пока учусь 🙂 Открой планировщик кнопкой или используй /addtask Название задачи.", mainMenu);
}

async function handleUpdate(update: Update) {
  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message) return handleMessage(update.message);
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const update = await request.json() as Update;
    await handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: true });
  }
}
