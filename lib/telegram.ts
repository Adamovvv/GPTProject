const apiBase = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return `https://api.telegram.org/bot${token}`;
};

export async function telegram(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`${apiBase()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const result = await response.json() as { ok: boolean; result?: unknown; description?: string };
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram API error: ${method}`);
  return result.result;
}

export async function sendMessage(chatId: number, text: string, replyMarkup?: Record<string, unknown>) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function sendWidget(chatId: number, html: string, caption: string, chatData: unknown) {
  return telegram("sendWidget", {
    chat_id: chatId,
    html,
    caption,
    allow_queries: true,
    chat_data: JSON.stringify(chatData),
  });
}

export const mainMenu = {
  inline_keyboard: [
    [{ text: "◈ Финансы", callback_data: "open:finance" }, { text: "✓ Планировщик", callback_data: "open:planner" }],
    [{ text: "↻ Обновить меню", callback_data: "open:menu" }],
  ],
};
