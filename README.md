# EVERYTHING — Telegram Hub

A Telegram-first platform built around native HTML Widgets in Bot API 10.4. The first modules are Finance and Planner.

## Stack
- Next.js 15.5.9 / TypeScript
- Telegram Bot API 10.4: `sendWidget`, `widget_query`, `answerWidgetQuery`, `editMessageWidgetData`
- Supabase PostgreSQL with RLS enabled; server-side service-role access only
- Vercel for hosting and webhook delivery

## First modules
- **Finance:** quick income/expense actions, monthly totals and recent operations.
- **Planner:** add preset tasks and mark tasks complete.

Widgets run inside Telegram's sandbox: no network access, no external assets and no keyboard input. They call the bot through `TelegramWidget.request()`; the webhook validates every action and writes to Supabase.

## Required Vercel environment variables
Set these for Production, Preview and Development:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only Supabase service role key>
TELEGRAM_BOT_TOKEN=<token from @BotFather>
TELEGRAM_WEBHOOK_SECRET=<random 32+ character secret>
TELEGRAM_SETUP_SECRET=<another random 32+ character secret>
NEXT_PUBLIC_SITE_URL=https://<your-production-domain>
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=<bot username without @>
```
Never use `NEXT_PUBLIC_` for bot tokens or Supabase service-role keys.

## Configure the webhook
After setting the environment variables and deploying:
```bash
curl -X POST https://<your-production-domain>/api/telegram/setup \
  -H "Authorization: Bearer <TELEGRAM_SETUP_SECRET>"
```
Then open the bot and send `/start`. Health check: `/api/health`.

## Commands
- `/start` or `/menu` — main menu
- `/finance` — finance widget
- `/planner` or `/tasks` — planner widget
- `/help` — help

## Database
The clean schema is in `supabase/migrations/202611140003_telegram_hub.sql`. The bot is the only database client in this MVP. All application tables have RLS enabled and no anon/authenticated grants; the server uses the service-role key.

## Current MVP limits
- Finance uses EUR and quick-action amounts/categories; editable amounts and custom categories require a later widget flow or Mini App.
- Planner task creation uses preset actions; custom task text and reminders are the next iteration.
- Widgets are currently intended for private chats with the bot in Telegram production.
