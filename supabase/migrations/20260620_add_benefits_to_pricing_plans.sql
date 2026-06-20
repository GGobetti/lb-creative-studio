-- Add benefits column to pricing_plans to store product benefits from Stripe
ALTER TABLE pricing_plans
ADD COLUMN benefits JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN pricing_plans.benefits IS 'Array of benefits for this plan, synced from Stripe product metadata';
