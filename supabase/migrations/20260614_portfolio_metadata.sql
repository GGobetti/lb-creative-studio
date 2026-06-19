-- ============================================================
-- LB Creative Studio — Migration: Portfolio Metadata & Storage
-- ============================================================

-- 1. Adicionar coluna metadata na tabela portfolio_items se não existir
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Criar bucket de storage 'portfolio' para upload de imagens de produtos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar políticas de acesso ao bucket 'portfolio'
-- Remover políticas existentes caso estejam sendo recriadas
DROP POLICY IF EXISTS "Portfolio images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own portfolio images." ON storage.objects;
DROP POLICY IF EXISTS "Users can update/delete their own portfolio images." ON storage.objects;

-- Select público para qualquer imagem do bucket
CREATE POLICY "Portfolio images are publicly accessible." 
ON storage.objects FOR SELECT 
USING (bucket_id = 'portfolio');

-- Upload permitido para usuários autenticados, sob a pasta com o seu próprio user_id
CREATE POLICY "Users can upload their own portfolio images." 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Update/Delete permitido apenas para o dono do arquivo
CREATE POLICY "Users can update/delete their own portfolio images." 
ON storage.objects FOR ALL 
TO authenticated
USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Notificar PostgREST para recarregar o cache do schema e reconhecer a nova coluna imediatamente
NOTIFY pgrst, 'reload schema';
