### Task 14: "Validar Mais Tarde" na curadoria de fotos — ocultar da busca

**Contexto:** Na tela de curadoria de fotos do admin (AuditTab), quando um STL tem algum problema que exige atenção maior (foto ruim, título confuso, etc.), o admin precisa de uma opção além de Aprovar/Remover. "Validar Mais Tarde" marca o STL para revisão futura e o **remove da busca pública** até ser revisado.

**Files:**
- Create: `supabase/migrations/20260624_needs_validation_flag.sql`
- Modify: `src/app/api/admin/stl-action/route.ts` (adicionar novo case)
- Modify: `src/components/admin/AuditTab.tsx` (novo botão)
- Modify: `src/app/dashboard/stl-search/page.tsx` (filtrar na busca)

**Interfaces:**
- Consumes: `stl-action` route existente — padrão `POST { action, stl_id }`
- Produces: STL com `needs_validation = true` some da busca; admin vê lista de pendentes e pode reverter

**Nota sobre bug adjacente:** As queries da `stl-search/page.tsx` também **não filtram** `marked_for_removal = true`. Corrigir junto nesta task.

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/20260624_needs_validation_flag.sql

ALTER TABLE public.telegram_indexed_stls
  ADD COLUMN IF NOT EXISTS needs_validation boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS telegram_indexed_stls_needs_validation_idx
  ON public.telegram_indexed_stls(needs_validation)
  WHERE needs_validation = true;
```

- [ ] **Step 2: Aplicar migration**

```bash
supabase db push
```

- [ ] **Step 3: Adicionar novo case no `stl-action` route**

Localizar `src/app/api/admin/stl-action/route.ts`. Antes do `default` no switch, adicionar:

```typescript
case 'needs_validation': {
  const { error } = await adminSupabase
    .from('telegram_indexed_stls')
    .update({ needs_validation: true })
    .eq('id', stl_id)
  if (error) throw error
  return NextResponse.json({ success: true, action })
}

case 'clear_validation': {
  const { error } = await adminSupabase
    .from('telegram_indexed_stls')
    .update({ needs_validation: false })
    .eq('id', stl_id)
  if (error) throw error
  return NextResponse.json({ success: true, action })
}
```

**Atenção:** verificar o nome da variável do admin client neste arquivo (pode ser `adminSupabase`, `supabaseAdmin` ou `admin`).

- [ ] **Step 4: Adicionar botão "Validar Mais Tarde" no AuditTab**

Em `src/components/admin/AuditTab.tsx`, localizar onde os botões de ação do STL são renderizados (buscar pelo texto "Remover" ou "Aprovar" ou "keep_stl").

Adicionar o botão ao lado dos existentes:

```tsx
<button
  onClick={() => handleStlAction('needs_validation', stlId)}
  className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded flex items-center gap-1"
  title="Ocultar da busca até revisão"
>
  <Clock size={12} />
  Validar Mais Tarde
</button>
```

Importar `Clock` de `lucide-react` (já está importado no arquivo, verificar se existe ou adicionar).

- [ ] **Step 5: Adicionar seção "Aguardando Validação" no AuditTab**

Adicionar uma query e seção que lista STLs com `needs_validation = true`, com botão para limpar o flag:

```typescript
// No useEffect de carregamento do AuditTab:
const { data: pendingValidation } = await supabase
  .from('telegram_indexed_stls')
  .select('id, title, photos, thumbnail_url')
  .eq('needs_validation', true)
  .order('updated_at', { ascending: false })
  .limit(50)
```

```tsx
{pendingValidation && pendingValidation.length > 0 && (
  <div className="mt-6">
    <h3 className="text-sm font-semibold text-yellow-500 uppercase tracking-wide mb-3">
      Aguardando Validação ({pendingValidation.length})
    </h3>
    <div className="space-y-2">
      {pendingValidation.map((stl) => (
        <div key={stl.id} className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/30 bg-card">
          {(stl.thumbnail_url || stl.photos?.[0]) && (
            <img
              src={stl.thumbnail_url || stl.photos[0]}
              alt=""
              className="w-12 h-12 rounded object-cover flex-shrink-0"
            />
          )}
          <p className="flex-1 text-sm truncate">{stl.title}</p>
          <button
            onClick={() => handleStlAction('clear_validation', stl.id)}
            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded flex-shrink-0"
          >
            Validado — Publicar
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 6: Filtrar `needs_validation` e `marked_for_removal` na busca pública**

Em `src/app/dashboard/stl-search/page.tsx`, todas as queries em `telegram_indexed_stls` precisam dos filtros abaixo.

Há múltiplos locais (linhas ~141, ~235, ~244, ~527). Em cada um, adicionar após o `.from("telegram_indexed_stls")`:

```typescript
.eq("needs_validation", false)
.eq("marked_for_removal", false)  // bug pré-existente, corrigir junto
```

Buscar todos os locais com:
```bash
grep -n 'from("telegram_indexed_stls")' src/app/dashboard/stl-search/page.tsx
```
E adicionar os dois filtros em cada ocorrência.

- [ ] **Step 7: Testar o fluxo completo localmente**

```bash
npm run dev
```

1. Como admin: acessar AuditTab → clicar "Validar Mais Tarde" em um STL
2. Confirmar que o STL sumiu da busca em `/dashboard/stl-search`
3. Voltar ao AuditTab → seção "Aguardando Validação" → clicar "Validado — Publicar"
4. Confirmar que o STL voltou a aparecer na busca

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260624_needs_validation_flag.sql \
        src/app/api/admin/stl-action/route.ts \
        src/components/admin/AuditTab.tsx \
        src/app/dashboard/stl-search/page.tsx
git commit -m "feat: add 'needs_validation' flag to hide STLs from search pending admin review"
```

---

## Checklist de verificação pós-Sprint 3

```bash
# 1. Confirmar migration de status das suggestions aplicada
# No Supabase SQL Editor:
# SELECT column_name FROM information_schema.columns
# WHERE table_name = 'stl_audit_suggestions' AND column_name = 'status';

# 2. Confirmar migration needs_validation aplicada
# SELECT column_name FROM information_schema.columns
# WHERE table_name = 'telegram_indexed_stls' AND column_name = 'needs_validation';

# 3. Confirmar que trigger existe
# SELECT trigger_name FROM information_schema.triggers
# WHERE event_object_table = 'stl_audit_results';

# 4. Confirmar que API routes existem
ls src/app/api/admin/apply-title-suggestion/
grep -n "needs_validation\|clear_validation" src/app/api/admin/stl-action/route.ts

# 5. Confirmar filtros na busca
grep -n "needs_validation\|marked_for_removal" src/app/dashboard/stl-search/page.tsx

# 6. Script presente mas não executado
ls scripts/cleanup-stl-titles.ts

# 7. Build limpo
npm run build
```
