import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { fetchMLProductData } from '@/lib/mercado-livre';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side only
);

/** Extract ML product ID from affiliate link */
function extractMLProductId(affiliateLink: string): string | null {
  // Try /p/MLB... format
  const pMatch = affiliateLink.match(/\/p\/(MLB\d+)/);
  if (pMatch) return pMatch[1];

  // Try /up/MLBU... format
  const upMatch = affiliateLink.match(/\/up\/(MLBU\d+)/);
  if (upMatch) return upMatch[1];

  return null;
}

/** Fetch fresh price from ML API with fallback to stored price */
async function getFreshMLPrice(
  productId: string,
  fallbackPrice: number,
  accessToken?: string
): Promise<number> {
  try {
    const mlData = await fetchMLProductData(productId, accessToken);
    const price = (mlData as any)?.sale_price || (mlData as any)?.price;
    return price ? parseFloat(String(price)) : fallbackPrice;
  } catch (err) {
    console.warn('[Fresh Price] Failed for', productId, '- using fallback:', fallbackPrice);
    return fallbackPrice;
  }
}

/** Fetch fresh prices with concurrency limit */
async function enrichProductsWithFreshPrices(
  products: any[],
  adminId: string
): Promise<any[]> {
  // Get OAuth token if available
  const { data: credentials } = await supabase
    .from('marketplace_credentials')
    .select('access_token')
    .eq('admin_id', adminId)
    .eq('marketplace', 'mercado_livre')
    .single();

  const accessToken = credentials?.access_token;

  // Fetch prices in parallel with max concurrency of 3
  const concurrency = 3;
  const results = [...products];
  const pending = results.map((p, idx) => ({ idx, product: p }));

  while (pending.length > 0) {
    const batch = pending.splice(0, concurrency);
    await Promise.all(
      batch.map(async ({ idx, product }) => {
        if (product.marketplace !== 'mercado_livre') return;

        const mlId = extractMLProductId(product.affiliate_link);
        if (!mlId) return;

        const freshPrice = await getFreshMLPrice(
          mlId,
          product.details?.price || 0,
          accessToken
        );

        if (results[idx]?.details) {
          results[idx].details.price = freshPrice;
        }
      })
    );
  }

  return results;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const marketplace = searchParams.get('marketplace');

    let query = supabase
      .from('affiliate_products')
      .select(
        `
        id,
        admin_id,
        name,
        marketplace,
        affiliate_link,
        is_active,
        is_public,
        created_at,
        updated_at,
        details:affiliate_product_details (
          id,
          description,
          price,
          category,
          condition,
          payment_methods,
          stock_quantity,
          sales_count,
          rating,
          rating_count
        ),
        photos:affiliate_product_photos (
          id,
          image_url,
          is_primary,
          position
        )
      `
      )
      .eq('is_active', true)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (marketplace) {
      query = query.eq('marketplace', marketplace);
    }

    const { data: products, error } = await query;

    if (error) {
      throw error;
    }

    // Flatten details (single record) and sort photos by position
    const formattedProducts = products.map((product: any) => ({
      id: product.id,
      admin_id: product.admin_id,
      name: product.name,
      marketplace: product.marketplace,
      affiliate_link: product.affiliate_link,
      is_active: product.is_active,
      created_at: product.created_at,
      updated_at: product.updated_at,
      details: product.details?.[0] || null,
      photos: (product.photos || []).sort((a: any, b: any) => a.position - b.position),
    }));

    // Fetch fresh prices for Mercado Livre products (with timeout)
    const shouldFreshPrices = searchParams.get('fresh-prices') !== 'false';
    if (shouldFreshPrices && formattedProducts.some((p: any) => p.marketplace === 'mercado_livre')) {
      try {
        const adminId = formattedProducts[0]?.admin_id;
        const pricesPromise = enrichProductsWithFreshPrices(formattedProducts, adminId);

        // Timeout after 5 seconds
        const timeoutPromise = new Promise<any[]>((resolve) => {
          setTimeout(() => resolve(formattedProducts), 5000);
        });

        const enrichedProducts = await Promise.race([pricesPromise, timeoutPromise]);
        return NextResponse.json({ products: enrichedProducts }, { status: 200 });
      } catch (err) {
        console.warn('[Fresh Prices] Error - returning cached prices:', err);
        return NextResponse.json({ products: formattedProducts }, { status: 200 });
      }
    }

    return NextResponse.json({ products: formattedProducts }, { status: 200 });
  } catch (err) {
    console.error('[Fetch Products Error]', err);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role (project's canonical model: profiles.role = 'sysadmin')
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single();
    if (profile?.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { name, description, price, image_url, affiliate_link, marketplace } =
      await req.json();

    // Validate
    if (!name || !price || !image_url || !affiliate_link || !marketplace) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const validMarketplaces = ['aliexpress', 'shopee', 'mercado_livre', 'amazon'];
    if (!validMarketplaces.includes(marketplace)) {
      return NextResponse.json(
        { error: 'Invalid marketplace' },
        { status: 400 }
      );
    }

    const { data: product, error: insertError } = await supabase
      .from('affiliate_products')
      .insert([
        {
          admin_id: user.user.id,
          name,
          description: description || null,
          price: parseFloat(price),
          image_url,
          affiliate_link,
          marketplace,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/affiliate/products]', err);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
