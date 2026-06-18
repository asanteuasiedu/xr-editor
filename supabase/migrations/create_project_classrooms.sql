create extension if not exists pgcrypto;

create table if not exists public.project_classrooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  share_slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_classrooms_project_id_idx
on public.project_classrooms(project_id);

create index if not exists project_classrooms_owner_user_id_idx
on public.project_classrooms(owner_user_id);

create index if not exists project_classrooms_share_slug_idx
on public.project_classrooms(share_slug);

alter table public.project_classrooms enable row level security;

create or replace function public.set_project_classrooms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_project_classrooms_updated_at on public.project_classrooms;
create trigger set_project_classrooms_updated_at
before update on public.project_classrooms
for each row
execute function public.set_project_classrooms_updated_at();

drop policy if exists "Project owners can manage classrooms" on public.project_classrooms;
create policy "Project owners can manage classrooms"
on public.project_classrooms
for all
using (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.projects
    where projects.id = project_classrooms.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.projects
    where projects.id = project_classrooms.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "Anyone can view active classroom links" on public.project_classrooms;
create policy "Anyone can view active classroom links"
on public.project_classrooms
for select
using (is_active = true);

grant select on public.project_classrooms to anon, authenticated;
grant insert, update, delete on public.project_classrooms to authenticated;

create or replace function public.get_classroom_project_by_slug(lookup_share_slug text)
returns table (
  classroom_id uuid,
  owner_user_id uuid,
  classroom_name text,
  classroom_share_slug text,
  classroom_description text,
  classroom_is_active boolean,
  classroom_created_at timestamptz,
  classroom_updated_at timestamptz,
  project_id uuid,
  project_user_id uuid,
  project_title text,
  project_description text,
  project_data jsonb,
  project_status text,
  project_thumbnail_url text,
  project_created_at timestamptz,
  project_updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    classrooms.id as classroom_id,
    classrooms.owner_user_id,
    classrooms.name as classroom_name,
    classrooms.share_slug as classroom_share_slug,
    classrooms.description as classroom_description,
    classrooms.is_active as classroom_is_active,
    classrooms.created_at as classroom_created_at,
    classrooms.updated_at as classroom_updated_at,
    projects.id as project_id,
    projects.user_id as project_user_id,
    projects.title as project_title,
    projects.description as project_description,
    projects.project_data,
    projects.status as project_status,
    projects.thumbnail_url as project_thumbnail_url,
    projects.created_at as project_created_at,
    projects.updated_at as project_updated_at
  from public.project_classrooms as classrooms
  join public.projects on projects.id = classrooms.project_id
  where classrooms.share_slug = lookup_share_slug
    and classrooms.is_active = true
  limit 1;
$$;

revoke all on function public.get_classroom_project_by_slug(text) from public;
grant execute on function public.get_classroom_project_by_slug(text) to anon, authenticated;
