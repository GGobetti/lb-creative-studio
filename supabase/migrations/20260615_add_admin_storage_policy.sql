-- ============================================================
-- Migração: Permissões de Admin para o Storage Bucket 'portfolio'
-- Permite que administradores (sysadmin) gerenciem imagens manuais do Telegram
-- ============================================================

-- 1. Política de Inserção (Upload) para admins no bucket 'portfolio'
drop policy if exists "Admins can upload any portfolio images" on storage.objects;
create policy "Admins can upload any portfolio images"
  on storage.objects for insert
  with check (bucket_id = 'portfolio' and public.is_admin());

-- 2. Política de Atualização (Update) para admins no bucket 'portfolio'
drop policy if exists "Admins can update any portfolio images" on storage.objects;
create policy "Admins can update any portfolio images"
  on storage.objects for update
  using (bucket_id = 'portfolio' and public.is_admin());

-- 3. Política de Deleção (Delete) para admins no bucket 'portfolio'
drop policy if exists "Admins can delete any portfolio images" on storage.objects;
create policy "Admins can delete any portfolio images"
  on storage.objects for delete
  using (bucket_id = 'portfolio' and public.is_admin());
