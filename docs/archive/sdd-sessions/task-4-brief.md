### Task 4: Criar componente STLShowcase (vitrine carrossel)

**Files:**
- Create: `src/components/landing/STLShowcase.tsx`
- Modify: `src/app/page.tsx` (inserir o componente entre Hero e Features)

**Interfaces:**
- Consumes: Supabase client de `@/lib/supabase` (server-side); tabela `telegram_indexed_stls`
- Produces: `<STLShowcase />` — server component exportado, sem props

- [ ] **Step 1: Criar `src/components/landing/STLShowcase.tsx`**

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface ShowcaseItem {
  id: string
  title: string
  cover: string
}

async function fetchShowcaseItems(): Promise<ShowcaseItem[]> {
  const supabase = createClient()

  const [byDownloads, byFavorites] = await Promise.all([
    supabase
      .from('telegram_indexed_stls')
      .select('id, title, photos')
      .order('download_count', { ascending: false })
      .limit(5),
    supabase
      .from('telegram_indexed_stls')
      .select('id, title, photos')
      .order('favorites_count', { ascending: false })
      .limit(5),
  ])

  const seen = new Set<string>()
  const items: ShowcaseItem[] = []

  for (const item of [...(byDownloads.data ?? []), ...(byFavorites.data ?? [])]) {
    if (seen.has(item.id)) continue
    const cover = Array.isArray(item.photos) ? item.photos[0] : null
    if (!cover) continue
    seen.add(item.id)
    items.push({ id: item.id, title: item.title, cover })
  }

  return items.slice(0, 10)
}

export async function STLShowcase() {
  const items = await fetchShowcaseItems()
  if (items.length === 0) return null

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
```

- [ ] **Step 2: Adicionar animação `marquee` ao Tailwind config**

Abrir `tailwind.config.ts` (ou `tailwind.config.js`) e adicionar dentro de `theme.extend`:

```ts
keyframes: {
  marquee: {
    '0%': { transform: 'translateX(0)' },
    '100%': { transform: 'translateX(-50%)' },
  },
},
animation: {
  marquee: 'marquee 30s linear infinite',
},
```

Se `keyframes` e `animation` já existirem no extend, apenas adicionar as entradas `marquee` dentro deles.

- [ ] **Step 3: Verificar como o Supabase client é instanciado no lado servidor**

```bash
grep -n "createClient\|createServerClient\|export" "/Users/ggobetti/Projetos Pessoais/lb-creative-studio/src/lib/supabase.ts" | head -20
```

Se o client exportado exigir cookies/headers (padrão do `@supabase/ssr`), usar a versão service-role ou anon para leitura pública. Ajustar o import em `STLShowcase.tsx` conforme o que existir. Exemplo alternativo se necessário:

```tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

- [ ] **Step 4: Inserir `<STLShowcase />` em `src/app/page.tsx`**

Adicionar import:
```tsx
import { STLShowcase } from '@/components/landing/STLShowcase'
```

Inserir entre `<Hero />` e `<Features />`:
```tsx
<Hero />

<Suspense fallback={null}>
  <STLShowcase />
</Suspense>

<Features />
```

- [ ] **Step 5: Verificar compilação**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/components/landing/STLShowcase.tsx src/app/page.tsx tailwind.config.ts
git commit -m "feat: add STL showcase marquee to landing page"
```

---

