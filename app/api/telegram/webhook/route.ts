import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { financeWidget, plannerWidget } from "@/lib/widgets";
import { mainMenu, sendMessage, sendWidget, telegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };
type TelegramMessage = { message_id: number; text?: string; chat: { id: number; type: string }; from?: TelegramUser };
type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: { id: string; data?: string; from: TelegramUser; message?: TelegramMessage };
  widget_query?: { id: string; data?: string; from: TelegramUser; message?: TelegramMessage };
};

async function saveUser(user: TelegramUser) {
  const db = getDatabase();
  const { error } = await db.from("telegram_users").upsert({
    telegram_id: user.id,
    username: user.username ?? null,
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? null,
    language_code: user.language_code ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
  if (error) throw error;
}

async function getFinanceState(telegramId: number) {
  const db = getDatabase();
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const { data, error } = await db.from("finance_transactions")
    .select("kind,amount,category,occurred_at")
    .eq("telegram_id", telegramId)
    .gte("occurred_at", start.toISOString())
    .order("occurred_at", { ascending: false }).limit(1000);
  if (error) throw error;
  const rows = data ?? [];
  const income = rows.filter((x) => x.kind === "income").reduce((sum, x) => sum + Number(x.amount), 0);
  const expenses = rows.filter((x) => x.kind === "expense").reduce((sum, x) => sum + Number(x.amount), 0);
  return { income: Number(income.toFixed(2)), expenses: Number(expenses.toFixed(2)), currency: "EUR", recent: rows.slice(0, 4).map((x) => ({ kind: x.kind, amount: Number(x.amount), category: x.category })) };
}

async function getPlannerState(telegramId: number) {
  const db = getDatabase();
  const { data, error } = await db.from("planner_tasks").select("id,title,is_done")
    .eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(6);
  if (error) throw error;
  return { tasks: (data ?? []).map((x) => ({ id: x.id, title: x.title, done: x.is_done })) };
}

async function openFinance(chatId: number, userId: number) {
  const state = await getFinanceState(userId);
  await sendWidget(chatId, financeWidget(state), "Финансы — быстрые операции", state);
}

async function openPlanner(chatId: number, userId: number) {
  const state = await getPlannerState(userId);
  await sendWidget(chatId, plannerWidget(state), "Планировщик — ваши задачи", state);
}

async function handleWidgetQuery(query: NonNullable<TelegramUpdate["widget_query"]>) {
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;
  const userId = query.from.id;
  let result = "Готово";
  try {
    if (!chatId || !messageId || !query.data) throw new Error("Некорректный запрос");
    const db = getDatabase();
    const financeMatch = query.data.match(/^tx:(expense|income):(food|transport|coffee|other):([0-9]{1,6}(?:\.[0-9]{1,2})?)$/);
    const taskAdd = query.data.match(/^task:add:(shop|bills|call)$/);
    const taskDone = query.data.match(/^task:done:([0-9a-f-]{36})$/i);

    if (financeMatch) {
      const [, kind, category, amountText] = financeMatch;
      const amount = Number(amountText);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new Error("Недопустимая сумма");
      const names: Record<string, string> = { food: "Еда", transport: "Транспорт", coffee: "Кофе", other: "Другое" };
      const { error } = await db.from("finance_transactions").insert({ telegram_id: userId, kind, category: names[category], amount, currency: "EUR" });
      if (error) throw error;
      const state = await getFinanceState(userId);
      await telegram("editMessageWidgetData", { chat_id: chatId, message_id: messageId, chat_data: JSON.stringify(state) });
      result = kind === "income" ? "Доход записан" : "Расход записан";
    } else if (taskAdd) {
      const titles: Record<string, string> = { shop: "Купить продукты", bills: "Оплатить счета", call: "Позвонить" };
      const { error } = await db.from("planner_tasks").insert({ telegram_id: userId, title: titles[taskAdd[1]], priority: "normal" });
      if (error) throw error;
      const state = await getPlannerState(userId);
      await telegram("editMessageWidgetData", { chat_id: chatId, message_id: messageId, chat_data: JSON.stringify(state) });
      result = "Задача добавлена";
    } else if (taskDone) {
      const { error } = await db.from("planner_tasks").update({
        is_done: true, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", taskDone[1]).eq("telegram_id", userId);
      if (error) throw error;
      const state = await getPlannerState(userId);
      await telegram("editMessageWidgetData", { chat_id: chatId, message_id: messageId, chat_data: JSON.stringify(state) });
      result = "Задача отмечена выполненной";
    } else {
      throw new Error("Неизвестное действие");
    }
  } catch (error) {
    console.error("Widget action failed:", error instanceof Error ? error.message : "unknown");
    result = "Не удалось сохранить. Попробуйте ещё раз.";
  }
  await telegram("answerWidgetQuery", { widget_query_id: query.id, data: result });
}

async function handleUpdate(update: TelegramUpdate) {
  if (update.widget_query) return handleWidgetQuery(update.widget_query);

  if (update.callback_query) {
    const query = update.callback_query;
    await telegram("answerCallbackQuery", { callback_query_id: query.id });
    const chatId = query.message?.chat.id;
    if (!chatId) return;
    await saveUser(query.from);
    if (query.data === "open:finance") return openFinance(chatId, query.from.id);
    if (query.data === "open:planner") return openPlanner(chatId, query.from.id);
    if (query.data === "open:menu") return sendMessage(chatId, "Выберите раздел:", mainMenu);
    return;
  }

  const message = update.message;
  if (!message?.from || !message.text || message.chat.type !== "private") return;
  await saveUser(message.from);
  const command = message.text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();
  if (command === "/start" || command === "/menu") {
    return sendMessage(message.chat.id,
      "Привет! Это EVERYTHING — набор полезных инструментов прямо в Telegram.\n\nВыберите модуль, чтобы открыть интерактивный виджет.",
      mainMenu);
  }
  if (command === "/finance") return openFinance(message.chat.id, message.from.id);
  if (command === "/planner" || command === "/tasks") return openPlanner(message.chat.id, message.from.id);
  if (command === "/help") return sendMessage(message.chat.id, "Команды:\n/finance — финансы\n/planner — планировщик\n/menu — главное меню", mainMenu);
  return sendMessage(message.chat.id, "Выберите один из модулей в меню:", mainMenu);
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const update = await request.json() as TelegramUpdate;
    await handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: true });
  }
}
