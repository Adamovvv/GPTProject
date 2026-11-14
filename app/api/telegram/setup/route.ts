import { NextRequest, NextResponse } from "next/server";
import { telegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const setupSecret = process.env.TELEGRAM_SETUP_SECRET;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!setupSecret || !webhookSecret || !siteUrl) {
    return NextResponse.json({ error: "Set TELEGRAM_SETUP_SECRET, TELEGRAM_WEBHOOK_SECRET and NEXT_PUBLIC_SITE_URL" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${setupSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await telegram("setWebhook", {
    url: `${siteUrl.replace(/\/$/, "")}/api/telegram/webhook`,
    secret_token: webhookSecret,
    allowed_updates: ["message", "callback_query", "widget_query"],
    drop_pending_updates: true,
  });
  return NextResponse.json({ ok: true, result });
}
