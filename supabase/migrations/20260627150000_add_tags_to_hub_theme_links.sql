ALTER TABLE hub_theme_links ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
