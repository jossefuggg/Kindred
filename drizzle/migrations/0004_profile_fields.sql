
alter table public.charities add column if not exists founded_year integer;
alter table public.endorsements add column if not exists author_name text not null default '';
alter table public.endorsements add column if not exists shift_title text not null default '';
update public.charities set founded_year = v.y from (values
 ('00000000-0000-0000-0000-00000000c001'::uuid, 1998), ('00000000-0000-0000-0000-00000000c002'::uuid, 2009),
 ('00000000-0000-0000-0000-00000000c003'::uuid, 1987), ('00000000-0000-0000-0000-00000000c004'::uuid, 2015),
 ('00000000-0000-0000-0000-00000000c005'::uuid, 2018), ('00000000-0000-0000-0000-00000000c006'::uuid, 2003)) v(id, y)
 where charities.id = v.id;

create or replace function public.charity_public_stats(_cid uuid) returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'volunteers', (select count(distinct b.user_id) from bookings b join shifts s on s.id = b.shift_id where s.charity_id = _cid),
    'hours', (select coalesce(sum(b.hours),0) from bookings b join shifts s on s.id = b.shift_id where s.charity_id = _cid and b.attended),
    'shifts_month', (select count(*) from shifts where charity_id = _cid and starts_at > now() - interval '30 days' and starts_at < now() + interval '30 days' and spots_left < spots_total),
    'shifts_run', (select count(*) from shifts where charity_id = _cid and starts_at < now()),
    'trained', (select count(distinct c.user_id) from certificates c join courses co on co.id = c.course_id where co.charity_id = _cid),
    'people', (select coalesce(json_agg(x), '[]') from (
       select p.id, p.display_name, sum(b.hours) as hours from bookings b join shifts s on s.id = b.shift_id join profiles p on p.id = b.user_id
       where s.charity_id = _cid and b.attended group by p.id, p.display_name order by 3 desc limit 40) x)
  )
$$;
revoke execute on function public.charity_public_stats from public, anon;
grant execute on function public.charity_public_stats to authenticated;

create or replace function public.volunteer_history(_uid uuid) returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.starts_at desc), '[]') from (
    select s.id, s.title, s.starts_at, b.hours, c.id as charity_id, c.name as charity_name
    from bookings b join shifts s on s.id = b.shift_id join charities c on c.id = s.charity_id
    where b.user_id = _uid and b.attended) x
$$;
revoke execute on function public.volunteer_history from public, anon;
grant execute on function public.volunteer_history to authenticated;
