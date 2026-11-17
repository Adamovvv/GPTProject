# KYRO

**Everything. Connected.**

KYRO is a digital ecosystem for social publishing, marketplace listings, events and personal space.

## Stack
React + Vite + TypeScript, Tailwind CSS, shadcn/ui primitives, Lucide React, Supabase Auth/Postgres/Storage, React Router, React Hook Form, Zod and TanStack Query.

## Local development

1. Install Node.js 20.19+ or 22.12+.
2. Copy `.env.example` to `.env.local` and set the Supabase URL and publishable/anon key.
3. Run `npm install`, then `npm run dev`.
4. Deploy the `username-auth` Supabase Edge Function and set its `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` secrets. Never expose the service role key in Vite variables.

## Current milestone
Foundation, responsive navigation, dashboard data hooks, username/password UI and preliminary privacy page. Social/Market/Events full workflows, Edge Function rate limiting, and final production security review remain subsequent work. Existing Supabase data is preserved.
