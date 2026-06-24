export interface AffiliateProduct {
  id: string;
  admin_id: string;
  name: string;
  description?: string;
  price: number;
  image_url: string;
  affiliate_link: string;
  marketplace: 'aliexpress' | 'shopee' | 'mercado_livre' | 'amazon';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchAffiliateProducts(): Promise<AffiliateProduct[]> {
  const res = await fetch('/api/affiliate/products');
  if (!res.ok) throw new Error('Failed to fetch products');
  const { products } = await res.json();
  return products;
}

export async function createProduct(
  data: Omit<AffiliateProduct, 'id' | 'admin_id' | 'created_at' | 'updated_at'>,
  token: string
): Promise<AffiliateProduct> {
  const res = await fetch('/api/affiliate/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create product');
  const { product } = await res.json();
  return product;
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<AffiliateProduct, 'id' | 'admin_id' | 'created_at' | 'updated_at'>>,
  token: string
): Promise<AffiliateProduct> {
  const res = await fetch(`/api/affiliate/products/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update product');
  const { product } = await res.json();
  return product;
}

export async function deleteProduct(
  id: string,
  token: string
): Promise<void> {
  const res = await fetch(`/api/affiliate/products/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error('Failed to delete product');
}

export async function trackClick(
  product_id: string,
  token?: string
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  await fetch('/api/affiliate/track-click', {
    method: 'POST',
    headers,
    body: JSON.stringify({ product_id }),
  }).catch(() => {}) // Fail silently
}
