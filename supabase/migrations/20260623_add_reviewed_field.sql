-- Adiciona campo para rastrear quais STLs foram validados no curador de fotos
ALTER TABLE public.telegram_indexed_stls
ADD COLUMN reviewed_at TIMESTAMPTZ DEFAULT NULL;

-- Index pra filtrar rapidinho
CREATE INDEX idx_telegram_indexed_stls_reviewed_at ON public.telegram_indexed_stls(reviewed_at);
