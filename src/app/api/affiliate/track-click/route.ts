import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { product_id, user_id } = await req.json();

    if (!product_id) {
      return NextResponse.json(
        { error: 'Missing product_id' },
        { status: 400 }
      );
    }

    const referer_path = req.headers.get('referer') || '/affiliate';

    const { error } = await supabase.from('affiliate_clicks').insert([
      {
        product_id,
        user_id: user_id || null,
        referer_path,
      },
    ]);

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/affiliate/track-click]', err);
    // Fail silently (don't break the redirect)
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
