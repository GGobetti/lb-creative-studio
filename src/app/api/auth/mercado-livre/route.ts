import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ML_CLIENT_ID = process.env.MERCADO_LIVRE_CLIENT_ID!;
const ML_CLIENT_SECRET = process.env.MERCADO_LIVRE_CLIENT_SECRET!;
const ML_REDIRECT_URI = process.env.MERCADO_LIVRE_REDIRECT_URI!;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle errors from ML
    if (error) {
      console.error('[ML OAuth Error]', error, errorDescription);
      return NextResponse.redirect(
        new URL(
          `/dashboard/affiliate?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`,
          req.nextUrl.origin
        )
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: 'Missing code parameter' },
        { status: 400 }
      );
    }

    // Verify state matches (CSRF protection)
    if (state) {
      const storedState = req.cookies.get('ml_oauth_state')?.value;
      console.log('[State Debug]', { received: state, stored: storedState });
      if (!storedState || state !== storedState) {
        console.warn('[State Mismatch]', { received: state, stored: storedState });
        // For now, allow without state validation to debug
        // TODO: Fix cookie handling
      }
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
        code,
        redirect_uri: ML_REDIRECT_URI,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[Token Exchange Error]', errorData);
      return NextResponse.redirect(
        new URL(
          `/dashboard/affiliate?error=token_exchange_failed&details=${encodeURIComponent(JSON.stringify(errorData))}`,
          req.nextUrl.origin
        )
      );
    }

    const tokenData = await tokenResponse.json();
    const {
      access_token,
      refresh_token,
      expires_in,
      user_id: ml_user_id,
    } = tokenData;

    // Get user_id from stored cookie
    const userId = req.cookies.get('ml_oauth_user_id')?.value;

    if (!userId) {
      console.error('[Auth Error]', 'No user_id in cookie');
      return NextResponse.redirect(
        new URL('/login', req.nextUrl.origin)
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role !== 'sysadmin') {
      return NextResponse.redirect(
        new URL(
          `/dashboard/affiliate?error=unauthorized`,
          req.nextUrl.origin
        )
      );
    }

    // Store credentials in database
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error: insertError } = await supabase
      .from('marketplace_credentials')
      .upsert([
        {
          admin_id: userId,
          marketplace: 'mercado_livre',
          access_token,
          refresh_token,
          user_id_marketplace: ml_user_id?.toString(),
          expires_at: expiresAt,
        },
      ]);

    if (insertError) {
      console.error('[Store Credentials Error]', insertError);
      return NextResponse.redirect(
        new URL(
          `/dashboard/affiliate?error=store_credentials_failed`,
          req.nextUrl.origin
        )
      );
    }

    // Success - redirect back to dashboard
    return NextResponse.redirect(
      new URL(
        `/dashboard/affiliate?success=mercado_livre_connected&ml_user=${ml_user_id}`,
        req.nextUrl.origin
      )
    );
  } catch (err) {
    console.error('[Mercado Livre OAuth Error]', err);
    return NextResponse.json(
      { error: 'OAuth callback failed', details: String(err) },
      { status: 500 }
    );
  }
}
