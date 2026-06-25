import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'Mercado Livre credentials not configured' },
        { status: 500 }
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

    // Store state in cookie for validation on callback
    const response = NextResponse.json({ authUrl });
    response.cookies.set('ml_oauth_state', state, {
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
