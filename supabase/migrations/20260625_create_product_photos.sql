CREATE TABLE IF NOT EXISTS affiliate_product_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES affiliate_products(id) ON DELETE CASCADE,
  image_url VARCHAR(2048) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  position INT DEFAULT 0,
  source_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_photos_product_id
  ON affiliate_product_photos(product_id);
CREATE INDEX IF NOT EXISTS idx_product_photos_source_id
  ON affiliate_product_photos(source_id);

ALTER TABLE affiliate_product_photos ENABLE ROW LEVEL SECURITY;
