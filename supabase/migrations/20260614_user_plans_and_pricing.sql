-- ============================================================
-- LB Creative Studio — Migration: User Plans and Feature Pricing
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Alter profiles role check constraint to support 'sysadmin' instead of 'admin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'sysadmin'));

-- Update existing profiles from 'admin' to 'sysadmin'
UPDATE public.profiles SET role = 'sysadmin' WHERE role = 'admin';

-- Re-create is_admin function to check for 'sysadmin'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN exists (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() and role = 'sysadmin'
  );
END;
$$;

-- 2. Add 'plan' column to public.profiles table
ALTER TABLE public.profiles 
ADD COLUMN plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro'));

-- 3. Create public.feature_costs table
CREATE TABLE public.feature_costs (
  feature_key text PRIMARY KEY,
  display_name text NOT NULL,
  cost_free int NOT NULL DEFAULT 0 CHECK (cost_free >= 0),
  cost_basic int NOT NULL DEFAULT 0 CHECK (cost_basic >= 0),
  cost_pro int NOT NULL DEFAULT 0 CHECK (cost_pro >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on feature_costs
ALTER TABLE public.feature_costs ENABLE ROW LEVEL SECURITY;

-- Read policy: Any authenticated user can read costs
CREATE POLICY "feature_costs: read all" 
  ON public.feature_costs FOR SELECT 
  TO authenticated 
  USING (true);

-- Write/All policy: Only admins can manage costs
CREATE POLICY "feature_costs: admin all" 
  ON public.feature_costs FOR ALL 
  USING (public.is_admin());

-- Seed default costs for features
INSERT INTO public.feature_costs (feature_key, display_name, cost_free, cost_basic, cost_pro) VALUES
('import_makerworld', 'Importar do MakerWorld', 2, 1, 0),
('telegram_search', 'Busca e Download no Telegram', 1, 0, 0)
ON CONFLICT (feature_key) DO UPDATE SET
  cost_free = EXCLUDED.cost_free,
  cost_basic = EXCLUDED.cost_basic,
  cost_pro = EXCLUDED.cost_pro;

-- 4. Add pricing columns to public.catalog_items
ALTER TABLE public.catalog_items ADD COLUMN price_free int NOT NULL DEFAULT 2 CHECK (price_free >= 0);
ALTER TABLE public.catalog_items ADD COLUMN price_basic int NOT NULL DEFAULT 1 CHECK (price_basic >= 0);
ALTER TABLE public.catalog_items ADD COLUMN price_pro int NOT NULL DEFAULT 1 CHECK (price_pro >= 0);

-- Update existing catalog items with default rules
UPDATE public.catalog_items 
SET price_free = 2, price_basic = 1, price_pro = 1 
WHERE title IN ('Placa Personalizada', 'Chaveiro');

UPDATE public.catalog_items 
SET price_free = 4, price_basic = 2, price_pro = 1 
WHERE title = 'Cortador de Biscoito';
