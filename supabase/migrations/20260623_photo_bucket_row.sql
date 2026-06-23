-- Cria a linha-sentinel "Caixinha de Fotos" usada pelo curador de fotos.
-- UUID fixo = 00000000-0000-0000-0000-000000000000
-- Fotos são movidas pra cá quando o curador não sabe a qual arquivo elas pertencem.
-- A linha é filtrada de todos os listings normais da plataforma.

INSERT INTO public.telegram_indexed_stls (
  id,
  title,
  telegram_group_id,
  telegram_group_name,
  telegram_message_id,
  file_name,
  file_size_bytes,
  photos
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Caixinha de Fotos',
  '__bucket__',
  '__bucket__',
  0,
  '__photo_bucket__',
  0,
  ARRAY[]::text[]
) ON CONFLICT (id) DO NOTHING;
