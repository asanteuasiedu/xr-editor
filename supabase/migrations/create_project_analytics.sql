create extension if not exists pgcrypto;

create table if not exists public.project_analytics_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  session_id text not null,
  event_type text not null,
  scene_id text,
  scene_name text,
  hotspot_id text,
  hotspot_title text,
  hotspot_type text,
  response_text text,
  answer_correct boolean,
  progress_value numeric,
  device_type text,
  browser_name text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_analytics_project_id_idx
on public.project_analytics_events(project_id);

create index if not exists project_analytics_session_id_idx
on public.project_analytics_events(session_id);

create index if not exists project_analytics_created_at_idx
on public.project_analytics_events(created_at);

alter table public.project_analytics_events enable row level security;

drop policy if exists "Project owners can view analytics for their own projects" on public.project_analytics_events;
create policy "Project owners can view analytics for their own projects"
on public.project_analytics_events
for select
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_analytics_events.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can insert analytics events" on public.project_analytics_events;
create policy "Authenticated users can insert analytics events"
on public.project_analytics_events
for insert
to authenticated
with check (
  auth.uid() is not null
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from public.projects
      where projects.id = project_analytics_events.project_id
        and projects.user_id = auth.uid()
    )
  )
);

-- TODO: add explicit anonymous/guest analytics policies only after a safe public collection strategy exists.
