
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null default 0,
  q text not null check (char_length(q) between 2 and 300),
  options text[] not null,
  answer_index integer not null check (answer_index between 0 and 3)
);
grant select (id, course_id, position, q, options) on public.quiz_questions to authenticated;
grant insert, update, delete on public.quiz_questions to authenticated;
grant all on public.quiz_questions to service_role;
alter table public.quiz_questions enable row level security;
create policy "Signed-in read quiz" on public.quiz_questions for select to authenticated using (true);
create policy "Charities write quiz" on public.quiz_questions for all to authenticated
  using (public.has_role(auth.uid(),'charity_admin')) with check (public.has_role(auth.uid(),'charity_admin'));

drop function if exists public.claim_certificate(uuid);
create or replace function public.claim_certificate(_course uuid, _answers integer[] default '{}')
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); total int; done int; qn int; correct int := 0; issuer text; cert uuid;
  before_ids uuid[]; after_ids uuid[]; unlocked int; orgs int; r record; i int := 1;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select count(*) into total from lessons where course_id = _course;
  select count(*) into done from lesson_progress p join lessons l on l.id = p.lesson_id where l.course_id = _course and p.user_id = uid;
  if total = 0 or done < total then return json_build_object('ok', false, 'reason', 'lessons'); end if;
  select count(*) into qn from quiz_questions where course_id = _course;
  if qn > 0 then
    for r in select answer_index from quiz_questions where course_id = _course order by position loop
      if coalesce(_answers[i], -1) = r.answer_index then correct := correct + 1; end if;
      i := i + 1;
    end loop;
    if correct < ceil(qn * 0.8) then return json_build_object('ok', false, 'reason', 'quiz', 'correct', correct, 'total', qn); end if;
  end if;

  select coalesce(array_agg(s.id), '{}') into before_ids from shifts s
   where s.starts_at > now() and coalesce(array_length(public.missing_courses(s.id, uid),1),0) = 0;

  select id into cert from certificates where user_id = uid and course_id = _course;
  if cert is null then
    select coalesce(ch.name, 'Kindred') into issuer from courses c left join charities ch on ch.id = c.charity_id where c.id = _course;
    insert into certificates (user_id, course_id, holder_name, course_title, issuer_name)
    values (uid, _course, (select display_name from profiles where id = uid), (select title from courses where id = _course), issuer)
    returning id into cert;
    insert into audit_log (user_id, action, detail) values (uid, 'credential_issued', jsonb_build_object('course', _course));
  end if;

  select coalesce(array_agg(s.id), '{}') into after_ids from shifts s
   where s.starts_at > now() and coalesce(array_length(public.missing_courses(s.id, uid),1),0) = 0;
  select count(*), count(distinct s.charity_id) into unlocked, orgs from shifts s
   where s.id = any(after_ids) and not (s.id = any(before_ids));
  return json_build_object('ok', true, 'certificate_id', cert, 'unlocked_shift_count', unlocked, 'unlocked_org_count', orgs, 'new_ids', (select coalesce(array_agg(x),'{}') from unnest(after_ids) x where not (x = any(before_ids))));
end; $$;
revoke execute on function public.claim_certificate(uuid, integer[]) from public, anon;
grant execute on function public.claim_certificate(uuid, integer[]) to authenticated;

create or replace function public.cancel_booking(_shift uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  delete from bookings where shift_id = _shift and user_id = uid and attended = false;
  if not found then return false; end if;
  update shifts set spots_left = least(spots_total, spots_left + 1) where id = _shift;
  insert into audit_log (user_id, action, detail) values (uid, 'booking_cancelled', jsonb_build_object('shift', _shift));
  return true;
end; $$;
revoke execute on function public.cancel_booking from public, anon;
grant execute on function public.cancel_booking to authenticated;

create or replace function public.volunteer_stats(_uid uuid) returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'hours', coalesce(sum(b.hours) filter (where b.attended), 0),
    'shifts', count(*) filter (where b.attended),
    'charities', count(distinct s.charity_id) filter (where b.attended)
  ) from bookings b join shifts s on s.id = b.shift_id where b.user_id = _uid
$$;
revoke execute on function public.volunteer_stats from public, anon;
grant execute on function public.volunteer_stats to authenticated;

create or replace function public.admin_set_role(_user uuid, _role public.app_role, _grant boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'not found'; end if;
  if _grant then insert into user_roles (user_id, role) values (_user, _role) on conflict do nothing;
  else delete from user_roles where user_id = _user and role = _role; end if;
  insert into audit_log (user_id, action, detail) values (auth.uid(), 'role_change', jsonb_build_object('target', _user, 'role', _role, 'grant', _grant));
end; $$;
revoke execute on function public.admin_set_role from public, anon;
grant execute on function public.admin_set_role to authenticated;

create or replace function public.charity_kpis() returns json language sql stable security definer set search_path = public as $$
  with s as (select * from shifts where charity_id = public.my_charity_id())
  select json_build_object(
    'fill_rate', coalesce(round(100.0 * sum(spots_total - spots_left) filter (where starts_at between now() and now() + interval '7 days') / nullif(sum(spots_total) filter (where starts_at between now() and now() + interval '7 days'),0)), 0),
    'open_spots', coalesce(sum(spots_left) filter (where starts_at > now()), 0),
    'volunteers_month', (select count(distinct b.user_id) from bookings b join s on s.id = b.shift_id where b.created_at > now() - interval '30 days'),
    'hours', (select coalesce(sum(b.hours),0) from bookings b join s on s.id = b.shift_id where b.attended)
  ) from s
$$;
revoke execute on function public.charity_kpis from public, anon;
grant execute on function public.charity_kpis to authenticated;
