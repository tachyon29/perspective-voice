# Supabase setup

The app uses the existing Supabase project for Auth and persistent progress. No account export or local database is required.

## Configure local development

1. In the Supabase dashboard, allow `http://localhost:5173/auth` and `http://127.0.0.1:5173/auth` in Auth URL configuration.
2. Copy the project URL and anon/publishable key to `frontend/.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Add the same values to `backend/.env` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The backend uses them to verify user access tokens.
4. If needed, apply [`../supabase/migrations/202609270001_user_progress.sql`](../supabase/migrations/202609270001_user_progress.sql) in the Supabase SQL editor. It creates the `user_progress` table and owner-only RLS policies.
5. Start the FastAPI and Vite development servers.

Use only the anon/publishable key in this application. Do not use the service-role key. The service role bypasses row-level security and is not needed for auth or progress sync.

## Redirect URLs and deployment

Add the local auth callback and deployed site callback to Supabase Auth's redirect URL allowlist. For Vercel, set the Vite variables in the frontend project and add the production frontend origin to the FastAPI service's `CORS_ORIGINS` setting. Store `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and AI provider keys in the backend host's environment settings.
