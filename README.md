# Vercel Supabase Auth Server (Stateless)

A minimal stateless Node.js server for user registration and login backed by Supabase Postgres. Issues JWT tokens; no server-side sessions. Designed to be deployable to Vercel.

## Endpoints

- POST `/register` — `{ email, password, name? }`
  - Creates user in `app_users` with `approved=false`
- POST `/login` — `{ email, password }`
  - Returns `{ approved: false }` if not yet approved
  - Returns `{ token, approved: true }` on success
- GET `/me` — Authorization: `Bearer <token>`
  - Returns user profile and `approved` status

## Environment Variables

Create `.env`:

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
PORT=3001
```

- Use a strong `JWT_SECRET`.
- The `SERVICE_ROLE_KEY` is sensitive; keep it server-side only.

## Database Schema (SQL)

Run in Supabase SQL editor:

```sql
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  password_hash text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Optional: enable RLS and create policies, or keep open for server role
alter table public.app_users enable row level security;
create policy "allow read for anon" on public.app_users
  for select using (true);
```

> For production, craft stricter RLS policies. This server uses the Service Role, bypassing RLS.

## Development

```
pnpm install
pnpm dev
```

## Deploy to Vercel

- Create a new Vercel project from this folder.
- Set env vars in Vercel dashboard.
- Use `vercel.json` with `builds` for a Node server or migrate endpoints into Vercel functions.

## Client Integration (Next.js)

Set `NEXT_PUBLIC_AUTH_API_URL` in your Next app to the deployed base URL.

```
NEXT_PUBLIC_AUTH_API_URL=https://your-vercel-app.vercel.app
```

Then call `/register`, `/login`, `/me` from the browser.
