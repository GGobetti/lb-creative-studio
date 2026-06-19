-- ============================================================
-- Migração: Sistema de Chamados de Suporte e Mensagens
-- Criado em: 15 de Junho de 2026
-- ============================================================

-- ----------------------------------------------------------------
-- 1. SUPPORT TICKETS
-- ----------------------------------------------------------------
create table if not exists public.support_tickets (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  title          text        not null,
  description    text        not null,
  category       text        not null check (category in ('request_stl', 'stl_adjustment', 'other')),
  status         text        not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  attachment_url text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

-- Policies for support_tickets
create policy "support_tickets: own select"
  on public.support_tickets for select
  using (auth.uid() = user_id);

create policy "support_tickets: own insert"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

create policy "support_tickets: own update"
  on public.support_tickets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status in ('open', 'closed'));

create policy "support_tickets: admin all"
  on public.support_tickets for all
  using (public.is_admin());

-- ----------------------------------------------------------------
-- 2. TICKET MESSAGES
-- ----------------------------------------------------------------
create table if not exists public.ticket_messages (
  id         uuid        primary key default gen_random_uuid(),
  ticket_id  uuid        not null references public.support_tickets(id) on delete cascade,
  sender_id  uuid        not null references public.profiles(id) on delete cascade,
  message    text        not null,
  created_at timestamptz not null default now()
);

alter table public.ticket_messages enable row level security;

-- Policies for ticket_messages
create policy "ticket_messages: select"
  on public.ticket_messages for select
  using (
    exists (
      select 1 from public.support_tickets
      where support_tickets.id = ticket_messages.ticket_id
      and (support_tickets.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "ticket_messages: insert"
  on public.ticket_messages for insert
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.support_tickets
      where support_tickets.id = ticket_messages.ticket_id
      and (support_tickets.user_id = auth.uid() or public.is_admin())
    )
  );

-- ----------------------------------------------------------------
-- 3. STORAGE BUCKET FOR ATTACHMENTS
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', true)
on conflict (id) do nothing;

-- Storage policies
create policy "ticket-attachments: public select"
  on storage.objects for select
  using (bucket_id = 'ticket-attachments');

create policy "ticket-attachments: own upload"
  on storage.objects for insert
  with check (bucket_id = 'ticket-attachments' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "ticket-attachments: own update"
  on storage.objects for update
  with check (bucket_id = 'ticket-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
