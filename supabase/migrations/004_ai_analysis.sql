-- Stage 4: Claude analysis of ideas, LinkedIn profiles and team fit.

-- Admin-editable AI settings (single row).
create table if not exists public.settings (
  id            int primary key default 1 check (id = 1),
  model         text not null default 'claude-sonnet-5-5',
  instructions  text not null default '',
  criteria      jsonb not null default '[]',
  updated_at    timestamptz not null default now()
);

insert into public.settings (id, instructions, criteria) values (1,
$$You are a sharp, constructive startup investor and EMBA pitch coach. The team is an Executive MBA group (BMI Executive Institute) that will pitch ONE startup idea to investors in early December 2026 in a 5-minute pitch. Be honest and specific: name real competitors, state assumptions behind numbers, and prefer concrete next steps over generic advice. A score of 3 means "average for an EMBA pitch idea"; reserve 5 for genuinely exceptional.$$,
$$[
  {"key": "problem",       "name": "Problem",                    "weight": 1.5, "description": "How real, painful and frequent is the problem?"},
  {"key": "uniqueness",    "name": "Uniqueness & competition",   "weight": 1.5, "description": "Similar startups or products found online, and what differentiates this idea."},
  {"key": "market",        "name": "Market size",                "weight": 1.0, "description": "Rough target market and growth, with assumptions stated."},
  {"key": "business_model","name": "Business model",             "weight": 1.0, "description": "How it makes money, pricing logic, plausibility of unit economics."},
  {"key": "scalability",   "name": "Scalability",                "weight": 1.0, "description": "Can it grow without costs growing at the same rate?"},
  {"key": "feasibility",   "name": "Feasibility & time to MVP",  "weight": 1.0, "description": "Technical and operational difficulty, rough effort to an MVP."},
  {"key": "go_to_market",  "name": "Go-to-market",               "weight": 1.0, "description": "How to reach the first customers, which channels."},
  {"key": "risks",         "name": "Risks",                      "weight": 1.0, "description": "Regulatory, technical, market and execution risks (5 = low risk)."},
  {"key": "team_fit",      "name": "Team fit",                   "weight": 1.0, "description": "How well this group's combined expertise matches what the idea needs."},
  {"key": "pitch_appeal",  "name": "Pitch appeal",               "weight": 1.5, "description": "How compelling it is to investors in a 5-minute pitch."}
]$$::jsonb)
on conflict (id) do nothing;

alter table public.settings enable row level security;
drop policy if exists "settings: members read" on public.settings;
create policy "settings: members read" on public.settings for select to authenticated using (public.is_member());
drop policy if exists "settings: admin edits" on public.settings;
create policy "settings: admin edits" on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, update on public.settings to authenticated;

-- One current analysis per idea, written only by the server (Edge Function).
create table if not exists public.ai_analysis (
  idea_id             uuid primary key references public.ideas(id) on delete cascade,
  status              text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  overall_score       numeric(3, 1),
  criteria            jsonb,   -- [{key, name, weight, score, explanation}]
  similar_companies   jsonb,   -- [{name, url, note}]
  verdict             text,
  recommendations     jsonb,   -- [string]
  investor_questions  jsonb,   -- [string]
  team_fit            jsonb,   -- {members: [{member_id, name, reason, role}], gaps: [string]}
  error               text,
  model               text,
  analysed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.ai_analysis enable row level security;
drop policy if exists "ai_analysis: members read" on public.ai_analysis;
create policy "ai_analysis: members read" on public.ai_analysis for select to authenticated
  using (public.is_member() and exists (select 1 from public.ideas i where i.id = idea_id));
grant select on public.ai_analysis to authenticated;

-- New or edited ideas are queued for analysis automatically.
create or replace function public.queue_idea_analysis() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or (new.title, new.pitch, new.problem, new.solution, new.target_customer, new.revenue_model, new.tags)
       is distinct from (old.title, old.pitch, old.problem, old.solution, old.target_customer, old.revenue_model, old.tags) then
    insert into public.ai_analysis (idea_id, status) values (new.id, 'pending')
    on conflict (idea_id) do update set status = 'pending', error = null, updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists ideas_queue_analysis on public.ideas;
create trigger ideas_queue_analysis after insert or update on public.ideas
  for each row execute function public.queue_idea_analysis();

-- Ideas posted before Stage 4 get queued too.
insert into public.ai_analysis (idea_id) select id from public.ideas on conflict do nothing;

-- The Edge Function claims a queued job so the same idea is never analysed twice at once.
-- Failed jobs can be retried by anyone; stuck jobs (server died mid-way) after 5 minutes; admins can force a re-run.
create or replace function public.claim_analysis(p_idea uuid, p_force boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into public.ai_analysis (idea_id) values (p_idea) on conflict do nothing;
  update public.ai_analysis set status = 'running', error = null, updated_at = now()
   where idea_id = p_idea
     and (p_force or status in ('pending', 'failed') or (status = 'running' and updated_at < now() - interval '5 minutes'));
  return found;
end $$;
revoke execute on function public.claim_analysis(uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_analysis(uuid, boolean) to service_role;

-- Member profiles: LinkedIn PDF / pasted experience and Claude's skills summary.
create table if not exists public.profiles (
  member_id        uuid primary key default public.current_member_id() references public.members(id) on delete cascade,
  linkedin_path    text,
  experience_text  text not null default '',
  skills_summary   text not null default '',
  summary_status   text not null default 'idle' check (summary_status in ('idle', 'running', 'done', 'failed')),
  summary_error    text,
  updated_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "profiles: members read" on public.profiles;
create policy "profiles: members read" on public.profiles for select to authenticated using (public.is_member());
drop policy if exists "profiles: own insert" on public.profiles;
create policy "profiles: own insert" on public.profiles for insert to authenticated
  with check (member_id = public.current_member_id());
drop policy if exists "profiles: own edit" on public.profiles;
create policy "profiles: own edit" on public.profiles for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());
grant select, insert, update on public.profiles to authenticated;

-- Private storage for LinkedIn PDFs: each member uses a folder named after their member id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('linkedin', 'linkedin', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "linkedin: own folder read" on storage.objects;
create policy "linkedin: own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'linkedin' and (storage.foldername(name))[1] = public.current_member_id()::text);
drop policy if exists "linkedin: own folder upload" on storage.objects;
create policy "linkedin: own folder upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'linkedin' and (storage.foldername(name))[1] = public.current_member_id()::text);
drop policy if exists "linkedin: own folder replace" on storage.objects;
create policy "linkedin: own folder replace" on storage.objects for update to authenticated
  using (bucket_id = 'linkedin' and (storage.foldername(name))[1] = public.current_member_id()::text);
drop policy if exists "linkedin: own folder delete" on storage.objects;
create policy "linkedin: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'linkedin' and (storage.foldername(name))[1] = public.current_member_id()::text);

do $$ begin
  alter publication supabase_realtime add table public.ai_analysis;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
