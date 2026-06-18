create or replace function public.get_classroom_project_by_slug(classroom_slug text)
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
  where classrooms.share_slug = classroom_slug
    and classrooms.is_active = true
  limit 1;
$$;

revoke all on function public.get_classroom_project_by_slug(text) from public;
grant execute on function public.get_classroom_project_by_slug(text) to anon, authenticated;
