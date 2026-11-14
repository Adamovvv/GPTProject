import { NextRequest, NextResponse } from "next/server";
import { telegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function configure(request: NextRequest, allowQuerySecret = false) {
  const setupSecret = process.env.TELEGRAM_SETUP_SECRET;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!setupSecret || !webhookSecret || !siteUrl) {
    return NextResponse.json({ error: "Missing Telegram setup environment variables" }, { status: 503 });
  }
  const bearer = request.headers.get("authorization") === `Bearer ${setupSecret}`;
  const query = allowQuerySecret && request.nextUrl.searchParams.get("key") === setupSecret;
  if (!bearer && !query) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await telegram("setWebhook", {
    url: `${siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl}/api/telegram/webhook`,
    secret_token: webhookSecret,
    allowed_updates: ["message", "callback_query", "widget_query"],
    drop_pending_updates: true,
  });
  return NextResponse.json({ ok: true, result });
}

export async function POST(request: NextRequest) {
  return configure(request);
}

// Temporary mobile-friendly setup path; remove after webhook registration.
export async function GET(request: NextRequest) {
  return configure(request, true);
}
