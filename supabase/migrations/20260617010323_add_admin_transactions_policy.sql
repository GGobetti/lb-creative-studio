-- ============================================================
-- Migração: Liberar acesso às transações para Sysadmins
-- Criado em: 17 de Junho de 2026
-- ============================================================

-- Adiciona a política para que usuários com a role 'sysadmin' consigam ver todas as transações
create policy "transactions: admin all"
  on public.transactions for all
  using (public.is_admin());
