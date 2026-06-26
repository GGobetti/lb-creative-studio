-- Adiciona coluna categories[] à tabela telegram_indexed_stls
-- Esta é a fonte canônica de categorias para busca/filtro
ALTER TABLE public.telegram_indexed_stls
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}';

-- GIN index para filtro eficiente por categoria
CREATE INDEX IF NOT EXISTS telegram_indexed_stls_categories_idx
  ON public.telegram_indexed_stls USING GIN (categories);
