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

    // Encode user_id in state so it survives the cross-site redirect
    const nonce = Math.random().toString(36).substring(2, 15);
    const state = `${nonce}:${userId}`;

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    });

    const authUrl = `https://auth.mercadolibre.com/authorization?${params.toString()}`;

    return NextResponse.json({ authUrl });
  } catch (err) {
    console.error('[ML Auth URL Error]', err);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
