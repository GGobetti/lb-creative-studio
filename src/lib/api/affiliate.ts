export interface ProductPhoto {
  id: string;
  image_url: string;
  is_primary: boolean;
  position: number;
}

export interface ProductDetails {
  id: string;
  description: string | null;
  price: number;
  category: string | null;
  condition: 'new' | 'used' | null;
  payment_methods: Array<{ name: string; installments?: number }>;
  stock_quantity: number;
  sales_count: number;
  rating: number | null;
  rating_count: number;
}

export interface AffiliateProduct {
  id: string;
  admin_id: string;
  name: string;
  marketplace: 'mercado_livre' | 'shopee' | 'aliexpress' | 'amazon';
  affiliate_link: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  details: ProductDetails | null;
  photos: ProductPhoto[];
}

export async function fetchAffiliateProducts(
  marketplace?: string
): Promise<AffiliateProduct[]> {
  const url = new URL('/api/affiliate/products', window.location.origin);
  if (marketplace) {
    url.searchParams.set('marketplace', marketplace);
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch products');
  const { products } = await res.json();
  return products;
}

export async function fetchAffiliateProduct(id: string): Promise<AffiliateProduct> {
  const res = await fetch(`/api/affiliate/products/${id}`);
  if (!res.ok) throw new Error('Failed to fetch product');
  const { product } = await res.json();
  return product;
}

export async function createProduct(
  data: Omit<AffiliateProduct, 'id' | 'admin_id' | 'created_at' | 'updated_at' | 'details' | 'photos'>,
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
