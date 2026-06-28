import Image from 'next/image'
import Link from 'next/link'
import { getSupabaseServer } from '@/lib/supabase'

interface ShowcaseItem {
  id: string
  title: string
  cover: string
}

async function fetchShowcaseItems(): Promise<ShowcaseItem[]> {
  const supabase = getSupabaseServer()

  const [byDownloads, byFavorites] = await Promise.all([
    supabase
      .from('telegram_indexed_stls')
      .select('id, title, thumbnail_url, download_count')
      .order('download_count', { ascending: false })
      .limit(5),
    supabase
      .from('telegram_indexed_stls')
      .select('id, title, thumbnail_url, favorites_count')
      .order('favorites_count', { ascending: false })
      .limit(5),
  ])

  const seen = new Set<string>()
  const items: ShowcaseItem[] = []

  for (const item of [...(byDownloads.data ?? []), ...(byFavorites.data ?? [])]) {
    if (seen.has(item.id)) continue
    const cover = item.thumbnail_url
    if (!cover) continue
    seen.add(item.id)
    items.push({ id: item.id, title: item.title, cover })
  }
  return items.slice(0, 10)
}

export async function STLShowcase() {
  const items = await fetchShowcaseItems()
  if (items.length === 0) {
    return (
      <section className="py-16 bg-muted/10 border-y border-border">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">STLs não disponíveis no momento</p>
        </div>
      </section>
    )
  }

  // Duplicate for seamless loop
  const loop = [...items, ...items]

  return (
    <section className="py-16 overflow-hidden bg-muted/10 border-y border-border">
      <div className="container mx-auto px-6 mb-8 text-center">
        <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-1">
          Garimpo em destaque
        </p>
        <h2 className="text-2xl md:text-3xl font-black text-foreground">
          Os STLs mais amados pela comunidade
        </h2>
      </div>

      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />

        <div className="flex gap-4 animate-marquee w-max">
          {loop.map((item, i) => (
            <Link
              key={`${item.id}-${i}`}
              href="/login"
              className="group flex-shrink-0 w-48 rounded-2xl overflow-hidden border border-border bg-card hover:border-primary/40 transition-colors"
            >
              <div className="relative w-48 h-48">
                <Image
                  src={item.cover}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
                  {item.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
