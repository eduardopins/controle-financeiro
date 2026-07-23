-- SCRIPT ÚNICO E COMPLETO — contém tudo que já construímos até agora, do zero.
-- Seguro rodar de uma vez só, mesmo que partes já tenham sido aplicadas antes
-- (todos os comandos são "se não existir" / substituem políticas antigas).
-- Depois de rodar, não precisa mais de nenhum outro arquivo .sql anterior.

-- ============ COLUNAS EM "expenses" ============
alter table expenses add column if not exists is_recurring boolean not null default false;
alter table expenses add column if not exists receipt_url text;
alter table expenses add column if not exists is_refund boolean not null default false;
alter table expenses add column if not exists created_by uuid references profiles(id);
alter table expenses add column if not exists split_group_id uuid;
alter table expenses add column if not exists reconciled boolean not null default false;
alter table expenses add column if not exists reconciled_by uuid references profiles(id);
alter table expenses add column if not exists reconciled_at timestamp;

-- ============ FOTO DE PERFIL ============
alter table profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "upload propria foto" on storage.objects;
create policy "upload propria foto" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "ver fotos" on storage.objects;
create policy "ver fotos" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "atualizar propria foto" on storage.objects;
create policy "atualizar propria foto" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "deletar propria foto" on storage.objects;
create policy "deletar propria foto" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Permite que cada pessoa edite o PRÓPRIO perfil (nome, foto etc.)
drop policy if exists "atualizar proprio perfil" on profiles;
create policy "atualizar proprio perfil" on profiles for update using (id = auth.uid())
  with check (id = auth.uid());

-- ============ METAS (individuais por pessoa) ============
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  category text not null,
  monthly_limit numeric not null,
  created_at timestamp default now()
);
alter table budgets add column if not exists profile_id uuid references profiles(id);
delete from budgets where profile_id is null;
alter table budgets alter column profile_id set not null;
alter table budgets enable row level security;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'budgets_profile_category_unique') then
    alter table budgets add constraint budgets_profile_category_unique unique (profile_id, category);
  end if;
end $$;

drop policy if exists "ver metas" on budgets;
drop policy if exists "gerenciar proprias metas" on budgets;
create policy "ver metas" on budgets for select using (
  profile_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "gerenciar proprias metas" on budgets for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ============ RECEITAS ============
create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  description text not null,
  amount numeric not null,
  income_date date not null,
  first_month text not null,
  is_recurring boolean not null default false,
  created_at timestamp default now()
);
alter table incomes enable row level security;
drop policy if exists "ver receitas" on incomes;
drop policy if exists "gerenciar proprias receitas" on incomes;
create policy "ver receitas" on incomes for select using (
  profile_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "gerenciar proprias receitas" on incomes for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ============ CATEGORIAS PERSONALIZADAS ============
create table if not exists custom_categories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  name text not null,
  created_at timestamp default now()
);
alter table custom_categories enable row level security;
drop policy if exists "ver categorias" on custom_categories;
drop policy if exists "gerenciar proprias categorias" on custom_categories;
create policy "ver categorias" on custom_categories for select using (
  profile_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "gerenciar proprias categorias" on custom_categories for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ============ COMPROVANTES (armazenamento) ============
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

drop policy if exists "upload proprio comprovante" on storage.objects;
create policy "upload proprio comprovante" on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "ver comprovantes" on storage.objects;
create policy "ver comprovantes" on storage.objects for select using (bucket_id = 'receipts');
drop policy if exists "deletar proprio comprovante" on storage.objects;
create policy "deletar proprio comprovante" on storage.objects for delete
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ ACESSO TEMPORÁRIO (removido) ============
alter table profiles drop column if exists is_guest;
alter table profiles drop column if exists guest_expires_at;

-- ============ CARTÕES: visibilidade ============
-- Libera ver o cartão se a pessoa tiver algum gasto atribuído a ela nele,
-- mesmo sem estar formalmente na lista de acesso (card_access).
drop policy if exists "ver cartoes" on cards;
create policy "ver cartoes" on cards for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or exists (select 1 from card_access where card_id = cards.id and profile_id = auth.uid())
  or exists (select 1 from expenses where expenses.card_id = cards.id and expenses.profile_id = auth.uid())
);

-- ============ GASTOS: ver / lançar / editar / excluir (permite cartão compartilhado) ============
-- IMPORTANTE: a pessoa sempre vê os PRÓPRIOS gastos (profile_id = auth.uid()),
-- tenha ela ou não acesso formal ao cartão onde o gasto foi lançado.
drop policy if exists "ver gastos" on expenses;
create policy "ver gastos" on expenses for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or profile_id = auth.uid()
  or exists (select 1 from card_access where card_id = expenses.card_id and profile_id = auth.uid())
);

drop policy if exists "lancar gastos" on expenses;
create policy "lancar gastos" on expenses for insert with check (
  profile_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or exists (
    select 1 from card_access ca1
    join card_access ca2 on ca1.card_id = ca2.card_id
    where ca1.profile_id = auth.uid() and ca2.profile_id = expenses.profile_id and ca1.card_id = expenses.card_id
  )
);

drop policy if exists "editar gastos" on expenses;
create policy "editar gastos" on expenses for update using (
  profile_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or exists (select 1 from card_access where card_id = expenses.card_id and profile_id = auth.uid())
);

drop policy if exists "excluir gastos" on expenses;
create policy "excluir gastos" on expenses for delete using (
  profile_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or exists (select 1 from card_access where card_id = expenses.card_id and profile_id = auth.uid())
);

-- ============ INVESTIMENTOS (caixinhas de renda fixa) ============
create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references profiles(id) not null,
  monthly_rate numeric,
  cdi_percent numeric,
  cdi_annual_rate numeric,
  created_at timestamp default now()
);
alter table investments add column if not exists cdi_percent numeric;
alter table investments add column if not exists cdi_annual_rate numeric;
alter table investments add column if not exists target_amount numeric;
alter table investments add column if not exists target_date date;

create table if not exists investment_access (
  investment_id uuid references investments(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  primary key (investment_id, profile_id)
);

create table if not exists investment_transactions (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid references investments(id) on delete cascade,
  profile_id uuid references profiles(id) not null,
  type text not null check (type in ('deposit', 'withdraw')),
  amount numeric not null,
  transaction_date date not null,
  description text,
  created_at timestamp default now()
);
alter table investment_transactions add column if not exists receipt_url text;
alter table investment_transactions add column if not exists is_recurring boolean not null default false;

alter table investments enable row level security;
alter table investment_access enable row level security;
alter table investment_transactions enable row level security;

-- Funções "de confiança" (security definer) que evitam a referência circular
-- entre as regras de "investments" e "investment_access" (que causava erro 500).
create or replace function is_investment_admin(uid uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = uid and role = 'admin');
$$;
create or replace function has_investment_access(inv_id uuid, uid uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from investment_access where investment_id = inv_id and profile_id = uid);
$$;

drop policy if exists "ver investimentos" on investments;
create policy "ver investimentos" on investments for select using (
  is_investment_admin(auth.uid())
  or created_by = auth.uid()
  or has_investment_access(id, auth.uid())
);
drop policy if exists "gerenciar investimentos" on investments;
create policy "gerenciar investimentos" on investments for all using (
  created_by = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
) with check (
  created_by = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "ver acesso investimento" on investment_access;
create policy "ver acesso investimento" on investment_access for select using (auth.uid() is not null);
drop policy if exists "gerenciar acesso investimento" on investment_access;
create policy "gerenciar acesso investimento" on investment_access for all using (
  exists (
    select 1 from investments
    where investments.id = investment_access.investment_id
      and (investments.created_by = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  )
);

drop policy if exists "ver transacoes investimento" on investment_transactions;
create policy "ver transacoes investimento" on investment_transactions for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or profile_id = auth.uid()
  or exists (select 1 from investments where investments.id = investment_transactions.investment_id and investments.created_by = auth.uid())
  or exists (select 1 from investment_access where investment_id = investment_transactions.investment_id and profile_id = auth.uid())
);
drop policy if exists "lancar transacao investimento" on investment_transactions;
create policy "lancar transacao investimento" on investment_transactions for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or exists (select 1 from investment_access where investment_id = investment_transactions.investment_id and profile_id = auth.uid())
  or exists (select 1 from investments where investments.id = investment_transactions.investment_id and investments.created_by = auth.uid())
);
drop policy if exists "excluir transacao investimento" on investment_transactions;
create policy "excluir transacao investimento" on investment_transactions for delete using (
  profile_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or exists (select 1 from investments where investments.id = investment_transactions.investment_id and investments.created_by = auth.uid())
);

-- ============ LOG DE NOTIFICAÇÕES POR E-MAIL ============
-- (só é usada se/quando você ativar o envio de e-mail via Edge Function; não atrapalha se não usar)
create table if not exists notifications_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  key text not null,
  sent_at timestamp default now(),
  unique (profile_id, key)
);
alter table notifications_log enable row level security;
drop policy if exists "acesso restrito ao log de notificacoes" on notifications_log;
create policy "acesso restrito ao log de notificacoes" on notifications_log for all using (false);

-- ============ HISTÓRICO DE EDIÇÕES (log de atividade, só admin vê no app) ============
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  action text not null,
  description text not null,
  created_at timestamp default now()
);
alter table activity_log enable row level security;
drop policy if exists "ver atividade" on activity_log;
create policy "ver atividade" on activity_log for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or profile_id = auth.uid()
);
drop policy if exists "registrar atividade" on activity_log;
create policy "registrar atividade" on activity_log for insert with check (profile_id = auth.uid());

-- ============ PAGAMENTO DE FATURA ============
-- Registra quando uma fatura foi paga (total ou parcial), por cartão e por mês.
-- O valor pago abate o limite usado do cartão; os gastos continuam aparecendo normalmente.
create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) not null,
  month_key text not null,
  amount numeric not null,
  paid_at date not null default current_date,
  profile_id uuid references profiles(id) not null,
  created_at timestamp default now()
);
alter table invoice_payments enable row level security;

drop policy if exists "ver pagamentos de fatura" on invoice_payments;
create policy "ver pagamentos de fatura" on invoice_payments for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  or exists (select 1 from card_access where card_id = invoice_payments.card_id and profile_id = auth.uid())
  or exists (select 1 from expenses where expenses.card_id = invoice_payments.card_id and expenses.profile_id = auth.uid())
);

drop policy if exists "admin gerencia pagamentos de fatura" on invoice_payments;
create policy "admin gerencia pagamentos de fatura" on invoice_payments for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
) with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ============ PERMISSÕES GERAIS ============
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- ============ FORÇA O CACHE DO SCHEMA A ATUALIZAR ============
notify pgrst, 'reload schema';
