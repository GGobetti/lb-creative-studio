-- Migration: Update Plans to Free, Pro, Max and configure limits

-- 1. Rename columns in feature_costs safely
ALTER TABLE public.feature_costs RENAME COLUMN cost_pro TO cost_max;
ALTER TABLE public.feature_costs RENAME COLUMN cost_basic TO cost_pro;

-- 2. Rename columns in catalog_items safely
ALTER TABLE public.catalog_items RENAME COLUMN price_pro TO price_max;
ALTER TABLE public.catalog_items RENAME COLUMN price_basic TO price_pro;

-- 3. Alter the check constraint on profiles.plan BEFORE updating records
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;

-- 4. Update existing user plans to the new names
-- We update 'pro' to 'max', then 'basic' to 'pro'
UPDATE public.profiles SET plan = 'max' WHERE plan = 'pro';
UPDATE public.profiles SET plan = 'pro' WHERE plan = 'basic';

-- 5. Add the new constraint back
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'pro', 'max'));

-- 5. Set default values for the new columns
ALTER TABLE public.feature_costs ALTER COLUMN cost_pro SET DEFAULT 0;
ALTER TABLE public.feature_costs ALTER COLUMN cost_max SET DEFAULT 0;

ALTER TABLE public.catalog_items ALTER COLUMN price_pro SET DEFAULT 1;
ALTER TABLE public.catalog_items ALTER COLUMN price_max SET DEFAULT 1;

-- 6. Insert default feature costs/limits
-- We use feature_costs table to also store numerical limits.
-- For crm_clients_limit, cost_free = 3 (limit 3), cost_pro = 9999 (unlimited), cost_max = 9999 (unlimited)
-- For download_stl, cost_free = 1 (1 credit), cost_pro = 1 (1 credit), cost_max = 0 (free)
INSERT INTO public.feature_costs (feature_key, display_name, cost_free, cost_pro, cost_max) 
VALUES
('crm_clients_limit', 'Limite de Clientes no CRM', 3, 9999, 9999),
('download_stl', 'Download de STL do Catálogo', 1, 1, 0)
ON CONFLICT (feature_key) DO UPDATE SET
  cost_free = EXCLUDED.cost_free,
  cost_pro = EXCLUDED.cost_pro,
  cost_max = EXCLUDED.cost_max;
