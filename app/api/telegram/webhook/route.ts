import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { mainMenu, sendMessage, sendWidget, telegram } from "@/lib/telegram";
import { financeWidget, plannerWidget } from "@/lib/widgets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };
type TelegramMessage = { message_id: number; text?: string; chat: { id: number; type: string }; from?: TelegramUser };
type Callback = { id: string; data?: string; from: TelegramUser; message?: TelegramMessage };
type WidgetQuery = { id: string; data: string; from: TelegramUser; chat?: { id: number }; message_id?: number; type?: { type?: string } };
type TelegramUpdate = { update_id: number; message?: TelegramMessage; callback_query?: Callback; widget_query?: WidgetQuery };

async function saveUser(user: TelegramUser) {
  const { error } = await getDatabase().from("telegram_users").upsert({
    telegram_id: user.id, username: user.username ?? null, first_name: user.first_name ?? "",
    last_name: user.last_name ?? null, language_code: user.language_code ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
  if (error) throw error;
}

async function getFinanceState(id: number) {
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const { data, error } = await getDatabase().from("finance_transactions")
    .select("kind,amount,category,occurred_at").eq("telegram_id", id)
    .gte("occurred_at", start.toISOString()).order("occurred_at", { ascending: false }).limit(1000);
  if (error) throw error;
  const rows = data ?? [];
  const income = rows.filter(x => x.kind === "income").reduce((s,x) => s + Number(x.amount), 0);
  const expenses = rows.filter(x => x.kind === "expense").reduce((s,x) => s + Number(x.amount), 0);
  return { income: Number(income.toFixed(2)), expenses: Number(expenses.toFixed(2)), recent: rows.slice(0,5) };
}

async function getPlannerState(id: number) {
  const { data, error } = await getDatabase().from("planner_tasks").select("id,title,is_done")
    .eq("telegram_id", id).order("created_at", { ascending: false }).limit(12);
  if (error) throw error;
  return data ?? [];
}

const money = (n: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "EUR" }).format(n);
async function openFinance(chatId: number, userId: number) {
  const s = await getFinanceState(userId);
  const widgetState = { income: s.income, expenses: s.expenses, currency: "EUR", recent: s.recent };
  try {
    return await sendWidget(chatId, financeWidget(widgetState), "◈ Финансы · этот месяц", widgetState);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.warn("Telegram Finance widget unavailable; using inline keyboard:", message);
    const rows = s.recent.length ? s.recent.map(x => `• ${x.kind === "income" ? "+" : "−"}${money(Number(x.amount))} — ${x.category}`).join("\n") : "Пока нет операций.";
    const keyboard = { inline_keyboard: [
      [{ text: "− €12 · Еда", callback_data: "tx:expense:food:12" }, { text: "− €4 · Транспорт", callback_data: "tx:expense:transport:4" }],
      [{ text: "− €3 · Кофе", callback_data: "tx:expense:coffee:3" }, { text: "+ €50 · Доход", callback_data: "tx:income:other:50" }],
      [{ text: "↻ Обновить", callback_data: "open:finance" }, { text: "← Меню", callback_data: "open:menu" }],
    ]};
    return sendMessage(chatId, `◈ ФИНАНСЫ · ЭТОТ МЕСЯЦ\n\nДоходы: ${money(s.income)}\nРасходы: ${money(s.expenses)}\nБаланс: ${money(s.income-s.expenses)}\n\nПОСЛЕДНИЕ ОПЕРАЦИИ\n${rows}\n\nВыберите действие:`, keyboard);
  }
}

async function openPlanner(chatId: number, userId: number) {
  const tasks = await getPlannerState(userId);
  const widgetState = { tasks: tasks.map(x => ({ id: x.id, title: x.title, done: x.is_done })) };
  try {
    return await sendWidget(chatId, plannerWidget(widgetState), "✓ Планировщик · мои задачи", widgetState);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.warn("Telegram Planner widget unavailable; using inline keyboard:", message);
    const active = tasks.filter(x => !x.is_done).length;
    const lines = tasks.length ? tasks.map(x => `${x.is_done ? "✓" : "○"} ${x.title}`).join("\n") : "Задач пока нет.";
    const taskButtons = tasks.filter(x => !x.is_done).slice(0,6).map(x => [{ text: `✓ ${x.title.slice(0,30)}`, callback_data: `task:done:${x.id}` }]);
    const keyboard = { inline_keyboard: [
      ...taskButtons,
      [{ text: "＋ Купить продукты", callback_data: "task:add:shop" }, { text: "＋ Оплатить счета", callback_data: "task:add:bills" }],
      [{ text: "＋ Позвонить", callback_data: "task:add:call" }],
      [{ text: "↻ Обновить", callback_data: "open:planner" }, { text: "← Меню", callback_data: "open:menu" }],
    ]};
    return sendMessage(chatId, `✓ ПЛАНИРОВЩИК\n\nАктивных задач: ${active}\n\n${lines}\n\nНажмите на задачу, чтобы отметить её выполненной, или добавьте новую:`, keyboard);
  }
}

async function handleCallback(q: Callback) {
  const chatId = q.message?.chat.id;
  if (!chatId) return;
  await saveUser(q.from);
  const data = q.data ?? "";
  if (data === "open:finance") { await openFinance(chatId, q.from.id); return; }
  if (data === "open:planner") { await openPlanner(chatId, q.from.id); return; }
  if (data === "open:menu") { await sendMessage(chatId, "Выберите раздел:", mainMenu); return; }

  const tx = data.match(/^tx:(expense|income):(food|transport|coffee|other):([0-9]{1,6})$/);
  const add = data.match(/^task:add:(shop|bills|call)$/);
  const done = data.match(/^task:done:([0-9a-f-]{36})$/i);
  if (tx) {
    const [, kind, category, amount] = tx;
    const names: Record<string,string> = { food:"Еда", transport:"Транспорт", coffee:"Кофе", other:"Другое" };
    const { error } = await getDatabase().from("finance_transactions").insert({
      telegram_id:q.from.id, kind, category:names[category], amount:Number(amount), currency:"EUR",
    });
    if (error) throw error;
    await telegram("answerCallbackQuery", { callback_query_id:q.id, text: kind === "income" ? "Доход записан" : "Расход записан" });
    await openFinance(chatId, q.from.id); return;
  }
  if (add) {
    const titles: Record<string,string> = { shop:"Купить продукты", bills:"Оплатить счета", call:"Позвонить" };
    const { error } = await getDatabase().from("planner_tasks").insert({ telegram_id:q.from.id, title:titles[add[1]], priority:"normal" });
    if (error) throw error;
    await telegram("answerCallbackQuery", { callback_query_id:q.id, text:"Задача добавлена" });
    await openPlanner(chatId, q.from.id); return;
  }
  if (done) {
    const { error } = await getDatabase().from("planner_tasks").update({
      is_done:true, completed_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    }).eq("id", done[1]).eq("telegram_id", q.from.id);
    if (error) throw error;
    await telegram("answerCallbackQuery", { callback_query_id:q.id, text:"Готово!" });
    await openPlanner(chatId, q.from.id); return;
  }
  await telegram("answerCallbackQuery", { callback_query_id:q.id });
}

async function handleWidgetQuery(q: WidgetQuery) {
  if (!q.chat?.id || !q.message_id) {
    await telegram("answerWidgetQuery", { widget_query_id: q.id, data: "Не удалось определить сообщение" });
    return;
  }
  await saveUser(q.from);
  const data = q.data ?? "";
  let state: unknown;
  let result = "Готово";
  const tx = data.match(/^tx:(expense|income):(food|transport|coffee|other):([0-9]{1,6})$/);
  const add = data.match(/^task:add:(shop|bills|call)$/);
  const done = data.match(/^task:done:([0-9a-f-]{36})$/i);
  if (tx) {
    const [, kind, category, amount] = tx;
    const names: Record<string,string> = { food:"Еда", transport:"Транспорт", coffee:"Кофе", other:"Другое" };
    const { error } = await getDatabase().from("finance_transactions").insert({
      telegram_id:q.from.id, kind, category:names[category], amount:Number(amount), currency:"EUR",
    });
    if (error) throw error;
    const s = await getFinanceState(q.from.id);
    state = { income:s.income, expenses:s.expenses, currency:"EUR", recent:s.recent };
    result = kind === "income" ? "Доход записан" : "Расход записан";
  } else if (add) {
    const titles: Record<string,string> = { shop:"Купить продукты", bills:"Оплатить счета", call:"Позвонить" };
    const { error } = await getDatabase().from("planner_tasks").insert({ telegram_id:q.from.id, title:titles[add[1]], priority:"normal" });
    if (error) throw error;
    const tasks = await getPlannerState(q.from.id);
    state = { tasks:tasks.map(x => ({ id:x.id, title:x.title, done:x.is_done })) };
    result = "Задача добавлена";
  } else if (done) {
    const { error } = await getDatabase().from("planner_tasks").update({
      is_done:true, completed_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    }).eq("id", done[1]).eq("telegram_id", q.from.id);
    if (error) throw error;
    const tasks = await getPlannerState(q.from.id);
    state = { tasks:tasks.map(x => ({ id:x.id, title:x.title, done:x.is_done })) };
    result = "Задача выполнена";
  } else {
    result = "Неизвестное действие";
  }
  if (state !== undefined) {
    await telegram("editMessageWidgetData", {
      chat_id:q.chat.id, message_id:q.message_id, chat_data:JSON.stringify(state),
    });
  }
  await telegram("answerWidgetQuery", { widget_query_id:q.id, data:result });
}

async function handleUpdate(update: TelegramUpdate) {
  if (update.widget_query) return handleWidgetQuery(update.widget_query);
  if (update.callback_query) return handleCallback(update.callback_query);
  const m = update.message;
  if (!m?.from || !m.text || m.chat.type !== "private") return;
  await saveUser(m.from);
  const command = m.text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();
  if (command === "/start" || command === "/menu") return sendMessage(m.chat.id,
    "Привет! Это EVERYTHING — финансы и планировщик в Telegram. Выберите нужный раздел:", mainMenu);
  if (command === "/finance") return openFinance(m.chat.id, m.from.id);
  if (command === "/planner" || command === "/tasks") return openPlanner(m.chat.id, m.from.id);
  if (command === "/help") return sendMessage(m.chat.id, "Команды:\n/finance — финансы\n/planner — планировщик\n/menu — главное меню", mainMenu);
  return sendMessage(m.chat.id, "Выберите раздел в меню:", mainMenu);
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const update = await request.json() as TelegramUpdate;
    await handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: true });
  }
}
