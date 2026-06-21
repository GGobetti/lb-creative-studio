-- Affiliate Products
CREATE TABLE affiliate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT NOT NULL,
  affiliate_link TEXT NOT NULL,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('aliexpress', 'shopee', 'mercado_livre', 'amazon')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(affiliate_link)
);

-- Affiliate Clicks (analytics)
CREATE TABLE affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES affiliate_products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clicked_at TIMESTAMP DEFAULT now(),
  referer_path TEXT
);

-- RLS: Products
ALTER TABLE affiliate_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_active_products" ON affiliate_products
  FOR SELECT USING (is_active = TRUE OR auth.uid() = admin_id);

CREATE POLICY "admin_manage_all_products" ON affiliate_products
  FOR ALL USING (auth.uid() = admin_id);

-- RLS: Clicks (admin read, all inserts logged)
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_clicks" ON affiliate_clicks
  FOR SELECT USING (public.is_admin());

CREATE POLICY "anyone_can_log_click" ON affiliate_clicks
  FOR INSERT WITH CHECK (TRUE);

-- Indexes
CREATE INDEX idx_affiliate_products_active ON affiliate_products(is_active);
CREATE INDEX idx_affiliate_products_marketplace ON affiliate_products(marketplace);
CREATE INDEX idx_affiliate_clicks_product ON affiliate_clicks(product_id);
CREATE INDEX idx_affiliate_clicks_user ON affiliate_clicks(user_id);
CREATE INDEX idx_affiliate_clicks_timestamp ON affiliate_clicks(clicked_at);
