-- ============================================================
-- LB Creative Studio — Migration: CRM and Quotations
-- ============================================================

-- 1. Adicionar settings_json à tabela user_pricing_settings
ALTER TABLE public.user_pricing_settings ADD COLUMN IF NOT EXISTS settings_json jsonb NOT NULL DEFAULT '{}';

-- 2. Criar tabela public.customers
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  telegram text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS em customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para customers
DROP POLICY IF EXISTS "customers: own all" ON public.customers;
CREATE POLICY "customers: own all"
  ON public.customers FOR ALL
  USING (auth.uid() = user_id);

-- 3. Criar tabela public.quotations
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]', -- Array: { name, weight_g, print_time_hours, calculated_price, quantity }
  discount numeric NOT NULL DEFAULT 0,
  total_value numeric NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS em quotations
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para quotations
DROP POLICY IF EXISTS "quotations: own all" ON public.quotations;
CREATE POLICY "quotations: own all"
  ON public.quotations FOR ALL
  USING (auth.uid() = user_id);

-- 4. Triggers para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_customer_updated ON public.customers;
CREATE TRIGGER on_customer_updated
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_quotation_updated ON public.quotations;
CREATE TRIGGER on_quotation_updated
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
