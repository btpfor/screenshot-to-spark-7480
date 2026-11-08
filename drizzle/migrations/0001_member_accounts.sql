alter table public.drivers add column user_id uuid unique;
alter table public.drivers add column must_change_password boolean not null default true;
alter table public.drivers add column last_login_at timestamptz;
alter table public.drivers add column account_status text not null default 'actif';
alter table public.drivers add column allow_shared_phone boolean not null default false;
alter table public.drivers alter column matricule set default ('BGG-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.driver_matricule_seq')::text, 4, '0'));
create unique index drivers_phone_unique on public.drivers (phone) where allow_shared_phone = false;
create unique index drivers_matricule_ci on public.drivers (upper(matricule));

drop policy "staff read drivers" on public.drivers;
create policy "staff or self read drivers" on public.drivers for select to authenticated
  using (public.is_staff(auth.uid()) or user_id = auth.uid());

drop policy "read vehicles" on public.vehicles;
create policy "read vehicles" on public.vehicles for select to authenticated
  using (public.is_staff(auth.uid()) or driver_id in (select id from public.drivers where user_id = auth.uid()));
drop policy "read transactions" on public.transactions;
create policy "read transactions" on public.transactions for select to authenticated
  using (public.is_staff(auth.uid()) or driver_id in (select id from public.drivers where user_id = auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_app_meta_data->>'gie_role','') = 'chauffeur' then
    insert into public.user_roles(user_id, role) values (new.id, 'chauffeur') on conflict do nothing;
  end if;
  return new;
end $$;

create or replace function public.update_my_contact(_phone text, _address text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.drivers set address = _address, updated_at = now() where user_id = auth.uid();
end $$;

create or replace function public.mark_password_changed()
returns void language sql security definer set search_path = public as $$
  update public.drivers set must_change_password = false where user_id = auth.uid();
$$;

create table public.login_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
grant select on public.login_log to authenticated;
grant all on public.login_log to service_role;
alter table public.login_log enable row level security;
create policy "admins read logins" on public.login_log for select to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','president']::app_role[]));

create or replace function public.record_login()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.login_log(user_id) values (auth.uid());
  update public.drivers set last_login_at = now() where user_id = auth.uid();
end $$;

create policy "public read photos" on storage.objects for select using (bucket_id = 'photos');
create policy "staff upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_staff(auth.uid()));
create policy "staff update photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_staff(auth.uid()));