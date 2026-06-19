-- ============================================================
-- Migração: Correção da função public.is_admin()
-- Garante o uso de SECURITY DEFINER para evitar problemas de RLS
-- ============================================================

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  is_sysadmin boolean;
begin
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'sysadmin'
  ) into is_sysadmin;
  
  return coalesce(is_sysadmin, false);
end;
$$;
