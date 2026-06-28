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

