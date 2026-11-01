# Perspective frontend

React/Vite uses Supabase Auth and stores saved progress directly in Supabase under row-level security. FastAPI remains the API for code execution and AI teammates.

```sh
cd frontend
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` from your Supabase project's API settings. Set `VITE_API_URL` to the FastAPI API base URL (default: `http://127.0.0.1:8000/api`). The Supabase anon/publishable key is intended for browser use with RLS enabled; never use a service-role key in the frontend.

For Vercel, set the project root to `frontend`; configure the three Vite variables above. Add the deployed frontend origin to `CORS_ORIGINS` on the FastAPI service and configure that origin in Supabase Auth's redirect URL allowlist.
