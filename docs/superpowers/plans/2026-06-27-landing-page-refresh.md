# Landing Page Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atualizar a landing page pública com novo slogan, tema escuro padrão, vitrine de STLs populares em carrossel, e remoção de todas as referências a features parametricas descontinuadas.

**Architecture:** As mudanças de metadata e tema ficam em `layout.tsx`; o novo slogan e card do Hero ficam em `Hero.tsx`; um novo server component `STLShowcase` busca os 10 STLs mais populares do Supabase (5 por downloads + 5 por favoritos) e renderiza um marquee CSS puro; textos obsoletos no footer e rodapé de `page.tsx` são limpos.

**Tech Stack:** Next.js (App Router, server components), Supabase (query direta via `@/lib/supabase`), Tailwind CSS, Framer Motion (já em uso no projeto)

## Global Constraints

- Tabela Supabase: `telegram_indexed_stls`; colunas relevantes: `id`, `title`, `photos` (array), `download_count`, `favorites_count`
- A imagem de capa é `photos[0]` — usar `next/image` com `unoptimized` se o domínio não estiver em `next.config`
- Nenhum botão de download/favorito na landing — tudo é link para `/login`
- Tema padrão: `"dark"` (não `"system"`)
- Não criar nenhuma API route nova — o STLShowcase é server component que acessa Supabase diretamente
- Não remover o toggle de tema existente — usuário ainda pode trocar manualmente

---

### Task 1: Metadata e tema padrão escuro

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `defaultTheme="dark"` no ThemeProvider; metadata limpa sem referências a paramétrico

- [ ] **Step 1: Abrir `src/app/layout.tsx` e localizar o bloco `metadata` e o `ThemeProvider`**

- [ ] **Step 2: Substituir o bloco `metadata` completo**

```tsx
export const metadata: Metadata = {
  title: 'LB Creative Studio — Garimpo de STLs para Makers 3D',
  description: 'Encontre, imprima e venda. O maior garimpo de STLs do Brasil — busca inteligente, calculadora de custos, CRM e portfólio integrados.',
  keywords: ['STL', 'impressão 3D', 'FDM', 'garimpo STL', 'maker', 'vender impressão 3D', 'busca STL'],
  openGraph: {
    title: 'LB Creative Studio — Garimpo de STLs para Makers 3D',
    description: 'Encontre, imprima e venda. O seu garimpo de STLs preferido é aqui.',
    type: 'website',
  },
}
```

- [ ] **Step 3: Alterar `defaultTheme` no ThemeProvider**

Antes:
```tsx
defaultTheme="system"
enableSystem
```

Depois:
```tsx
defaultTheme="dark"
enableSystem
```

(manter `enableSystem` para não quebrar o toggle manual)

- [ ] **Step 4: Verificar que o app ainda compila**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: update metadata and set dark as default theme"
```

---

### Task 2: Atualizar título da aba na landing page e limpar rodapé

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: nenhuma dependência nova
- Produces: título da landing corrigido; rodapé sem "Do bit ao átomo"

- [ ] **Step 1: Corrigir o título específico da landing page**

Em `src/app/page.tsx`, substituir:
```tsx
export const metadata: Metadata = {
  title: 'LB Creative Studio — Dashboard',
  description: 'Sistema completo de busca, precificação e orçamentos para Impressão 3D.',
}
```
Por:
```tsx
export const metadata: Metadata = {
  title: 'LB Creative Studio — Garimpo de STLs para Makers 3D',
  description: 'Encontre, imprima e venda. O seu garimpo de STLs preferido é aqui.',
}
```

- [ ] **Step 2: Corrigir o texto do rodapé**

Localizar no footer de `src/app/page.tsx`:
```tsx
<p className="text-muted-foreground max-w-sm leading-relaxed">
  Simplificando o design 3D para quem ama criar. Do bit ao átomo, estamos com você.
</p>
```

Substituir por:
```tsx
<p className="text-muted-foreground max-w-sm leading-relaxed">
  Feito por makers, para makers. A plataforma completa para quem leva a impressão 3D a sério.
</p>
```

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: fix landing title and remove outdated footer copy"
```

---

### Task 3: Atualizar Hero — novo slogan e card obsoleto

**Files:**
- Modify: `src/components/landing/Hero.tsx`

**Interfaces:**
- Produces: H1 com novo slogan; card "Configurador 3D / Export STL" substituído por "Portfólio & Vendas"

- [ ] **Step 1: Substituir o array `floatingCards`**

Antes:
```tsx
const floatingCards = [
  { icon: Search, label: "Busca STL", sub: "12.847 modelos", color: "from-indigo-500/20 to-primary/20", delay: 0 },
  { icon: Calculator, label: "Calculadora", sub: "Precificação real", color: "from-violet-500/20 to-purple-500/20", delay: 0.15 },
  { icon: Layers, label: "Configurador 3D", sub: "Export STL", color: "from-fuchsia-500/20 to-pink-500/20", delay: 0.3 },
]
```

Depois (remover `Layers` dos imports, adicionar `Boxes`):
```tsx
const floatingCards = [
  { icon: Search, label: "Busca STL", sub: "12.847 modelos", color: "from-indigo-500/20 to-primary/20", delay: 0 },
  { icon: Calculator, label: "Calculadora", sub: "Precificação real", color: "from-violet-500/20 to-purple-500/20", delay: 0.15 },
  { icon: Boxes, label: "Portfólio & Vendas", sub: "Catálogo integrado", color: "from-fuchsia-500/20 to-pink-500/20", delay: 0.3 },
]
```

Atualizar imports:
```tsx
import { ArrowRight, Zap, Search, Calculator, Boxes } from "lucide-react"
```

- [ ] **Step 2: Substituir o H1**

Antes:
```tsx
<h1 className="text-display text-[clamp(2.4rem,5vw,4.2rem)] text-foreground mb-6">
  Do bit ao{" "}
  <span className="gradient-text">átomo.</span>
  <br />
  Crie. Precifique. Venda.
</h1>
```

Depois:
```tsx
<h1 className="text-display text-[clamp(2.4rem,5vw,4.2rem)] text-foreground mb-6">
  Encontre, imprima, venda.{" "}
  <br />
  <span className="gradient-text">O seu garimpo de STLs preferido é aqui.</span>
</h1>
```

- [ ] **Step 3: Verificar compilação**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/Hero.tsx
git commit -m "feat: new hero headline and replace parametric card"
```

---

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

### Task 5: Push e verificação final

- [ ] **Step 1: Push da branch**

```bash
git push
```

- [ ] **Step 2: Verificar no Vercel (ou localmente) que:**
  - A aba do navegador mostra `LB Creative Studio — Garimpo de STLs para Makers 3D`
  - O site abre em tema escuro por padrão
  - O H1 mostra `Encontre, imprima, venda. O seu garimpo de STLs preferido é aqui.`
  - A vitrine de STLs aparece entre Hero e Features com o marquee animando
  - Não há nenhuma referência a "paramétrico", "Gerador 3D", "cookie cutter" visível
  - O rodapé mostra o novo texto

- [ ] **Step 3: Abrir PR**

```bash
gh pr create --title "feat: landing page refresh — novo slogan, tema escuro, vitrine STLs" --body "$(cat <<'EOF'
## O que muda

- Título da aba: remove referência a Gerador 3D Paramétrico
- Tema padrão: escuro (usuário pode mudar manualmente)
- Hero: novo slogan focado no garimpo de STLs
- Vitrine: carrossel com top 5 downloads + top 5 favoritos
- Footer/copy: remove "Do bit ao átomo" e referências obsoletas

## Como testar

1. Abrir a landing em aba anônima — deve carregar em dark mode
2. Verificar título da aba
3. Verificar que o carrossel de STLs aparece e anima
4. Clicar em qualquer card do carrossel — deve ir para /login
5. Verificar que não há menção a paramétrico em nenhum texto visível

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
