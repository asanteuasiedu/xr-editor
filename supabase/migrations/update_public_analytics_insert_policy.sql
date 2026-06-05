grant select on public.project_analytics_events to authenticated;
grant insert on public.project_analytics_events to anon, authenticated;

drop policy if exists "Project owners can view analytics" on public.project_analytics_events;
drop policy if exists "Project owners can view analytics for their own projects" on public.project_analytics_events;
create policy "Project owners can view analytics"
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

drop policy if exists "Project owners can insert analytics events" on public.project_analytics_events;
create policy "Project owners can insert analytics events"
on public.project_analytics_events
for insert
to authenticated
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.projects
    where projects.id = project_analytics_events.project_id
      and projects.user_id = auth.uid()
  )
  and (project_analytics_events.user_id is null or project_analytics_events.user_id = auth.uid())
);

drop policy if exists "Anyone can insert analytics for published projects" on public.project_analytics_events;
create policy "Anyone can insert analytics for published projects"
on public.project_analytics_events
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.projects
    where projects.id = project_analytics_events.project_id
      and projects.status = 'published'
  )
  and (
    (auth.uid() is null and project_analytics_events.user_id is null)
    or (auth.uid() is not null and (project_analytics_events.user_id is null or project_analytics_events.user_id = auth.uid()))
  )
);
