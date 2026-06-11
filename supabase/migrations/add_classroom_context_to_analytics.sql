alter table public.project_analytics_events
add column if not exists classroom_id uuid references public.project_classrooms(id) on delete set null,
add column if not exists classroom_name text,
add column if not exists share_slug text;

create index if not exists project_analytics_classroom_id_idx
on public.project_analytics_events(classroom_id);

create index if not exists project_analytics_share_slug_idx
on public.project_analytics_events(share_slug);

grant insert on public.project_analytics_events to anon, authenticated;

drop policy if exists "Anyone can insert analytics for active classrooms" on public.project_analytics_events;
create policy "Anyone can insert analytics for active classrooms"
on public.project_analytics_events
for insert
to anon, authenticated
with check (
  classroom_id is not null
  and exists (
    select 1
    from public.project_classrooms
    where project_classrooms.id = project_analytics_events.classroom_id
      and project_classrooms.project_id = project_analytics_events.project_id
      and project_classrooms.is_active = true
      and (
        project_analytics_events.share_slug is null
        or project_analytics_events.share_slug = project_classrooms.share_slug
      )
  )
  and (
    (auth.uid() is null and project_analytics_events.user_id is null)
    or (auth.uid() is not null and (project_analytics_events.user_id is null or project_analytics_events.user_id = auth.uid()))
  )
);
