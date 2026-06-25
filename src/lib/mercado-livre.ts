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
    const response = await fetch(shortUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; LBCreativeBot/1.0)',
      },
    });

    const urlString = response.url;
    // Extract item ID from URL: https://www.mercadolivre.com.br/...MLA123456789...
    const match = urlString.match(/MLA\d+|MLB\d+|MLM\d+|MLV\d+/);
    return match ? match[0] : null;
  } catch (error) {
    console.error('[Resolve Short URL Error]', error);
    return null;
  }
}

/**
 * Transform ML product data to our affiliate_products format
 */
export function transformMLProductData(mlData: any) {
  const images = mlData.pictures || [];
  const imageUrl = images.length > 0 ? images[0].secure_url : '';

  return {
    name: mlData.title,
    description: mlData.descriptions?.[0]?.text || null,
    price: mlData.price || 0,
    image_url: imageUrl,
    marketplace: 'mercado_livre',
    // Note: affiliate_link should be set separately with the user's affiliate token
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
