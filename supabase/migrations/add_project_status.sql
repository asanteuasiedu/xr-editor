alter table public.projects
add column if not exists status text not null default 'draft';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_status_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
    add constraint projects_status_check
    check (status in ('draft', 'published'));
  end if;
end;
$$;
