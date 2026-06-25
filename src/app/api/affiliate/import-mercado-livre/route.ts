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
    // Check admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
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

    // Resolve short URL to product ID
    const productId = await resolveMLShortUrl(affiliateLink);

    if (!productId) {
      return NextResponse.json(
        { error: 'Could not resolve Mercado Livre link' },
        { status: 400 }
      );
    }

    // Get stored ML credentials
    const { data: credentials, error: credError } = await supabase
      .from('marketplace_credentials')
      .select('access_token, refresh_token, expires_at')
      .eq('admin_id', user.user.id)
      .eq('marketplace', 'mercado_livre')
      .single();

    if (credError || !credentials) {
      return NextResponse.json(
        { error: 'Mercado Livre not connected. Please authorize first.' },
        { status: 403 }
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = credentials.access_token;
    const expiresAt = new Date(credentials.expires_at);

    if (expiresAt < new Date()) {
      // Token expired, try to refresh
      try {
        const { refreshMLAccessToken } = await import('@/lib/mercado-livre');
        const refreshed = await refreshMLAccessToken(
          credentials.refresh_token,
          process.env.MERCADO_LIVRE_CLIENT_SECRET!
        );

        // Update token in database
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
          { error: 'Token expired and could not be refreshed. Please reconnect.' },
          { status: 403 }
        );
      }
    }

    // Fetch product data from ML API
    const mlProductData = await fetchMLProductData(productId, accessToken);

    // Transform to our format
    const productData = transformMLProductData(mlProductData);

    // Insert into affiliate_products with the affiliate link
    const { data: product, error: insertError } = await supabase
      .from('affiliate_products')
      .insert([
        {
          admin_id: user.user.id,
          ...productData,
          affiliate_link: affiliateLink,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('[Insert Product Error]', insertError);
      // Check if it's a duplicate link error
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'This product link is already imported' },
          { status: 409 }
        );
      }
      throw insertError;
    }

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error('[Import ML Product Error]', err);
    return NextResponse.json(
      { error: 'Failed to import product', details: String(err) },
      { status: 500 }
    );
  }
}
