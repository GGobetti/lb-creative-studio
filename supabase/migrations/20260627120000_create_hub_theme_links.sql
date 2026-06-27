-- supabase/migrations/20260627120000_create_hub_theme_links.sql
CREATE TABLE IF NOT EXISTS hub_theme_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme TEXT NOT NULL CHECK (theme IN ('tutoriais', 'ia', 'calibracao', 'comunidade')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_hub_theme_links_theme ON hub_theme_links(theme);
CREATE INDEX idx_hub_theme_links_position ON hub_theme_links(position, theme);

-- Enable RLS if needed
ALTER TABLE hub_theme_links ENABLE ROW LEVEL SECURITY;

-- Policy: Only sysadmins can view/edit
CREATE POLICY "Admins can manage hub links"
  ON hub_theme_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'sysadmin'
    )
  );
