import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side only
);

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
