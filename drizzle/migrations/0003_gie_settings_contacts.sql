create table public.gie_settings (
  id int primary key default 1 check (id = 1),
  official_name text not null default 'GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL',
  slogan text not null default 'L''union fait la force – Solidarité, Discipline et Entraide',
  logo_data text,
  signature_data text,
  president_name text not null default 'Badara Ndiaye',
  whatsapp_phone text not null default '+221772060998',
  opening_hours text not null default '',
  updated_at timestamptz not null default now()
);
grant select on public.gie_settings to anon, authenticated;
grant update on public.gie_settings to authenticated;
grant all on public.gie_settings to service_role;
alter table public.gie_settings enable row level security;
create policy "public read settings" on public.gie_settings for select to anon, authenticated using (true);
create policy "admins update settings" on public.gie_settings for update to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','president','secretaire']::app_role[]));
insert into public.gie_settings (id) values (1);

create table public.gie_contacts (
  id uuid primary key default gen_random_uuid(),
  role_label text not null,
  person_name text,
  phone text not null,
  sort_order int not null default 0
);
grant select on public.gie_contacts to anon, authenticated;
grant insert, update, delete on public.gie_contacts to authenticated;
grant all on public.gie_contacts to service_role;
alter table public.gie_contacts enable row level security;
create policy "public read contacts" on public.gie_contacts for select to anon, authenticated using (true);
create policy "admins write contacts" on public.gie_contacts for all to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','president','secretaire']::app_role[]))
  with check (public.has_any_role(auth.uid(), array['super_admin','president','secretaire']::app_role[]));
insert into public.gie_contacts (role_label, person_name, phone, sort_order) values
  ('Le Président', 'Badara Ndiaye', '+221 77 206 09 98', 1),
  ('Le Secrétaire général', null, '+221 78 120 03 64', 2),
  ('Le Trésorier', null, '+221 77 642 19 14', 3);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 150),
  message text not null check (char_length(message) between 5 and 2000),
  created_at timestamptz not null default now()
);
grant insert on public.contact_messages to anon, authenticated;
grant select, delete on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;
alter table public.contact_messages enable row level security;
create policy "anyone sends" on public.contact_messages for insert to anon, authenticated with check (true);
create policy "staff read messages" on public.contact_messages for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff delete messages" on public.contact_messages for delete to authenticated using (public.is_staff(auth.uid()));

create or replace function public.verify_member(_matricule text)
returns table (matricule text, first_name text, last_name text, status text, join_date date)
language sql stable security definer set search_path = public as $$
  select matricule, first_name, last_name, status, join_date from public.drivers where upper(matricule) = upper(_matricule) limit 1
$$;
grant execute on function public.verify_member(text) to anon, authenticated;

create trigger audit_settings after update on public.gie_settings for each row execute function public.log_change();
create trigger audit_contacts after insert or update or delete on public.gie_contacts for each row execute function public.log_change();