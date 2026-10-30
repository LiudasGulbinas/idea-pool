# 💡 Idea Pool

Startup idea collection for our BMI EMBA group's investor pitch. Members log in by email link,
post ideas, like and comment; Claude analyses each idea against investor criteria and team fit.

- Front end: React + Vite + TypeScript + Tailwind (`src/`), deployed on Vercel.
- Back end: Supabase (database, login, storage, edge functions). SQL in `supabase/migrations/`.
- Test the database rules locally: `supabase/test/run.sh` (needs Postgres 16).

Local development: `npm install && npm run dev` (the public Supabase URL and key are in `src/lib/supabase.ts`).
