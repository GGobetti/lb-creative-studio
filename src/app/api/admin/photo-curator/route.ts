import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/admin/photo-curator
// Curadoria de fotos dos STLs indexados. Toda operação mexe APENAS em
// Supabase (DB `telegram_indexed_stls.photos` + Storage bucket `portfolio`).
// O Cloudflare R2 (arquivos STL) NUNCA é tocado aqui.
//
// actions:
//  - 'move_photo':   move uma URL de foto de um STL para outro
//  - 'set_photos':   substitui o array de fotos de um STL (usado p/ reordenar)
//  - 'delete_photos': remove URLs do array E apaga os arquivos do Storage
//
// `thumbnail_url` é sempre re-sincronizado para photos[0] (ou null).

const STORAGE_BUCKET = 'portfolio'

// Remove exatamente N instâncias de cada URL (N = ocorrências em toRemove).
// Evita apagar todas as cópias quando a mesma URL aparece mais de uma vez no array.
function removeOneEach(arr: string[], toRemove: string[]): string[] {
  const pending = new Map<string, number>()
  for (const u of toRemove) pending.set(u, (pending.get(u) || 0) + 1)
  const result: string[] = []
  for (const p of arr) {
    const rem = pending.get(p) || 0
    if (rem > 0) pending.set(p, rem - 1)
    else result.push(p)
  }
  return result
}

// Extrai o caminho dentro do bucket a partir da URL pública do Supabase Storage.
// Ex.: https://<proj>.supabase.co/storage/v1/object/public/portfolio/telegram/x.jpg
//      → telegram/x.jpg
function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'sysadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { action } = body

    const admin = getSupabaseAdmin()

    switch (action) {

      case 'move_photo': {
        const { from_stl_id, to_stl_id, photo_url } = body
        if (!from_stl_id || !to_stl_id || !photo_url) {
          return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }
        if (from_stl_id === to_stl_id) {
          return NextResponse.json({ error: 'Origem e destino iguais' }, { status: 400 })
        }

        const { data: rows, error: fetchErr } = await admin
          .from('telegram_indexed_stls')
          .select('id, photos')
          .in('id', [from_stl_id, to_stl_id])
        if (fetchErr) throw fetchErr

        const fromRow = rows?.find(r => r.id === from_stl_id)
        const toRow = rows?.find(r => r.id === to_stl_id)
        if (!fromRow || !toRow) return NextResponse.json({ error: 'STL não encontrado' }, { status: 404 })

        const fromPhotos = removeOneEach(fromRow.photos || [], [photo_url])
        const toPhotos = [...(toRow.photos || [])]
        if (!toPhotos.includes(photo_url)) toPhotos.push(photo_url)

        const { error: e1 } = await admin
          .from('telegram_indexed_stls')
          .update({ photos: fromPhotos, thumbnail_url: fromPhotos[0] || null })
          .eq('id', from_stl_id)
        if (e1) throw e1

        const { error: e2 } = await admin
          .from('telegram_indexed_stls')
          .update({ photos: toPhotos, thumbnail_url: toPhotos[0] || null })
          .eq('id', to_stl_id)
        if (e2) throw e2

        return NextResponse.json({ success: true, action, from_photos: fromPhotos, to_photos: toPhotos })
      }

      case 'set_photos': {
        const { stl_id, photos } = body
        if (!stl_id || !Array.isArray(photos)) {
          return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }
        const { error } = await admin
          .from('telegram_indexed_stls')
          .update({ photos, thumbnail_url: photos[0] || null })
          .eq('id', stl_id)
        if (error) throw error
        return NextResponse.json({ success: true, action, photos })
      }

      case 'delete_photos': {
        const { stl_id, photo_urls } = body
        if (!stl_id || !Array.isArray(photo_urls) || photo_urls.length === 0) {
          return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        const { data: row, error: fetchErr } = await admin
          .from('telegram_indexed_stls')
          .select('photos')
          .eq('id', stl_id)
          .single()
        if (fetchErr) throw fetchErr

        const remaining = removeOneEach(row?.photos || [], photo_urls)

        // Atualiza o array no DB primeiro (fonte da verdade)
        const { error: updErr } = await admin
          .from('telegram_indexed_stls')
          .update({ photos: remaining, thumbnail_url: remaining[0] || null })
          .eq('id', stl_id)
        if (updErr) throw updErr

        // Apaga os arquivos físicos do Storage (best-effort: não falha a request se algum não sair)
        const paths = photo_urls
          .map((u: string) => storagePathFromUrl(u))
          .filter((p): p is string => !!p)
        let storageRemoved = 0
        if (paths.length > 0) {
          const { error: rmErr } = await admin.storage.from(STORAGE_BUCKET).remove(paths)
          if (rmErr) {
            console.warn('[PHOTO-CURATOR] Falha ao remover do Storage:', rmErr.message)
          } else {
            storageRemoved = paths.length
          }
        }

        return NextResponse.json({ success: true, action, remaining, storage_removed: storageRemoved })
      }

      case 'merge_stls': {
        // Agrupa N STLs como "partes" do principal usando parent_id.
        // Os mesclados somem do listing principal (filtro parent_id IS NULL)
        // mas aparecem no modal do principal como partes com botão de download próprio.
        // Nenhum arquivo é deletado — nem R2, nem Storage.
        const { primary_id, merged_ids } = body
        if (!primary_id || !Array.isArray(merged_ids) || merged_ids.length === 0) {
          return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }
        if (merged_ids.includes(primary_id)) {
          return NextResponse.json({ error: 'Principal não pode estar na lista de mesclados' }, { status: 400 })
        }

        const { data: primary, error: fetchErr } = await admin
          .from('telegram_indexed_stls')
          .select('id, parts_count')
          .eq('id', primary_id)
          .single()
        if (fetchErr) throw fetchErr
        if (!primary) return NextResponse.json({ error: 'Principal não encontrado' }, { status: 404 })

        // Define parent_id nos mesclados → eles somem do listing, aparecem no modal
        const { error: parentErr } = await admin
          .from('telegram_indexed_stls')
          .update({ parent_id: primary_id })
          .in('id', merged_ids)
        if (parentErr) throw parentErr

        // Atualiza parts_count no principal
        const newPartsCount = (primary.parts_count || 0) + merged_ids.length
        const { error: countErr } = await admin
          .from('telegram_indexed_stls')
          .update({ parts_count: newPartsCount })
          .eq('id', primary_id)
        if (countErr) throw countErr

        return NextResponse.json({ success: true, action, merged_count: merged_ids.length, parts_count: newPartsCount })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[PHOTO-CURATOR]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
