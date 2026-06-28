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

