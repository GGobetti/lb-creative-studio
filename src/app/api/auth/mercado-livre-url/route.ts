import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'Mercado Livre credentials not configured' },
        { status: 500 }
      );
    }

    // Get current user
    const token = req.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user?.id) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    });

    const authUrl = `https://auth.mercadolibre.com/authorization?${params.toString()}`;

    // Store state and user_id in cookies for validation on callback
    const response = NextResponse.json({ authUrl });
    response.cookies.set('ml_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });
    response.cookies.set('ml_oauth_user_id', user.id, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (err) {
    console.error('[ML Auth URL Error]', err);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
