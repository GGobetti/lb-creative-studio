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
 * Extract the specific item ID from affiliate link (what the link actually points to)
 * Links have pdp_filters=item_id%3AMLB... or wid=MLB... parameters
 */
export function extractTargetItemId(affiliateLink: string): string | null {
  // Try pdp_filters=item_id%3AMLB... format
  const pdpMatch = affiliateLink.match(/pdp_filters=item_id%3A(MLB\d+)/);
  if (pdpMatch) return pdpMatch[1];

  // Try wid=MLB... format (widget ID, the specific item being recommended)
  const widMatch = affiliateLink.match(/[&?]wid=(MLB\d+)/);
  if (widMatch) return widMatch[1];

  return null;
}

/**
 * Fetch product data from Mercado Livre API using access token
 */
export async function fetchMLProductData(
  productId: string,
  accessToken?: string
) {
  try {
    const headers: Record<string, string> = {
      'accept': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // MLBU = Unified Product (ML Brasil Unified) — skip /items/, go straight to /products/
    // Also try stripping the U: MLBU4014275688 → MLB4014275688 as fallback catalog ID
    const isUnified = productId.startsWith('MLBU');
    let itemsStatus = 'skipped';

    if (!isUnified) {
      // Try /items/ first (regular listings)
      const itemsResponse = await fetch(
        `https://api.mercadolibre.com/items/${productId}`,
        { headers }
      );
      itemsStatus = String(itemsResponse.status);

      if (itemsResponse.ok) {
        const data = await itemsResponse.json();
        console.log('[ML API] Found as item:', productId);
        return { ...data, _source: 'items' };
      }

      console.log(`[ML API] /items/ returned ${itemsResponse.status}, trying /products/...`);
    } else {
      console.log(`[ML API] Unified product ${productId}, skipping /items/ and going to /products/...`);
    }

    // Try /products/ for catalog products and unified products
    // For MLBU: try both MLBU4014275688 and MLB4014275688 (without U)
    const productCandidates = isUnified
      ? [productId, productId.replace('MLBU', 'MLB')]
      : [productId];

    let productsResponse: Response | null = null;
    let usedProductId = productId;

    for (const candidate of productCandidates) {
      const resp = await fetch(
        `https://api.mercadolibre.com/products/${candidate}`,
        { headers }
      );
      if (resp.ok) {
        productsResponse = resp;
        usedProductId = candidate;
        console.log(`[ML API] Found catalog product with ID: ${candidate}`);
        break;
      }
      console.log(`[ML API] /products/${candidate} returned ${resp.status}`);
    }

    if (productsResponse !== null) {
      const data = await productsResponse.json();
      const bbw = data.buy_box_winner;
      console.log('[ML API] Catalog product buy_box_winner:', JSON.stringify(bbw));

      // Strategy 1: fetch item directly from buy_box_winner
      const itemId = bbw?.item_id;
      if (itemId) {
        try {
          const itemResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, { headers });
          if (itemResponse.ok) {
            const itemData = await itemResponse.json();
            console.log('[ML API] buy_box item price:', itemData.price, 'stock:', itemData.available_quantity);
            return {
              ...data,
              _source: 'products',
              price: itemData.sale_price || itemData.price || 0,
              available_quantity: itemData.available_quantity > 0 ? itemData.available_quantity : 1,
              sold_quantity: itemData.sold_quantity || 0,
              condition: itemData.condition || 'new',
            };
          }
        } catch (e) {
          console.warn('[ML API] Could not fetch buy_box item:', e);
        }
      }

      // Strategy 2: search for items linked to this catalog product
      try {
        const itemsResponse = await fetch(
          `https://api.mercadolibre.com/products/${usedProductId}/items?limit=1`,
          { headers }
        );
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          const firstItem = itemsData.results?.[0] || itemsData[0];
          console.log('[ML API] /products/items result:', JSON.stringify(firstItem)?.substring(0, 200));
          if (firstItem?.price) {
            return {
              ...data,
              _source: 'products',
              price: firstItem.sale_price || firstItem.price,
              available_quantity: firstItem.available_quantity > 0 ? firstItem.available_quantity : 1,
              sold_quantity: firstItem.sold_quantity || 0,
            };
          }
        }
      } catch (e) {
        console.warn('[ML API] /products/items failed:', e);
      }

      // Strategy 3: search by ID text
      try {
        const searchResponse = await fetch(
          `https://api.mercadolibre.com/sites/MLB/search?q=${productId}&limit=1`,
          { headers }
        );
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const result = searchData.results?.[0];
          console.log('[ML API] search result price:', result?.price, 'stock:', result?.available_quantity);
          if (result?.price) {
            return {
              ...data,
              _source: 'products',
              price: result.sale_price || result.price,
              available_quantity: result.available_quantity > 0 ? result.available_quantity : 1,
              sold_quantity: result.sold_quantity || 0,
            };
          }
        }
      } catch (e) {
        console.warn('[ML API] search fallback failed:', e);
      }

      // Last resort: use whatever price exists in catalog data
      const fallbackPrice = bbw?.price || data.price || 0;
      console.log('[ML API] Using fallback price:', fallbackPrice);
      return { ...data, _source: 'products', price: fallbackPrice, available_quantity: 1 };
    }

    throw new Error(`ML API error: product ${productId} not found (items: ${itemsStatus}, products: not found)`);
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
    // Check for unified product (MLBU) in URL path: /up/MLBU4014275688
    // Must check BEFORE generic MLB regex (which won't match MLBU but finds wid=MLB... in query)
    const unifiedMatch = shortUrl.match(/\/up\/(MLBU\d+)/);
    if (unifiedMatch) {
      console.log('[ML Resolve] Found unified product ID:', unifiedMatch[1]);
      return unifiedMatch[1];
    }

    // Try to extract internal ML ID directly (MLA/MLB/MLM/MLV format)
    const directMatch = shortUrl.match(/MLA\d+|MLB\d+|MLM\d+|MLV\d+/);
    if (directMatch) {
      console.log('[ML Resolve] Found direct product ID:', directMatch[0]);
      return directMatch[0];
    }

    // Try to extract affiliate ID (KTXFEU-ACQ3 format) — must NOT start with ML country prefix
    const affiliateMatch = shortUrl.match(/(?<![A-Z])([A-Z0-9]{4,}-[A-Z0-9]+)/);
    if (affiliateMatch) {
      const affiliateId = affiliateMatch[1];
      // If it looks like MLB-digits, strip the dash (URL encoding artifact)
      const cleanId = affiliateId.replace(/^(ML[A-Z])-(\d+)$/, '$1$2');
      if (cleanId !== affiliateId) {
        console.log('[ML Resolve] Fixed malformed product ID:', affiliateId, '->', cleanId);
        return cleanId;
      }
      console.log('[ML Resolve] Found affiliate ID:', affiliateId);
      return affiliateId;
    }

    // Try to resolve short URL with multiple strategies
    console.log('[ML Resolve] Attempting to resolve short URL:', shortUrl);

    // Strategy 1: Direct fetch with redirect follow
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(shortUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const urlString = response.url;
        console.log('[ML Resolve] Got final URL:', urlString);

        // Extract internal ID from final URL
        const match = urlString.match(/MLA\d+|MLB\d+|MLM\d+|MLV\d+/);
        if (match) {
          console.log('[ML Resolve] Extracted product ID:', match[0]);
          return match[0];
        }

        // Extract affiliate ID from final URL
        const affMatch = urlString.match(/[A-Z0-9]+-[A-Z0-9]+/);
        if (affMatch) {
          console.log('[ML Resolve] Extracted affiliate ID from resolved URL:', affMatch[0]);
          return affMatch[0];
        }
      }
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.warn('[ML Resolve] Fetch strategy failed:', errorMsg);
    }

    // If we get here, couldn't resolve
    console.error('[ML Resolve] Could not resolve URL or extract product ID');
    return null;
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
  const isProduct = mlData._source === 'products';

  // Extract images — products API uses different field name
  const pictures = mlData.pictures || mlData.main_features?.filter((f: any) => f.picture_id) || [];
  const photos = pictures.map((pic: any, index: number) => ({
    url: pic.secure_url || pic.url || pic.thumbnail,
    source_id: pic.id || pic.picture_id || `ml_photo_${index}`,
    is_primary: index === 0,
  })).filter((p: any) => p.url);

  // Extract description
  let description = '';
  if (mlData.short_description?.content) {
    description = mlData.short_description.content;
  } else if (mlData.descriptions && Array.isArray(mlData.descriptions)) {
    description = mlData.descriptions
      .map((d: any) => d.text || '')
      .filter((t: string) => t.length > 0)
      .join('\n\n');
  } else if (mlData.description) {
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
  if (paymentMethods.length === 0) {
    paymentMethods.push(
      { name: 'Cartão de Crédito', installments: 12 },
      { name: 'Cartão de Débito' },
      { name: 'Pix' }
    );
  }

  // Extract condition — products API uses attributes
  let condition: 'new' | 'used' | null = 'new';
  if (mlData.condition === 'used') {
    condition = 'used';
  } else if (isProduct && mlData.attributes) {
    const condAttr = mlData.attributes.find((a: any) => a.id === 'ITEM_CONDITION');
    if (condAttr?.value_name?.toLowerCase().includes('usado')) condition = 'used';
  }

  // Category
  const category = mlData.category_name || mlData.domain_id || mlData.category_id || null;

  // Ratings
  const rating = mlData.rating ? parseFloat(mlData.rating) : null;
  const ratingCount = mlData.rating_count || mlData.ratings_count || 0;

  // Stock & sales
  const stockQuantity = mlData.available_quantity || 0;
  const salesCount = mlData.sold_quantity || 0;

  // Price — products API may have buy_box_winner or price
  const price = mlData.sale_price || mlData.buy_box_winner?.price || mlData.price || 0;

  // Title — products API uses name instead of title
  const name = mlData.title || mlData.name || 'Produto sem nome';

  return {
    productBase: {
      name,
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
