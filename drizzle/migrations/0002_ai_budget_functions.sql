
create or replace function public.reserve_ai_budget(_amount numeric, _share numeric) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into ai_budget (day) values (current_date) on conflict (day) do nothing;
  update ai_budget set reserved_usd = reserved_usd + _amount
   where day = current_date and spent_usd + reserved_usd + _amount <= cap_usd * _share;
  return found;
end; $$;

create or replace function public.settle_ai_budget(_reserved numeric, _actual numeric) returns void
language sql security definer set search_path = public as $$
  update ai_budget set reserved_usd = greatest(0, reserved_usd - _reserved), spent_usd = spent_usd + _actual where day = current_date;
$$;

revoke execute on function public.reserve_ai_budget, public.settle_ai_budget from public, anon, authenticated;
grant execute on function public.reserve_ai_budget, public.settle_ai_budget to service_role;

grant select on public.ai_budget to authenticated;
create policy "Admins read budget" on public.ai_budget for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins read all roles rows" on public.profiles for select to anon using (false);
