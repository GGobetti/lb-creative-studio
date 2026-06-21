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

  // Check admin role (project's canonical model: profiles.role = 'sysadmin')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.user.id)
    .single();
  if (profile?.role !== 'sysadmin') return null;

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
    const data = await req.json();

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

    // Partial update: only touch keys the caller actually provided, so that
    // single-field calls (e.g. the active-toggle) don't NULL other columns.
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('name' in data) updates.name = data.name;
    if ('description' in data) updates.description = data.description || null;
    if ('price' in data) updates.price = parseFloat(data.price);
    if ('image_url' in data) updates.image_url = data.image_url;
    if ('affiliate_link' in data) updates.affiliate_link = data.affiliate_link;
    if ('marketplace' in data) updates.marketplace = data.marketplace;
    if ('is_active' in data) updates.is_active = data.is_active;

    const { data: product, error: updateError } = await supabase
      .from('affiliate_products')
      .update(updates)
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
