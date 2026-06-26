import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  resolveMLShortUrl,
  fetchMLProductData,
  transformMLProductData,
} from '@/lib/mercado-livre';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ImportRequest {
  affiliateLink: string;
}

export async function POST(req: NextRequest) {
  try {
    // Auth check (same as before)
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single();

    if (profile?.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { affiliateLink } = (await req.json()) as ImportRequest;
    if (!affiliateLink) {
      return NextResponse.json(
        { error: 'affiliateLink is required' },
        { status: 400 }
      );
    }

    // Resolve short URL
    const productId = await resolveMLShortUrl(affiliateLink);
    if (!productId) {
      return NextResponse.json(
        { error: 'Could not resolve Mercado Livre link' },
        { status: 400 }
      );
    }

    // Try to fetch without token first (public API)
    let mlProductData = null;
    let accessToken = undefined;

    try {
      console.log('[Import] Trying to fetch product from public ML API:', productId);
      mlProductData = await fetchMLProductData(productId, undefined);
    } catch (publicApiError) {
      console.log('[Import] Public API failed, trying with OAuth token...');

      // If public API fails, try with OAuth token
      const { data: credentials, error: credError } = await supabase
        .from('marketplace_credentials')
        .select('access_token, refresh_token, expires_at')
        .eq('admin_id', user.user.id)
        .eq('marketplace', 'mercado_livre')
        .single();

      if (credError || !credentials) {
        return NextResponse.json(
          {
            error:
              'Product not found in public API. Please connect your Mercado Livre account to access private products.',
          },
          { status: 403 }
        );
      }

      // Token refresh if needed
      accessToken = credentials.access_token;
      const expiresAt = new Date(credentials.expires_at);

      if (expiresAt < new Date()) {
        try {
          const { refreshMLAccessToken } = await import('@/lib/mercado-livre');
          const refreshed = await refreshMLAccessToken(
            credentials.refresh_token,
            process.env.MERCADO_LIVRE_CLIENT_SECRET!
          );

          await supabase
            .from('marketplace_credentials')
            .update({
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token,
              expires_at: new Date(
                Date.now() + refreshed.expires_in * 1000
              ).toISOString(),
            })
            .eq('admin_id', user.user.id)
            .eq('marketplace', 'mercado_livre');

          accessToken = refreshed.access_token;
        } catch (err) {
          console.error('[Token Refresh Failed]', err);
          return NextResponse.json(
            {
              error:
                'Token expired and could not be refreshed. Please reconnect.',
            },
            { status: 403 }
          );
        }
      }

      // Try again with token
      try {
        mlProductData = await fetchMLProductData(productId, accessToken);
      } catch (tokenApiError) {
        // Last resort for unified products (/up/MLBU): search by URL slug title
        if (productId.startsWith('MLBU')) {
          const slugMatch = affiliateLink.match(/mercadolivre\.com\.br\/([^/?#]+)\/up\/MLBU/);
          if (slugMatch) {
            const searchTerms = slugMatch[1].replace(/-/g, ' ').substring(0, 120);
            console.log('[Import] MLBU fallback: searching by slug:', searchTerms);
            const headers: Record<string, string> = {
              accept: 'application/json',
              Authorization: `Bearer ${accessToken}`,
            };
            const searchResp = await fetch(
              `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(searchTerms)}&limit=5`,
              { headers }
            );
            if (searchResp.ok) {
              const searchData = await searchResp.json();
              for (const result of searchData.results ?? []) {
                if (!result?.id) continue;
                const itemResp = await fetch(
                  `https://api.mercadolibre.com/items/${result.id}`,
                  { headers }
                );
                if (itemResp.ok) {
                  console.log('[Import] MLBU fallback found accessible item:', result.id);
                  mlProductData = { ...await itemResp.json(), _source: 'items' };
                  break;
                }
              }
            }
          }
          if (!mlProductData) throw tokenApiError;
        } else {
          throw tokenApiError;
        }
      }
    }

    // Transform to our format
    const { productBase, details, photos } = transformMLProductData(mlProductData);

    // Begin transaction: insert into 3 tables
    // 1. affiliate_products
    const { data: product, error: productError } = await supabase
      .from('affiliate_products')
      .insert([
        {
          admin_id: user.user.id,
          name: productBase.name,
          marketplace: productBase.marketplace,
          affiliate_link: affiliateLink,
          is_active: true,
          is_public: true,
        },
      ])
      .select()
      .single();

    if (productError) {
      console.error('[Insert Product Error]', productError);
      if (productError.code === '23505') {
        return NextResponse.json(
          { error: 'This product link is already imported' },
          { status: 409 }
        );
      }
      throw productError;
    }

    // 2. affiliate_product_details
    const { error: detailsError } = await supabase
      .from('affiliate_product_details')
      .insert([
        {
          product_id: product.id,
          description: details.description,
          price: details.price,
          category: details.category,
          condition: details.condition,
          payment_methods: details.payment_methods,
          stock_quantity: details.stock_quantity,
          sales_count: details.sales_count,
          rating: details.rating,
          rating_count: details.rating_count,
        },
      ]);

    if (detailsError) {
      console.error('[Insert Details Error]', detailsError);
      // Cleanup: delete product if details insert fails
      await supabase.from('affiliate_products').delete().eq('id', product.id);
      throw detailsError;
    }

    // 3. affiliate_product_photos
    const photoRecords = photos.map((photo, index) => ({
      product_id: product.id,
      image_url: photo.url,
      is_primary: photo.is_primary,
      position: index,
      source_id: photo.source_id,
    }));

    const { error: photosError } = await supabase
      .from('affiliate_product_photos')
      .insert(photoRecords);

    if (photosError) {
      console.error('[Insert Photos Error]', photosError);
      // Cleanup: delete product and details
      await supabase.from('affiliate_products').delete().eq('id', product.id);
      throw photosError;
    }

    // Return complete product object
    const completeProduct = {
      ...product,
      details: {
        ...details,
      },
      photos: photos.map((p, i) => ({
        id: `temp_${i}`, // Will be replaced on next fetch
        image_url: p.url,
        is_primary: p.is_primary,
        position: i,
      })),
    };

    return NextResponse.json({ product: completeProduct }, { status: 201 });
  } catch (err) {
    console.error('[Import ML Product Error]', err);
    return NextResponse.json(
      { error: 'Failed to import product', details: String(err) },
      { status: 500 }
    );
  }
}
