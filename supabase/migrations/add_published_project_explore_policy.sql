drop policy if exists "Anyone can view published projects" on public.projects;

create policy "Anyone can view published projects"
on public.projects
for select
using (status = 'published');

create or replace view public.public_creator_profiles as
select
  user_id,
  display_name,
  organization,
  avatar_url,
  bio
from public.profiles;

grant select on public.public_creator_profiles to anon, authenticated;
