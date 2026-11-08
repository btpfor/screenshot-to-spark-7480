create type public.app_role as enum ('super_admin','president','secretaire','tresorier','resp_chauffeurs','resp_parc','resp_partenariats','chauffeur');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.has_any_role(_user_id uuid, _roles app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles))
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role <> 'chauffeur')
$$;

create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "super admin manages roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

-- first user becomes super admin, others chauffeur
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'super_admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'super_admin');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'chauffeur');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create sequence public.driver_matricule_seq start 1;

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  matricule text not null unique default ('GIE-' || lpad(nextval('public.driver_matricule_seq')::text, 4, '0')),
  first_name text not null,
  last_name text not null,
  email text,
  phone text not null,
  birth_date date,
  address text,
  cni_number text,
  join_date date not null default current_date,
  status text not null default 'actif' check (status in ('actif','inactif','suspendu')),
  driver_type text not null default 'titulaire',
  platform text not null default 'Yango',
  license_number text,
  license_expiry date,
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drivers_email_idx on public.drivers (lower(email));
grant select, insert, update, delete on public.drivers to authenticated;
grant all on public.drivers to service_role;
alter table public.drivers enable row level security;

create policy "staff read drivers" on public.drivers for select to authenticated
  using (public.is_staff(auth.uid()) or lower(email) = lower(auth.jwt()->>'email'));
create policy "managers write drivers" on public.drivers for insert to authenticated
  with check (public.has_any_role(auth.uid(), array['super_admin','president','secretaire','resp_chauffeurs']::app_role[]));
create policy "managers update drivers" on public.drivers for update to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','president','secretaire','resp_chauffeurs']::app_role[]));
create policy "admin delete drivers" on public.drivers for delete to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','president']::app_role[]));

-- driver may update their own phone/address only
create or replace function public.update_my_contact(_phone text, _address text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.drivers set phone = coalesce(nullif(_phone,''), phone), address = _address, updated_at = now()
  where lower(email) = lower(auth.jwt()->>'email');
end $$;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  year int,
  plate text not null unique,
  color text,
  chassis_number text,
  fuel_type text default 'Essence',
  acquisition_date date,
  owner_name text,
  driver_id uuid references public.drivers(id) on delete set null,
  insurance_expiry date,
  inspection_expiry date,
  next_maintenance date,
  status text not null default 'disponible' check (status in ('disponible','en_circulation','maintenance','immobilise','financement','vendu')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;
create policy "read vehicles" on public.vehicles for select to authenticated
  using (public.is_staff(auth.uid()) or driver_id in (select id from public.drivers where lower(email) = lower(auth.jwt()->>'email')));
create policy "parc writes vehicles" on public.vehicles for insert to authenticated
  with check (public.has_any_role(auth.uid(), array['super_admin','president','resp_parc']::app_role[]));
create policy "parc updates vehicles" on public.vehicles for update to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','president','resp_parc']::app_role[]));
create policy "parc deletes vehicles" on public.vehicles for delete to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','president','resp_parc']::app_role[]));

create sequence public.receipt_seq start 1;
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique default ('REC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 5, '0')),
  kind text not null check (kind in ('cotisation_mensuelle','contribution_exceptionnelle','recette','depense','dette')),
  driver_id uuid references public.drivers(id) on delete set null,
  amount numeric(14,0) not null check (amount > 0),
  period text,
  payment_method text not null default 'especes',
  description text,
  paid_at date not null default current_date,
  status text not null default 'paye' check (status in ('paye','impaye')),
  recorded_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "read transactions" on public.transactions for select to authenticated
  using (public.is_staff(auth.uid()) or driver_id in (select id from public.drivers where lower(email) = lower(auth.jwt()->>'email')));
create policy "treasurer insert" on public.transactions for insert to authenticated
  with check (public.has_any_role(auth.uid(), array['super_admin','president','tresorier']::app_role[]));
create policy "treasurer update" on public.transactions for update to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','tresorier']::app_role[]));
create policy "treasurer delete" on public.transactions for delete to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','tresorier']::app_role[]));

create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admins read audit" on public.audit_log for select to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','president']::app_role[]));

create or replace function public.log_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(user_id, action, table_name, record_id)
  values (auth.uid(), tg_op, tg_table_name, coalesce(new.id, old.id)::text);
  return coalesce(new, old);
end $$;
create trigger audit_drivers after insert or update or delete on public.drivers for each row execute function public.log_change();
create trigger audit_vehicles after insert or update or delete on public.vehicles for each row execute function public.log_change();
create trigger audit_transactions after insert or update or delete on public.transactions for each row execute function public.log_change();
create trigger audit_roles after insert or update or delete on public.user_roles for each row execute function public.log_change();