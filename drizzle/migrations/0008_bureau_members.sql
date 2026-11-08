create table public.bureau_members (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  role_label text not null,
  phone text,
  photo_path text,
  sort_order int not null default 0,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

grant select on public.bureau_members to anon;
grant select, insert, update, delete on public.bureau_members to authenticated;
grant all on public.bureau_members to service_role;

alter table public.bureau_members enable row level security;

create policy "bureau_public_read" on public.bureau_members for select to anon using (published);
create policy "bureau_staff_read" on public.bureau_members for select to authenticated using (public.is_staff(auth.uid()));
create policy "bureau_staff_insert" on public.bureau_members for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "bureau_staff_update" on public.bureau_members for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "bureau_staff_delete" on public.bureau_members for delete to authenticated using (public.is_staff(auth.uid()));

create trigger audit_bureau after insert or update or delete on public.bureau_members for each row execute function log_change();

create table public.bureau_settings (
  id int primary key default 1 check (id = 1),
  group_photo_path text,
  updated_at timestamptz not null default now()
);

grant select on public.bureau_settings to anon;
grant select, update on public.bureau_settings to authenticated;
grant all on public.bureau_settings to service_role;

alter table public.bureau_settings enable row level security;

create policy "bureau_settings_public_read" on public.bureau_settings for select to anon using (true);
create policy "bureau_settings_staff_update" on public.bureau_settings for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

insert into public.bureau_settings (id, group_photo_path) values (1, '/__l5e/assets-v1/b8e328f0-f018-4552-9021-2360289d2fb3/bureau-groupe.png');

insert into public.bureau_members (full_name, role_label, phone, sort_order) values
  ('Badara Ndiaye', 'Président', '+221 77 206 09 98', 1),
  (null, 'Secrétaire général', '+221 78 120 03 64', 2),
  (null, 'Trésorier', '+221 77 642 19 14', 3);