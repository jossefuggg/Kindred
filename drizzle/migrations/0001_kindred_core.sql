
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists onboarded boolean not null default false;

-- Signup no longer assigns volunteer automatically; the user picks a role at onboarding.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_demo boolean := new.email like '%@demo.kindred.app';
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  if not is_demo and not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
    insert into public.audit_log (user_id, action, detail) values (new.id, 'role_change', jsonb_build_object('role','admin','reason','first user'));
  end if;
  insert into public.audit_log (user_id, action, detail) values (new.id, 'sign_up', '{}'::jsonb);
  return new;
end; $$;

-- Charities
create table public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  area text not null default '',
  cause text not null default '',
  description text not null default '',
  website text not null default '',
  image_key text not null default 'community',
  created_by uuid unique,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.charities to authenticated;
grant select on public.charities to anon;
grant all on public.charities to service_role;
alter table public.charities enable row level security;
create policy "Anyone reads charities" on public.charities for select to anon, authenticated using (true);
create policy "Owner updates charity" on public.charities for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create or replace function public.my_charity_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from public.charities where created_by = auth.uid()
$$;

-- Applications (shared: volunteer + charity owner)
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  volunteer_id uuid not null,
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (charity_id, volunteer_id)
);
grant select, insert, update on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "Volunteer or charity reads application" on public.applications for select to authenticated
  using (volunteer_id = auth.uid() or charity_id = public.my_charity_id());
create policy "Volunteer applies" on public.applications for insert to authenticated
  with check (volunteer_id = auth.uid() and status = 'pending' and public.has_role(auth.uid(),'volunteer'));
create policy "Charity decides" on public.applications for update to authenticated
  using (charity_id = public.my_charity_id()) with check (charity_id = public.my_charity_id());

-- Courses (shared library; charities edit; creator deletes)
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  kind text not null default 'training',
  summary text not null default '',
  minutes integer not null default 10,
  charity_id uuid references public.charities(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.courses to authenticated;
grant select on public.courses to anon;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "Anyone reads courses" on public.courses for select to anon, authenticated using (true);
create policy "Charities create courses" on public.courses for insert to authenticated
  with check (public.has_role(auth.uid(),'charity_admin') and created_by = auth.uid());
create policy "Charities edit courses" on public.courses for update to authenticated
  using (public.has_role(auth.uid(),'charity_admin')) with check (public.has_role(auth.uid(),'charity_admin'));
create policy "Creator deletes course" on public.courses for delete to authenticated using (created_by = auth.uid());

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null default 0,
  title text not null check (char_length(title) between 1 and 160),
  content text not null default '' check (char_length(content) <= 20000),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.lessons to authenticated;
grant select on public.lessons to anon;
grant all on public.lessons to service_role;
alter table public.lessons enable row level security;
create policy "Anyone reads lessons" on public.lessons for select to anon, authenticated using (true);
create policy "Charities write lessons" on public.lessons for all to authenticated
  using (public.has_role(auth.uid(),'charity_admin')) with check (public.has_role(auth.uid(),'charity_admin'));

create table public.charity_programs (
  charity_id uuid not null references public.charities(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  primary key (charity_id, course_id)
);
grant select, insert, delete on public.charity_programs to authenticated;
grant select on public.charity_programs to anon;
grant all on public.charity_programs to service_role;
alter table public.charity_programs enable row level security;
create policy "Anyone reads programs" on public.charity_programs for select to anon, authenticated using (true);
create policy "Owner adds program course" on public.charity_programs for insert to authenticated with check (charity_id = public.my_charity_id());
create policy "Owner removes program course" on public.charity_programs for delete to authenticated using (charity_id = public.my_charity_id());

create table public.lesson_progress (
  user_id uuid not null,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
grant select, insert, delete on public.lesson_progress to authenticated;
grant all on public.lesson_progress to service_role;
alter table public.lesson_progress enable row level security;
create policy "Own progress read" on public.lesson_progress for select to authenticated using (user_id = auth.uid());
create policy "Own progress insert" on public.lesson_progress for insert to authenticated with check (user_id = auth.uid());
create policy "Own progress delete" on public.lesson_progress for delete to authenticated using (user_id = auth.uid());

-- Certificates: issued only by claim_certificate(); public read for verification
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  user_id uuid not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  holder_name text not null,
  course_title text not null,
  issuer_name text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 years',
  unique (user_id, course_id)
);
grant select on public.certificates to anon, authenticated;
grant all on public.certificates to service_role;
alter table public.certificates enable row level security;
create policy "Anyone verifies certificates" on public.certificates for select to anon, authenticated using (true);

-- Shifts
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '',
  starts_at timestamptz not null,
  duration_hours numeric(4,1) not null default 2,
  commitment text not null default 'one-off' check (commitment in ('2 hrs','one-off','weekly')),
  spots_total integer not null default 6 check (spots_total between 1 and 500),
  spots_left integer not null default 6 check (spots_left >= 0),
  city text not null default '',
  address text not null default '',
  cause text not null default '',
  logistics text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.shifts to authenticated;
grant select on public.shifts to anon;
grant all on public.shifts to service_role;
alter table public.shifts enable row level security;
create policy "Anyone reads shifts" on public.shifts for select to anon, authenticated using (true);
create policy "Owner inserts shifts" on public.shifts for insert to authenticated with check (charity_id = public.my_charity_id());
create policy "Owner updates shifts" on public.shifts for update to authenticated using (charity_id = public.my_charity_id()) with check (charity_id = public.my_charity_id());
create policy "Owner deletes shifts" on public.shifts for delete to authenticated using (charity_id = public.my_charity_id());

create table public.shift_requirements (
  shift_id uuid not null references public.shifts(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  primary key (shift_id, course_id)
);
grant select, insert, delete on public.shift_requirements to authenticated;
grant select on public.shift_requirements to anon;
grant all on public.shift_requirements to service_role;
alter table public.shift_requirements enable row level security;
create policy "Anyone reads requirements" on public.shift_requirements for select to anon, authenticated using (true);
create policy "Owner writes requirements" on public.shift_requirements for insert to authenticated
  with check (exists (select 1 from public.shifts s where s.id = shift_id and s.charity_id = public.my_charity_id()));
create policy "Owner deletes requirements" on public.shift_requirements for delete to authenticated
  using (exists (select 1 from public.shifts s where s.id = shift_id and s.charity_id = public.my_charity_id()));

-- Bookings (created only through book_shift)
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  user_id uuid not null,
  attended boolean not null default false,
  hours numeric(4,1) not null default 0,
  created_at timestamptz not null default now(),
  unique (shift_id, user_id)
);
grant select on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create or replace function public.owns_shift(_shift uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shifts where id = _shift and charity_id = public.my_charity_id())
$$;
create or replace function public.is_shift_member(_shift uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.owns_shift(_shift) or exists (select 1 from public.bookings where shift_id = _shift and user_id = auth.uid())
$$;
create policy "Booker or charity reads booking" on public.bookings for select to authenticated
  using (user_id = auth.uid() or public.owns_shift(shift_id));

-- Chat
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  user_id uuid,
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 1000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "Members read chat" on public.chat_messages for select to authenticated using (public.is_shift_member(shift_id));
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.shifts;

-- Endorsements
create table public.endorsements (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  volunteer_id uuid not null,
  body text not null check (char_length(body) between 2 and 500),
  created_at timestamptz not null default now()
);
grant select on public.endorsements to authenticated;
grant all on public.endorsements to service_role;
alter table public.endorsements enable row level security;
create policy "Signed-in read endorsements" on public.endorsements for select to authenticated using (true);

-- ===== RPCs =====
create or replace function public.redact(_t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(_t,
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[EMAIL]', 'g'),
    '\b(?:\d[ -]?){13,16}\b', '[CARD]', 'g'),
    '\+?\d[\d ()-]{7,}\d', '[PHONE]', 'g')
$$;

create or replace function public.complete_onboarding(
  _role text, _name text, _area text, _bio text,
  _charity_name text default null, _cause text default null, _description text default null, _website text default null
) returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if exists (select 1 from user_roles where user_id = uid and role in ('volunteer','charity_admin')) then
    raise exception 'already onboarded';
  end if;
  if char_length(coalesce(_name,'')) not between 1 and 80 or char_length(coalesce(_area,'')) > 80 or char_length(coalesce(_bio,'')) > 500 then
    raise exception 'invalid input';
  end if;
  update profiles set display_name = _name, city = _area, bio = _bio, onboarded = true, updated_at = now() where id = uid;
  if _role = 'charity' then
    if char_length(coalesce(_charity_name,'')) not between 2 and 120 then raise exception 'invalid input'; end if;
    insert into user_roles (user_id, role) values (uid, 'charity_admin');
    insert into charities (name, area, cause, description, website, created_by)
    values (_charity_name, _area, coalesce(_cause,''), left(coalesce(_description,''),1000), left(coalesce(_website,''),200), uid)
    returning id into cid;
  else
    insert into user_roles (user_id, role) values (uid, 'volunteer');
  end if;
  insert into audit_log (user_id, action, detail) values (uid, 'role_change', jsonb_build_object('role', _role));
  return json_build_object('ok', true, 'charity_id', cid);
end; $$;

create or replace function public.missing_courses(_shift uuid, _user uuid) returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(r.course_id), '{}') from shift_requirements r
  where r.shift_id = _shift and not exists (
    select 1 from certificates c where c.user_id = _user and c.course_id = r.course_id and c.expires_at > now())
$$;

create or replace function public.book_shift(_shift uuid) returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); missing uuid[]; s record; cname text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from feature_flags where key = 'booking' and enabled) then
    return json_build_object('ok', false, 'reason', 'off');
  end if;
  select * into s from shifts where id = _shift;
  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if exists (select 1 from bookings where shift_id = _shift and user_id = uid) then
    return json_build_object('ok', true, 'already', true);
  end if;
  missing := public.missing_courses(_shift, uid);
  if array_length(missing, 1) > 0 then
    return json_build_object('ok', false, 'reason', 'missing', 'missing', missing);
  end if;
  update shifts set spots_left = spots_left - 1 where id = _shift and spots_left > 0;
  if not found then return json_build_object('ok', false, 'reason', 'full'); end if;
  insert into bookings (shift_id, user_id) values (_shift, uid);
  select name into cname from charities where id = s.charity_id;
  insert into chat_messages (shift_id, user_id, author_name, body)
  values (_shift, null, cname, 'Welcome, ' || coalesce((select split_part(display_name,' ',1) from profiles where id = uid),'friend') || '! Thanks for joining. See the pinned note for where to meet.');
  insert into audit_log (user_id, action, detail) values (uid, 'booking', jsonb_build_object('shift', _shift));
  return json_build_object('ok', true);
end; $$;

create or replace function public.send_chat(_shift uuid, _body text) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null or not public.is_shift_member(_shift) then raise exception 'not found'; end if;
  if char_length(trim(_body)) not between 1 and 1000 then raise exception 'invalid input'; end if;
  select count(*) into n from chat_messages where user_id = uid and created_at > now() - interval '1 minute';
  if n >= 30 then raise exception 'Slow down a little. Try again in 60s'; end if;
  insert into chat_messages (shift_id, user_id, author_name, body)
  values (_shift, uid, coalesce((select display_name from profiles where id = uid),'Volunteer'), public.redact(trim(_body)));
end; $$;

create or replace function public.claim_certificate(_course uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); total int; done int; cid uuid; issuer text; cert uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select count(*) into total from lessons where course_id = _course;
  select count(*) into done from lesson_progress p join lessons l on l.id = p.lesson_id where l.course_id = _course and p.user_id = uid;
  if total = 0 or done < total then raise exception 'Finish every lesson first'; end if;
  select id into cert from certificates where user_id = uid and course_id = _course;
  if cert is not null then return cert; end if;
  select coalesce(ch.name, 'Kindred') into issuer from courses c left join charities ch on ch.id = c.charity_id where c.id = _course;
  insert into certificates (user_id, course_id, holder_name, course_title, issuer_name)
  values (uid, _course, (select display_name from profiles where id = uid), (select title from courses where id = _course), issuer)
  returning id into cert;
  insert into audit_log (user_id, action, detail) values (uid, 'credential_issued', jsonb_build_object('course', _course));
  return cert;
end; $$;

create or replace function public.mark_attendance(_booking uuid, _hours numeric, _endorsement text) returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = _booking;
  if not found or not public.owns_shift(b.shift_id) then raise exception 'not found'; end if;
  if _hours < 0 or _hours > 24 then raise exception 'invalid input'; end if;
  update bookings set attended = true, hours = _hours where id = _booking;
  if char_length(coalesce(trim(_endorsement),'')) >= 2 then
    insert into endorsements (charity_id, volunteer_id, body) values (public.my_charity_id(), b.user_id, left(public.redact(trim(_endorsement)),500));
  end if;
  insert into audit_log (user_id, action, detail) values (auth.uid(), 'attendance_marked', jsonb_build_object('booking', _booking, 'hours', _hours));
end; $$;

revoke execute on function public.complete_onboarding, public.book_shift, public.send_chat, public.claim_certificate, public.mark_attendance from anon, public;
grant execute on function public.complete_onboarding, public.book_shift, public.send_chat, public.claim_certificate, public.mark_attendance, public.missing_courses to authenticated;

-- ===== Global seed =====
insert into public.charities (id, name, area, cause, description, website, image_key) values
('00000000-0000-0000-0000-00000000c001','Harbor Red Relief','Harbourside','Disaster response','Rapid help for families after fires, floods and storms.','harborred.example','relief'),
('00000000-0000-0000-0000-00000000c002','City Food Bank','City Centre','Food','Sorting, packing and delivering food parcels across the city.','cityfoodbank.example','food'),
('00000000-0000-0000-0000-00000000c003','Northside Hospice','Northside','Health','Companionship and practical help for patients and families.','northsidehospice.example','hospice'),
('00000000-0000-0000-0000-00000000c004','Green Streets Cleanup','Riverside','Environment','Litter picks, planting days and community gardens.','greenstreets.example','garden'),
('00000000-0000-0000-0000-00000000c005','Youth Code Mentors','City Centre','Education','Weekly coding clubs for teenagers who need a mentor.','youthcode.example','mentor'),
('00000000-0000-0000-0000-00000000c006','Shelter Together','Eastgate','Housing','Warm meals and a safe bed for people without a home.','sheltertogether.example','shelter');

insert into public.courses (id, title, kind, summary, minutes, charity_id) values
('00000000-0000-0000-0000-00000000a001','Safeguarding Basics','safeguarding','Spot the signs and know who to tell.',15,'00000000-0000-0000-0000-00000000c003'),
('00000000-0000-0000-0000-00000000a002','Food Safety L1','training','Handle, store and serve food safely.',12,'00000000-0000-0000-0000-00000000c002'),
('00000000-0000-0000-0000-00000000a003','First Aid Awareness','training','Stay calm and help until help arrives.',15,'00000000-0000-0000-0000-00000000c001'),
('00000000-0000-0000-0000-00000000a004','Manual Handling','induction','Lift and carry without getting hurt.',10,'00000000-0000-0000-0000-00000000c006'),
('00000000-0000-0000-0000-00000000a005','Data Privacy for Volunteers','induction','Keep people''s details safe.',10,'00000000-0000-0000-0000-00000000c005');

insert into public.lessons (course_id, position, title, content) values
('00000000-0000-0000-0000-00000000a001',1,'What safeguarding means','Safeguarding means protecting people''s health, wellbeing and rights, so they can live free from harm, abuse and neglect. As a volunteer, it is part of your role to notice and to act.'),
('00000000-0000-0000-0000-00000000a001',2,'Signs to look out for','Unexplained injuries, sudden changes in behaviour, fear of a particular person, or someone who seems withdrawn can all be signs. You do not need proof to raise a concern.'),
('00000000-0000-0000-0000-00000000a001',3,'Who to tell','Never investigate yourself. Write down what you saw or heard, in their words, and tell the charity''s safeguarding lead the same day. If someone is in immediate danger, call emergency services.'),
('00000000-0000-0000-0000-00000000a002',1,'Clean hands, clean space','Wash hands for 20 seconds before handling food and after touching bins, phones or raw items. Wipe surfaces before and after each task.'),
('00000000-0000-0000-0000-00000000a002',2,'Keep it cold, keep it hot','Chilled food stays below 5°C, hot food above 63°C. Check dates: "use by" is about safety, "best before" is about quality. Never pack food past its use-by date.'),
('00000000-0000-0000-0000-00000000a002',3,'Allergens','The 14 major allergens include nuts, milk, eggs, gluten and sesame. Keep labels on, never repack loose items, and tell a coordinator if packaging is damaged.'),
('00000000-0000-0000-0000-00000000a003',1,'Check for danger','Before helping, make sure you are safe. Then check if the person responds and is breathing normally.'),
('00000000-0000-0000-0000-00000000a003',2,'Call for help','Call emergency services early, or ask someone else to. Give a clear location and say what happened.'),
('00000000-0000-0000-0000-00000000a003',3,'Recovery position','If someone is breathing but unresponsive, roll them onto their side, tilt the head back and stay with them until help arrives.'),
('00000000-0000-0000-0000-00000000a004',1,'Think before you lift','Check the weight, the route and whether you need help. Clear the path first.'),
('00000000-0000-0000-0000-00000000a004',2,'Good lifting posture','Feet apart, bend your knees, keep the load close to your waist and avoid twisting.'),
('00000000-0000-0000-0000-00000000a004',3,'Team lifts','For heavy or awkward items, agree who leads and count down together.'),
('00000000-0000-0000-0000-00000000a005',1,'Personal data is personal','Names, addresses, health details and photos are all personal data. Only use them for the task you were given.'),
('00000000-0000-0000-0000-00000000a005',2,'Storing and sharing','Never take personal details home or share them in personal chats. Lock screens and shred paper lists.'),
('00000000-0000-0000-0000-00000000a005',3,'If something goes wrong','If data is lost or sent to the wrong person, tell the coordinator straight away. Fast reporting limits harm.');

insert into public.charity_programs (charity_id, course_id) values
('00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-00000000a002'),
('00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-00000000a004'),
('00000000-0000-0000-0000-00000000c003','00000000-0000-0000-0000-00000000a001'),
('00000000-0000-0000-0000-00000000c006','00000000-0000-0000-0000-00000000a002'),
('00000000-0000-0000-0000-00000000c006','00000000-0000-0000-0000-00000000a004'),
('00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000a003'),
('00000000-0000-0000-0000-00000000c005','00000000-0000-0000-0000-00000000a001'),
('00000000-0000-0000-0000-00000000c005','00000000-0000-0000-0000-00000000a005');

with t as (
  select i,
    ('00000000-0000-0000-0000-00000000c00' || ((i % 6) + 1))::uuid as cid,
    (i % 6) + 1 as k
  from generate_series(0, 29) i
)
insert into public.shifts (charity_id, title, description, starts_at, duration_hours, commitment, spots_total, spots_left, city, address, cause, logistics)
select cid,
  (array['Emergency kit packing','Saturday food parcel packing','Afternoon tea companion','Riverside litter pick','Teen coding club mentor','Evening meal service'])[k]
    || case when i >= 6 then ' #' || (i / 6 + 1) else '' end,
  (array['Pack go-bags for families displaced by the storm.','Sort donations and pack parcels for 200 families.','Chat, read and share tea with patients.','Clear the riverbank and plant bulbs.','Help teenagers build their first web app.','Serve hot meals and wash up.'])[k],
  date_trunc('hour', now()) + make_interval(days => (i % 14) + 1, hours => (array[9,10,14,10,17,18])[k] - extract(hour from now())::int),
  (array[3,2,2,3,2,3])[k],
  (array['one-off','2 hrs','weekly','one-off','weekly','2 hrs'])[k],
  (array[8,10,4,15,5,6])[k],
  greatest(1, (array[8,10,4,15,5,6])[k] - (i % 4)),
  (array['Harbourside','City Centre','Northside','Riverside','City Centre','Eastgate'])[k],
  (array['Pier 4 warehouse','12 Market Street','Northside Hospice, Elm Road','Riverside Park gate','Central Library, room 2','St Mark''s Hall'])[k],
  (array['Disaster response','Food','Health','Environment','Education','Housing'])[k],
  (array['Wear closed shoes. Ask for Sam at the loading door.','Use the side entrance. Aprons provided.','Sign in at reception. Bring ID.','Gloves and pickers provided. Meet at the gate.','Bring a laptop if you have one.','Meet in the kitchen. Hair tied back.'])[k]
from t;

insert into public.shift_requirements (shift_id, course_id)
select s.id, '00000000-0000-0000-0000-00000000a002'::uuid from public.shifts s
where s.charity_id in ('00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-00000000c006');
insert into public.shift_requirements (shift_id, course_id)
select s.id, '00000000-0000-0000-0000-00000000a001'::uuid from public.shifts s
where s.charity_id in ('00000000-0000-0000-0000-00000000c003','00000000-0000-0000-0000-00000000c005');
insert into public.shift_requirements (shift_id, course_id)
select s.id, '00000000-0000-0000-0000-00000000a004'::uuid from public.shifts s
where s.charity_id = '00000000-0000-0000-0000-00000000c001';

insert into public.chat_messages (shift_id, author_name, body, pinned)
select s.id, c.name, 'Where: ' || s.address || '. ' || s.logistics, true
from public.shifts s join public.charities c on c.id = s.charity_id;

insert into public.feature_flags (key, label) values ('learn_fast', 'Fast demo mode for trainings') on conflict do nothing;
