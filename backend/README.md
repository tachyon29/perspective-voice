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

Learner code execution still requires Docker. It runs submissions in a restricted container; keep the Docker socket and API server private from untrusted deployments.

## Supabase Auth and progress

The frontend uses Supabase Auth. Career progress is stored in `public.user_progress`, protected by the row-level security policies in [`../supabase/migrations/202609270001_user_progress.sql`](../supabase/migrations/202609270001_user_progress.sql). Apply that migration once in the Supabase SQL editor if the table and policies are not already present.

The FastAPI service verifies Supabase access tokens before accepting code execution or AI requests. It only needs the project URL and anon/publishable key; never put the service-role key in the frontend or backend for this flow.

For deployment, set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SARVAM_API_KEY`, and `CORS_ORIGINS` in the backend host. The frontend needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL`.
