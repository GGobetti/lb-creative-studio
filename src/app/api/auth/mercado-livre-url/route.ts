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

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
    });

    const authUrl = `https://auth.mercadolibre.com.br/authorization?${params.toString()}`;

    return NextResponse.json({ authUrl });
  } catch (err) {
    console.error('[ML Auth URL Error]', err);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
