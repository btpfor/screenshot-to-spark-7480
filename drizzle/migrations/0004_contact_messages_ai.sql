alter table public.contact_messages add column ai_summary text;
alter table public.contact_messages add column ai_category text;
alter table public.contact_messages add column ai_draft text;
alter table public.contact_messages add column ai_generated_at timestamptz;
alter table public.contact_messages add column handled boolean not null default false;
alter table public.contact_messages add column source text not null default 'formulaire';
grant update on public.contact_messages to authenticated;
create policy "staff update messages" on public.contact_messages for update to authenticated using (public.is_staff(auth.uid()));