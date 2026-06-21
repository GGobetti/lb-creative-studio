import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAdminUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const { data: user, error } = await supabase.auth.getUser(token);

  if (error || !user?.user?.id) return null;
  if (user.user.user_metadata?.is_admin !== true) return null;

  return user.user;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, price, image_url, affiliate_link, marketplace, is_active } =
      await req.json();

    // Verify ownership
    const { data: existing } = await supabase
      .from('affiliate_products')
      .select('admin_id')
      .eq('id', id)
      .single();

    if (!existing || existing.admin_id !== adminUser.id) {
      return NextResponse.json(
        { error: 'Not found or unauthorized' },
        { status: 404 }
      );
    }

    const { data: product, error: updateError } = await supabase
      .from('affiliate_products')
      .update({
        name,
        description: description || null,
        price: parseFloat(price),
        image_url,
        affiliate_link,
        marketplace,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ product }, { status: 200 });
  } catch (err) {
    console.error('[PUT /api/affiliate/products/[id]]', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { id } = await params;

    // Verify ownership
    const { data: existing } = await supabase
      .from('affiliate_products')
      .select('admin_id')
      .eq('id', id)
      .single();

    if (!existing || existing.admin_id !== adminUser.id) {
      return NextResponse.json(
        { error: 'Not found or unauthorized' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from('affiliate_products')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[DELETE /api/affiliate/products/[id]]', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
