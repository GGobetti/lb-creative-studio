import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;

    // Use dynamic redirect URI based on environment
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const redirectUri = `${protocol}://${host}/api/auth/mercado-livre`;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'Mercado Livre credentials not configured' },
        { status: 500 }
      );
    }

    // Get user_id from query (passed by client component)
    const userId = req.nextUrl.searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID not provided' },
        { status: 400 }
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

    // Store state and user_id in cookies for callback
    const response = NextResponse.json({ authUrl });
    response.cookies.set('ml_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });
    response.cookies.set('ml_oauth_user_id', userId, {
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
