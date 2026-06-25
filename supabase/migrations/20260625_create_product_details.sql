CREATE TABLE IF NOT EXISTS affiliate_product_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES affiliate_products(id) ON DELETE CASCADE,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(255),
  condition VARCHAR(50),
  payment_methods JSONB,
  stock_quantity INT,
  sales_count INT DEFAULT 0,
  rating DECIMAL(2, 1),
  rating_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_details_product_id
  ON affiliate_product_details(product_id);

ALTER TABLE affiliate_product_details ENABLE ROW LEVEL SECURITY;
