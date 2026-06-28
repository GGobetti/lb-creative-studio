# Task 4: STLShowcase Marquee — Report

**Status:** DONE

## Arquivos criados/modificados

- **Created:** `src/components/landing/STLShowcase.tsx` — server component que busca 5 STLs por `download_count` + 5 por `favorites_count`, deduplica, e renderiza marquee horizontal
- **Modified:** `src/app/globals.css` — adicionado `@keyframes marquee` e `@utility animate-marquee`
- **Modified:** `src/app/page.tsx` — import de STLShowcase + inserção em `<Suspense fallback={null}>` entre Hero e Features

## Resultado `npx tsc --noEmit`

Erros pré-existentes (não relacionados à task):
- `.next/` cache referenciando rotas hub-links ausentes (stale cache)
- Test file `PhotoCurator.categorization.test.tsx` com tipos jest faltando (`@types/jest` não instalado)

Nenhum erro novo introduzido por esta task.

## Commits

- `c654af7` — feat: add STL showcase marquee to landing page

## Fix: prefers-reduced-motion

- Adicionado media query em globals.css
- Commit: `8983e5d`
