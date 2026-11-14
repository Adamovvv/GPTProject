import { NextRequest, NextResponse } from "next/server";
import { telegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const setupSecret = process.env.TELEGRAM_SETUP_SECRET;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!setupSecret || !webhookSecret || !siteUrl) {
    return NextResponse.json({ error: "Missing Telegram setup configuration" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== "Bearer " + setupSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
  const [webhook, menu] = await Promise.all([
    telegram("setWebhook", {
      url: base + "/api/telegram/webhook",
      secret_token: webhookSecret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
    telegram("setChatMenuButton", { menu_button: { type: "commands" } }),
  ]);
  await telegram("setMyCommands", { commands: [
    { command: "start", description: "Запустить бота" },
    { command: "planner", description: "Открыть планировщик" },
    { command: "addtask", description: "Добавить задачу" },
    { command: "help", description: "Помощь" },
  ] });
  return NextResponse.json({ ok: true, webhook, menu });
}
