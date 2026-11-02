# Perspective backend

FastAPI provides code execution and AI teammate endpoints. Supabase owns user accounts and saved career progress; no local database or Alembic migration is needed. Apply the one-time Supabase progress table migration only if the table is not already in the project.

## Run locally

1. Copy `backend/.env.example` to `backend/.env` if needed.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the same Supabase project used by the frontend. Keep Gemini and Sarvam keys in this backend-only file.
3. Install dependencies and start the API:

```sh
cd backend
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Locally, learner code execution requires Docker and runs each submission in a short-lived restricted container with no network, limited memory/CPU/processes, and a read-only filesystem.

On Vercel, submissions run in Vercel Sandbox isolated microVMs with outbound networking disabled. No Docker daemon or separate VM is needed. The API registers Vercel's request headers so the Sandbox SDK can use Vercel's short-lived OIDC token; there is no static Vercel token to store.

Vercel Hobby includes monthly Sandbox quotas. Vercel states that sandbox creation pauses after the included quota is reached and no additional usage is charged on Hobby. See [Vercel Sandbox pricing and quotas](https://vercel.com/docs/sandbox/pricing). Local runs continue to use Docker.

## Supabase Auth and progress

The frontend uses Supabase Auth. Career progress is stored in `public.user_progress`, protected by the row-level security policies in [`../supabase/migrations/202609270001_user_progress.sql`](../supabase/migrations/202609270001_user_progress.sql). Apply that migration once in the Supabase SQL editor if the table and policies are not already present.

The FastAPI service verifies Supabase access tokens before accepting code execution or AI requests. It only needs the project URL and anon/publishable key; never put the service-role key in the frontend or backend for this flow.

For deployment, set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SARVAM_API_KEY`, and `CORS_ORIGINS` in the backend host. The frontend needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL`.
