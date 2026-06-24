-- Marca registros importados localmente (não do Telegram)
-- para que o backfill ignore tentar buscar no Vault

ALTER TABLE public.telegram_indexed_stls
  ADD COLUMN IF NOT EXISTS is_local_import BOOLEAN NOT NULL DEFAULT false;

-- Marcar os modelos N3D importados como locais (telegram_message_id = 0)
UPDATE public.telegram_indexed_stls
SET is_local_import = true
WHERE telegram_message_id = 0
  AND telegram_group_id = '-1004497395268'
  AND telegram_group_name = 'LB Creative Studio CENTRAL';

COMMENT ON COLUMN public.telegram_indexed_stls.is_local_import IS
  'true = arquivo importado localmente (R2), false = do Telegram Vault (legado)';
