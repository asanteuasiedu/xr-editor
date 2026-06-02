create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  project_data jsonb not null,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_projects_updated_at();

DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
create policy "Users can view their own projects"
on public.projects
for select
using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects;
create policy "Users can insert their own projects"
on public.projects
for insert
with check (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
create policy "Users can update their own projects"
on public.projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
create policy "Users can delete their own projects"
on public.projects
for delete
using (auth.uid() = user_id);
