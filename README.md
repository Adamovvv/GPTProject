# KYRO

**Everything. Connected.**

KYRO is a connected digital ecosystem with three independent modules:
- **Social** — profiles, community and messaging
- **Market** — products and marketplace
- **Events** — events and meetups

## Stack
- Next.js 15 App Router + TypeScript
- Supabase Auth + PostgreSQL + Storage
- `@supabase/ssr` cookie-based sessions
- Vercel

## Development

```bash
npm install
npm run dev
```

Required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The first milestone is a responsive Dashboard MVP with Supabase authentication. Each product module has its own route and can evolve independently.
