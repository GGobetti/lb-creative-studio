-- Marketplace Credentials (OAuth tokens and API keys)
CREATE TABLE marketplace_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  user_id_marketplace VARCHAR(255),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(admin_id, marketplace)
);

-- RLS: Only admins can manage their credentials
ALTER TABLE marketplace_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_own_credentials" ON marketplace_credentials
  FOR ALL USING (auth.uid() = admin_id);

-- Index
CREATE INDEX idx_marketplace_credentials_admin ON marketplace_credentials(admin_id);
CREATE INDEX idx_marketplace_credentials_marketplace ON marketplace_credentials(marketplace);
