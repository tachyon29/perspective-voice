# Supabase

Supabase provides Perspective's authentication and saved progress storage. The frontend signs users in directly with Supabase Auth; row-level security restricts each `user_progress` record to its owner.

If `public.user_progress` is not present in your project, apply [`migrations/202609270001_user_progress.sql`](migrations/202609270001_user_progress.sql) in the Supabase SQL editor. Then set the project URL and anon/publishable key in the frontend and backend environment files as described in [`../docs/supabase-migration.md`](../docs/supabase-migration.md).
