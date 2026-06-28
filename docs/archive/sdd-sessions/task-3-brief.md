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

