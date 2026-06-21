import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side only
);

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('affiliate_products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ products: data }, { status: 200 });
  } catch (err) {
    console.error('[GET /api/affiliate/products]', err);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
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

    // Check is_admin in metadata
    const isAdmin = user.user.user_metadata?.is_admin === true;
    if (!isAdmin) {
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
