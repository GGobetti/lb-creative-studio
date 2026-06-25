/**
 * Mercado Livre integration utilities
 */

const ML_CLIENT_ID = process.env.MERCADO_LIVRE_CLIENT_ID!;
const ML_REDIRECT_URI = process.env.MERCADO_LIVRE_REDIRECT_URI!;

/**
 * Generate the authorization URL for OAuth flow
 */
export function generateMLAuthorizationUrl(): string {
  const params = new URLSearchParams({
    client_id: ML_CLIENT_ID,
    response_type: 'code',
    redirect_uri: ML_REDIRECT_URI,
  });

  return `https://auth.mercadolibre.com/authorization?${params.toString()}`;
}

/**
 * Fetch product data from Mercado Livre API using access token
 */
export async function fetchMLProductData(
  productId: string,
  accessToken: string
) {
  try {
    const response = await fetch(
      `https://api.mercadolibre.com/items/${productId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`ML API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Fetch ML Product Error]', error);
    throw error;
  }
}

/**
 * Resolve ML short URL to product ID
 * Mercado Livre short links redirect to the full item URL
 */
export async function resolveMLShortUrl(
  shortUrl: string
): Promise<string | null> {
  try {
    // Try to extract ID directly from any format
    const directMatch = shortUrl.match(/MLA\d+|MLB\d+|MLM\d+|MLV\d+/);
    if (directMatch) {
      return directMatch[0];
    }

    // Try to resolve short URL with fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(shortUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const urlString = response.url;
        // Extract item ID from URL: https://www.mercadolivre.com.br/...MLA123456789...
        const match = urlString.match(/MLA\d+|MLB\d+|MLM\d+|MLV\d+/);
        if (match) {
          return match[0];
        }
      }

      return null;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn('[ML URL Resolve] Timeout reaching URL');
      } else {
        console.warn('[ML URL Resolve] Fetch failed, trying alternative method');
      }
      return null;
    }
  } catch (error) {
    console.error('[Resolve Short URL Error]', error);
    return null;
  }
}

export interface MLProductResult {
  productBase: {
    name: string;
    marketplace: 'mercado_livre';
  };
  details: {
    description: string | null;
    price: number;
    category: string | null;
    condition: 'new' | 'used' | null;
    payment_methods: Array<{ name: string; installments?: number }>;
    stock_quantity: number;
    sales_count: number;
    rating: number | null;
    rating_count: number;
  };
  photos: Array<{
    url: string;
    source_id: string;
    is_primary: boolean;
  }>;
}

/**
 * Transform ML product data to our affiliate_products format
 */
export function transformMLProductData(mlData: any): MLProductResult {
  // Extract images
  const pictures = mlData.pictures || [];
  const photos = pictures.map((pic: any, index: number) => ({
    url: pic.secure_url || pic.url,
    source_id: pic.id || `ml_photo_${index}`,
    is_primary: index === 0,
  }));

  // Extract description (handle multiple descriptions)
  let description = '';
  if (mlData.descriptions && Array.isArray(mlData.descriptions)) {
    description = mlData.descriptions
      .map((d: any) => d.text || '')
      .filter((t: string) => t.length > 0)
      .join('\n\n');
  }
  if (!description && mlData.description) {
    description = mlData.description;
  }

  // Extract payment methods
  const paymentMethods: Array<{ name: string; installments?: number }> = [];
  if (mlData.payment_methods && Array.isArray(mlData.payment_methods)) {
    paymentMethods.push(
      ...mlData.payment_methods
        .filter((pm: any) => pm.id && pm.type)
        .map((pm: any) => ({
          name: pm.id.toUpperCase().replace(/_/g, ' '),
          installments: pm.additional_info?.max_allowed_installments,
        }))
    );
  }
  // Add common payment method names
  if (paymentMethods.length === 0) {
    paymentMethods.push(
      { name: 'Credit Card', installments: 12 },
      { name: 'Debit Card' },
      { name: 'Pix' }
    );
  }

  // Extract condition
  const condition: 'new' | 'used' | null = mlData.condition === 'used' ? 'used' : 'new';

  // Extract category (name from category_id if available)
  let category = mlData.category_name || mlData.category_id || null;

  // Extract ratings
  const rating = mlData.rating ? parseFloat(mlData.rating) : null;
  const ratingCount = mlData.rating_count || mlData.ratings_count || 0;

  // Extract stock
  const stockQuantity = mlData.available_quantity || 0;

  // Extract sales count
  const salesCount = mlData.sold_quantity || 0;

  // Price handling (use sale_price if available, otherwise price)
  const price = mlData.sale_price || mlData.price || 0;

  return {
    productBase: {
      name: mlData.title,
      marketplace: 'mercado_livre',
    },
    details: {
      description: description || null,
      price,
      category,
      condition,
      payment_methods: paymentMethods,
      stock_quantity: stockQuantity,
      sales_count: salesCount,
      rating,
      rating_count: ratingCount,
    },
    photos,
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshMLAccessToken(
  refreshToken: string,
  clientSecret: string
) {
  try {
    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: ML_CLIENT_ID,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Refresh Token Error]', error);
    throw error;
  }
}
