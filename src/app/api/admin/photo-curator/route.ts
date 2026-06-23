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

        const fromPhotos = (fromRow.photos || []).filter((p: string) => p !== photo_url)
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

        const toDelete = new Set(photo_urls)
        const remaining = (row?.photos || []).filter((p: string) => !toDelete.has(p))

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
        // Mescla N STLs em um principal: une as fotos no principal e marca os
        // demais como is_deleted=true (soft). NÃO toca no R2 — o arquivo físico
        // dos mesclados permanece (recuperável); hard-delete fica para a tela de
        // moderação (Fase 4). As fotos NÃO são apagadas do Storage: passam a
        // pertencer ao principal.
        const { primary_id, merged_ids } = body
        if (!primary_id || !Array.isArray(merged_ids) || merged_ids.length === 0) {
          return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }
        if (merged_ids.includes(primary_id)) {
          return NextResponse.json({ error: 'Principal não pode estar na lista de mesclados' }, { status: 400 })
        }

        const allIds = [primary_id, ...merged_ids]
        const { data: rows, error: fetchErr } = await admin
          .from('telegram_indexed_stls')
          .select('id, photos')
          .in('id', allIds)
        if (fetchErr) throw fetchErr

        const primary = rows?.find(r => r.id === primary_id)
        if (!primary) return NextResponse.json({ error: 'Principal não encontrado' }, { status: 404 })

        // União das fotos (dedupe por URL), começando pelas do principal
        const merged = new Set<string>(primary.photos || [])
        for (const id of merged_ids) {
          const r = rows?.find(x => x.id === id)
          for (const p of (r?.photos || [])) merged.add(p)
        }
        const mergedPhotos = [...merged]

        const { error: upErr } = await admin
          .from('telegram_indexed_stls')
          .update({ photos: mergedPhotos, thumbnail_url: mergedPhotos[0] || null })
          .eq('id', primary_id)
        if (upErr) throw upErr

        // Soft-delete dos mesclados (mantém r2_object_key e photos para auditoria/recuperação)
        const { error: delErr } = await admin
          .from('telegram_indexed_stls')
          .update({
            is_deleted: true,
            removal_reason: `merged_into:${primary_id}`,
            removal_marked_at: new Date().toISOString(),
          })
          .in('id', merged_ids)
        if (delErr) throw delErr

        return NextResponse.json({ success: true, action, primary_photos: mergedPhotos, merged_count: merged_ids.length })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[PHOTO-CURATOR]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
