# Hub Links Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin page for managing Hub Maker theme links with drag-and-drop reordering and real-time preview.

**Architecture:** Database-backed admin interface using Supabase for persistence, React components for drag-and-drop UI, with two-column layout (editor + live preview). APIs handle CRUD and reordering. Hub Maker page queries database instead of hardcoded arrays.

**Tech Stack:** Next.js 15, Supabase, react-beautiful-dnd, Zod, Lucide React, Framer Motion

## Global Constraints

- Sysadmin role required for access
- Support mobile-responsive layout
- Use existing design tokens and component patterns
- Follow WCAG AA accessibility standards
- Commit frequently in small, logical steps

---

## File Structure

### New Files to Create

1. **Database Migration**
   - `supabase/migrations/YYYYMMDDHHMMSS_create_hub_theme_links.sql`
   - Creates `hub_theme_links` table with indexes

2. **API Routes**
   - `src/app/api/admin/hub-links/route.ts` — GET, POST handlers
   - `src/app/api/admin/hub-links/[id]/route.ts` — PUT, DELETE handlers
   - `src/app/api/admin/hub-links/reorder/route.ts` — Bulk reorder endpoint

3. **Page & Components**
   - `src/app/dashboard/admin/hub-links/page.tsx` — Main page container
   - `src/components/admin/HubLinksEditor.tsx` — Left column: tabs + form + draggable cards
   - `src/components/admin/HubLinkForm.tsx` — Form for create/edit
   - `src/components/admin/HubLinksPreview.tsx` — Right column: live Hub preview
   - `src/components/admin/HubLinkCard.tsx` — Individual draggable card

4. **Types & Validation**
   - `src/types/hub-links.ts` — TypeScript interfaces and Zod schemas
   - `src/lib/hub-links.ts` — Helper functions (API calls, validation, formatting)

5. **Tests**
   - `src/app/api/admin/hub-links/__tests__/route.test.ts`
   - `src/components/admin/__tests__/HubLinkForm.test.tsx`

### Modified Files

1. `src/components/layout/DashboardSidebar.tsx`
   - Add "Configuração do Hub" link to Admin section

2. `src/app/dashboard/hub/page.tsx`
   - Replace hardcoded arrays with database fetches
   - Maintain existing UI/styling

3. `src/types/index.ts`
   - Export hub-links types if needed

---

## Task Breakdown

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260627120000_create_hub_theme_links.sql`

**Interfaces:**
- Produces: `hub_theme_links` table with fields (id, theme, title, description, url, position, is_active, created_at, updated_at)

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260627120000_create_hub_theme_links.sql
CREATE TABLE IF NOT EXISTS hub_theme_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme TEXT NOT NULL CHECK (theme IN ('tutoriais', 'ia', 'calibracao', 'comunidade')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_hub_theme_links_theme ON hub_theme_links(theme);
CREATE INDEX idx_hub_theme_links_position ON hub_theme_links(position, theme);

-- Enable RLS if needed
ALTER TABLE hub_theme_links ENABLE ROW LEVEL SECURITY;

-- Policy: Only sysadmins can view/edit
CREATE POLICY "Admins can manage hub links"
  ON hub_theme_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'sysadmin'
    )
  );
```

- [ ] **Step 2: Apply migration locally**

Run: `supabase db push`
Expected: Migration applies without error

- [ ] **Step 3: Verify table in Supabase Studio**

Go to Supabase dashboard, check Tables → `hub_theme_links` exists with correct columns

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: create hub_theme_links table for admin configuration"
```

---

### Task 2: Types & Validation

**Files:**
- Create: `src/types/hub-links.ts`
- Create: `src/lib/hub-links.ts`

**Interfaces:**
- Produces: `HubLink`, `HubTheme`, `CreateHubLinkInput`, `UpdateHubLinkInput` types and Zod schemas

- [ ] **Step 1: Create types file**

```typescript
// src/types/hub-links.ts
import { z } from "zod"

export type HubTheme = "tutoriais" | "ia" | "calibracao" | "comunidade"

export interface HubLink {
  id: string
  theme: HubTheme
  title: string
  description: string
  url: string
  position: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export const CreateHubLinkSchema = z.object({
  theme: z.enum(["tutoriais", "ia", "calibracao", "comunidade"]),
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(1000),
  url: z.string().url("Invalid URL format"),
})

export type CreateHubLinkInput = z.infer<typeof CreateHubLinkSchema>

export const UpdateHubLinkSchema = CreateHubLinkSchema.extend({
  is_active: z.boolean().optional(),
})

export type UpdateHubLinkInput = z.infer<typeof UpdateHubLinkSchema>

export const ReorderSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
    })
  ),
})

export type ReorderInput = z.infer<typeof ReorderSchema>
```

- [ ] **Step 2: Create helper functions file**

```typescript
// src/lib/hub-links.ts
import { getSupabaseBrowser, getSupabaseServer } from "@/lib/supabase"
import { HubLink, CreateHubLinkInput, UpdateHubLinkInput, ReorderInput } from "@/types/hub-links"

export async function fetchHubLinks(): Promise<HubLink[]> {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase
    .from("hub_theme_links")
    .select("*")
    .order("position", { ascending: true })

  if (error) throw error
  return data || []
}

export async function fetchHubLinksByTheme(theme: string): Promise<HubLink[]> {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase
    .from("hub_theme_links")
    .select("*")
    .eq("theme", theme)
    .order("position", { ascending: true })

  if (error) throw error
  return data || []
}

export async function createHubLink(input: CreateHubLinkInput): Promise<HubLink> {
  const supabase = getSupabaseBrowser()
  
  // Get max position for this theme
  const { data: existing } = await supabase
    .from("hub_theme_links")
    .select("position")
    .eq("theme", input.theme)
    .order("position", { ascending: false })
    .limit(1)

  const nextPosition = (existing?.[0]?.position ?? -1) + 1

  const { data, error } = await supabase
    .from("hub_theme_links")
    .insert({
      ...input,
      position: nextPosition,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateHubLink(id: string, input: UpdateHubLinkInput): Promise<HubLink> {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase
    .from("hub_theme_links")
    .update(input)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteHubLink(id: string): Promise<void> {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase
    .from("hub_theme_links")
    .delete()
    .eq("id", id)

  if (error) throw error
}

export async function reorderHubLinks(input: ReorderInput): Promise<HubLink[]> {
  const supabase = getSupabaseBrowser()

  // Update each link's position
  const promises = input.updates.map(({ id, position }) =>
    supabase
      .from("hub_theme_links")
      .update({ position })
      .eq("id", id)
  )

  await Promise.all(promises)

  // Return updated links
  return fetchHubLinks()
}
```

- [ ] **Step 3: Run tests (optional)**

Run: `npm run test -- src/lib/hub-links.test.ts` (if test file exists)

- [ ] **Step 4: Commit**

```bash
git add src/types/hub-links.ts src/lib/hub-links.ts
git commit -m "feat: add hub-links types and helper functions"
```

---

### Task 3: API Routes — CRUD Operations

**Files:**
- Create: `src/app/api/admin/hub-links/route.ts`
- Create: `src/app/api/admin/hub-links/[id]/route.ts`

**Interfaces:**
- Consumes: `HubLink`, `CreateHubLinkInput`, `UpdateHubLinkInput` from Task 2
- Produces: JSON endpoints (GET list, POST create, PUT update, DELETE)

- [ ] **Step 1: Create list/POST endpoint**

```typescript
// src/app/api/admin/hub-links/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase"
import { CreateHubLinkSchema } from "@/types/hub-links"
import { verifyAdminAccess } from "@/lib/auth" // Assume this exists

export async function GET(req: NextRequest) {
  try {
    await verifyAdminAccess()

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("hub_theme_links")
      .select("*")
      .order("position", { ascending: true })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error("Error fetching hub links:", err)
    return NextResponse.json(
      { error: err.message || "Failed to fetch hub links" },
      { status: err.status || 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdminAccess()

    const body = await req.json()
    const validated = CreateHubLinkSchema.parse(body)

    const supabase = getSupabaseServer()

    // Get max position for this theme
    const { data: existing } = await supabase
      .from("hub_theme_links")
      .select("position")
      .eq("theme", validated.theme)
      .order("position", { ascending: false })
      .limit(1)

    const nextPosition = (existing?.[0]?.position ?? -1) + 1

    const { data, error } = await supabase
      .from("hub_theme_links")
      .insert({
        ...validated,
        position: nextPosition,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error("Error creating hub link:", err)
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: err.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: err.message || "Failed to create hub link" },
      { status: err.status || 500 }
    )
  }
}
```

- [ ] **Step 2: Create [id] endpoint for PUT/DELETE**

```typescript
// src/app/api/admin/hub-links/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase"
import { UpdateHubLinkSchema } from "@/types/hub-links"
import { verifyAdminAccess } from "@/lib/auth"

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await verifyAdminAccess()

    const body = await req.json()
    const validated = UpdateHubLinkSchema.parse(body)

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("hub_theme_links")
      .update(validated)
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Link not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error("Error updating hub link:", err)
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: err.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: err.message || "Failed to update hub link" },
      { status: err.status || 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await verifyAdminAccess()

    const supabase = getSupabaseServer()
    const { error } = await supabase
      .from("hub_theme_links")
      .delete()
      .eq("id", params.id)

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Link not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ success: true }, { status: 204 })
  } catch (err: any) {
    console.error("Error deleting hub link:", err)
    return NextResponse.json(
      { error: err.message || "Failed to delete hub link" },
      { status: err.status || 500 }
    )
  }
}
```

- [ ] **Step 3: Test endpoints with curl or Postman**

Create: `curl http://localhost:3000/api/admin/hub-links`
Expected: Returns 200 with empty array (or existing links)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/hub-links/
git commit -m "feat: add CRUD API endpoints for hub links"
```

---

### Task 4: API Route — Reorder Endpoint

**Files:**
- Create: `src/app/api/admin/hub-links/reorder/route.ts`

**Interfaces:**
- Consumes: `ReorderInput` from Task 2
- Produces: Bulk position update endpoint

- [ ] **Step 1: Create reorder endpoint**

```typescript
// src/app/api/admin/hub-links/reorder/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase"
import { ReorderSchema } from "@/types/hub-links"
import { verifyAdminAccess } from "@/lib/auth"

export async function PUT(req: NextRequest) {
  try {
    await verifyAdminAccess()

    const body = await req.json()
    const validated = ReorderSchema.parse(body)

    const supabase = getSupabaseServer()

    // Update each link's position
    await Promise.all(
      validated.updates.map(({ id, position }) =>
        supabase
          .from("hub_theme_links")
          .update({ position })
          .eq("id", id)
      )
    )

    // Return updated links
    const { data, error } = await supabase
      .from("hub_theme_links")
      .select("*")
      .order("position", { ascending: true })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error("Error reordering hub links:", err)
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: err.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: err.message || "Failed to reorder hub links" },
      { status: err.status || 500 }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/hub-links/reorder/route.ts
git commit -m "feat: add reorder endpoint for hub links"
```

---

### Task 5: Admin Page & Layout

**Files:**
- Create: `src/app/dashboard/admin/hub-links/page.tsx`

**Interfaces:**
- Consumes: API routes from Tasks 3-4
- Produces: Main page component with two-column layout

- [ ] **Step 1: Create page component**

```typescript
// src/app/dashboard/admin/hub-links/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useAppStore } from "@/store/store"
import { HubLink } from "@/types/hub-links"
import { HubLinksEditor } from "@/components/admin/HubLinksEditor"
import { HubLinksPreview } from "@/components/admin/HubLinksPreview"
import { useToast } from "@/hooks/useToast" // Assume exists

export default function HubLinksAdminPage() {
  const { profile } = useAppStore()
  const { toast } = useToast()
  
  const [links, setLinks] = useState<HubLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check admin access
  useEffect(() => {
    if (profile?.role !== "sysadmin") {
      setError("Unauthorized: Admin access required")
      return
    }
  }, [profile])

  // Fetch links on mount
  useEffect(() => {
    const fetchLinks = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/admin/hub-links")
        if (!res.ok) throw new Error("Failed to fetch links")
        const { data } = await res.json()
        setLinks(data)
      } catch (err: any) {
        setError(err.message)
        toast({ title: "Error", description: err.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

    fetchLinks()
  }, [toast])

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{error}</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configuração do Hub</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie os links e recursos exibidos no Hub Maker para makers 3D.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor - 60% on desktop */}
        <div className="lg:col-span-2">
          <HubLinksEditor
            links={links}
            onLinksChange={setLinks}
            loading={loading}
            onError={(msg) => toast({ title: "Error", description: msg, variant: "destructive" })}
          />
        </div>

        {/* Preview - 40% on desktop */}
        <div className="lg:col-span-1">
          <HubLinksPreview links={links.filter((l) => l.is_active)} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/admin/hub-links/page.tsx
git commit -m "feat: create hub-links admin page with two-column layout"
```

---

### Task 6: HubLinkForm Component

**Files:**
- Create: `src/components/admin/HubLinkForm.tsx`

**Interfaces:**
- Consumes: `CreateHubLinkInput`, `UpdateHubLinkInput`, `HubLink` from Task 2
- Produces: Form component with validation and submit handler

- [ ] **Step 1: Create form component**

```typescript
// src/components/admin/HubLinkForm.tsx
"use client"

import { useState, useEffect } from "react"
import { HubLink, HubTheme, CreateHubLinkSchema } from "@/types/hub-links"
import { Button } from "@/components/ui/button" // Assume exists
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle } from "lucide-react"

const THEMES: { value: HubTheme; label: string }[] = [
  { value: "tutoriais", label: "Tutoriais" },
  { value: "ia", label: "Ferramentas IA" },
  { value: "calibracao", label: "Calibração" },
  { value: "comunidade", label: "Comunidade" },
]

interface HubLinkFormProps {
  link?: HubLink | null
  theme?: HubTheme
  onSubmit: (data: any) => Promise<void>
  onCancel?: () => void
  loading?: boolean
}

export function HubLinkForm({
  link,
  theme,
  onSubmit,
  onCancel,
  loading = false,
}: HubLinkFormProps) {
  const [formData, setFormData] = useState({
    theme: theme || ("tutoriais" as HubTheme),
    title: link?.title || "",
    description: link?.description || "",
    url: link?.url || "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    try {
      // Validate
      const validated = CreateHubLinkSchema.parse(formData)
      setSubmitting(true)
      await onSubmit(validated)
    } catch (err: any) {
      if (err.errors) {
        const errMap: Record<string, string> = {}
        err.errors.forEach((e: any) => {
          const path = e.path.join(".")
          errMap[path] = e.message
        })
        setErrors(errMap)
      } else {
        setErrors({ form: err.message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6">
      {errors.form && (
        <div className="flex gap-2 text-destructive text-sm">
          <AlertCircle size={16} className="mt-0.5" />
          <p>{errors.form}</p>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-foreground block mb-2">Tema</label>
        <Select value={formData.theme} onValueChange={(v) => setFormData({ ...formData, theme: v as HubTheme })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um tema" />
          </SelectTrigger>
          <SelectContent>
            {THEMES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground block mb-2">
          Título {errors.title && <span className="text-destructive">({errors.title})</span>}
        </label>
        <Input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Ex: Como precificar corretamente"
          disabled={submitting || loading}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground block mb-2">
          Descrição {errors.description && <span className="text-destructive">({errors.description})</span>}
        </label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Ex: Tutorial completo sobre estratégias de precificação"
          rows={3}
          disabled={submitting || loading}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground block mb-2">
          URL {errors.url && <span className="text-destructive">({errors.url})</span>}
        </label>
        <Input
          type="text"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          placeholder="Ex: https://youtube.com/watch?v=..."
          disabled={submitting || loading}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={submitting || loading}>
          {link ? "Salvar Alterações" : "Adicionar Link"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting || loading}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/HubLinkForm.tsx
git commit -m "feat: add HubLinkForm component with validation"
```

---

### Task 7: HubLinkCard Component

**Files:**
- Create: `src/components/admin/HubLinkCard.tsx`

**Interfaces:**
- Consumes: `HubLink` from Task 2
- Produces: Draggable card component

- [ ] **Step 1: Create card component**

```typescript
// src/components/admin/HubLinkCard.tsx
"use client"

import { HubLink } from "@/types/hub-links"
import { Button } from "@/components/ui/button"
import { GripVertical, Trash2, Edit2, ToggleRight, ToggleLeft } from "lucide-react"

interface HubLinkCardProps {
  link: HubLink
  isDragging?: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

export function HubLinkCard({
  link,
  isDragging,
  onEdit,
  onDelete,
  onToggle,
}: HubLinkCardProps) {
  return (
    <div
      className={`bg-card border border-border rounded-xl p-4 transition-all ${
        isDragging ? "opacity-50 scale-95 shadow-lg" : ""
      }`}
    >
      <div className="flex gap-3">
        <div className="text-muted-foreground mt-1 cursor-grab active:cursor-grabbing">
          <GripVertical size={20} />
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{link.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{link.description}</p>
          <p className="text-xs text-muted-foreground/70 mt-2 truncate">{link.url}</p>
        </div>

        <div className="flex gap-2 flex-col">
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggle}
            title={link.is_active ? "Desativar" : "Ativar"}
          >
            {link.is_active ? (
              <ToggleRight size={18} className="text-success" />
            ) : (
              <ToggleLeft size={18} className="text-muted-foreground" />
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} title="Editar">
            <Edit2 size={18} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} title="Deletar">
            <Trash2 size={18} className="text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/HubLinkCard.tsx
git commit -m "feat: add HubLinkCard draggable component"
```

---

### Task 8: HubLinksEditor Component

**Files:**
- Create: `src/components/admin/HubLinksEditor.tsx`

**Interfaces:**
- Consumes: `HubLink`, `HubTheme`, API routes from Tasks 3-4
- Produces: Left column editor with tabs, form, and draggable list

- [ ] **Step 1: Create editor component**

```typescript
// src/components/admin/HubLinksEditor.tsx
"use client"

import { useState, useCallback } from "react"
import { HubLink, HubTheme } from "@/types/hub-links"
import { HubLinkForm } from "./HubLinkForm"
import { HubLinkCard } from "./HubLinkCard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

const THEMES: { value: HubTheme; label: string }[] = [
  { value: "tutoriais", label: "Tutoriais" },
  { value: "ia", label: "Ferramentas IA" },
  { value: "calibracao", label: "Calibração" },
  { value: "comunidade", label: "Comunidade" },
]

interface HubLinksEditorProps {
  links: HubLink[]
  onLinksChange: (links: HubLink[]) => void
  loading?: boolean
  onError: (msg: string) => void
}

export function HubLinksEditor({
  links,
  onLinksChange,
  loading = false,
  onError,
}: HubLinksEditorProps) {
  const [activeTheme, setActiveTheme] = useState<HubTheme>("tutoriais")
  const [editingLink, setEditingLink] = useState<HubLink | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const themeLinks = links.filter((l) => l.theme === activeTheme)

  const handleCreateOrUpdate = useCallback(
    async (data: any) => {
      setSaving(true)
      try {
        if (editingLink) {
          // Update
          const res = await fetch(`/api/admin/hub-links/${editingLink.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          })
          if (!res.ok) throw new Error("Failed to update")
          const { data: updated } = await res.json()

          const newLinks = links.map((l) => (l.id === updated.id ? updated : l))
          onLinksChange(newLinks)
          setEditingLink(null)
        } else {
          // Create
          const res = await fetch("/api/admin/hub-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          })
          if (!res.ok) throw new Error("Failed to create")
          const { data: created } = await res.json()

          onLinksChange([...links, created])
          setActiveTheme(created.theme)
        }
      } catch (err: any) {
        onError(err.message)
      } finally {
        setSaving(false)
      }
    },
    [editingLink, links, onLinksChange, onError]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(id)
      try {
        const res = await fetch(`/api/admin/hub-links/${id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete")

        onLinksChange(links.filter((l) => l.id !== id))
      } catch (err: any) {
        onError(err.message)
      } finally {
        setDeleting(null)
      }
    },
    [links, onLinksChange, onError]
  )

  const handleToggle = useCallback(
    async (id: string) => {
      const link = links.find((l) => l.id === id)
      if (!link) return

      setSaving(true)
      try {
        const res = await fetch(`/api/admin/hub-links/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !link.is_active }),
        })
        if (!res.ok) throw new Error("Failed to toggle")
        const { data: updated } = await res.json()

        const newLinks = links.map((l) => (l.id === updated.id ? updated : l))
        onLinksChange(newLinks)
      } catch (err: any) {
        onError(err.message)
      } finally {
        setSaving(false)
      }
    },
    [links, onLinksChange, onError]
  )

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, draggableId } = result

      if (!destination) return
      if (source.index === destination.index) return

      // Reorder locally first
      const reordered = Array.from(themeLinks)
      const [moved] = reordered.splice(source.index, 1)
      reordered.splice(destination.index, 0, moved)

      // Update positions in state
      const newPositions = reordered.map((l, i) => ({ ...l, position: i }))
      const allLinks = links.map((l) => {
        const updated = newPositions.find((p) => p.id === l.id)
        return updated || l
      })
      onLinksChange(allLinks)

      // Persist to API
      try {
        const res = await fetch("/api/admin/hub-links/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates: newPositions.map((l) => ({ id: l.id, position: l.position })),
          }),
        })
        if (!res.ok) throw new Error("Failed to reorder")
      } catch (err: any) {
        onError(err.message)
        // Revert on error
        onLinksChange(links)
      }
    },
    [themeLinks, links, onLinksChange, onError]
  )

  return (
    <div className="space-y-6">
      <Tabs value={activeTheme} onValueChange={(v) => setActiveTheme(v as HubTheme)}>
        <TabsList className="grid grid-cols-4 w-full">
          {THEMES.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {THEMES.map((theme) => (
          <TabsContent key={theme.value} value={theme.value} className="space-y-4">
            {/* Form */}
            <HubLinkForm
              link={editingLink?.theme === theme.value ? editingLink : null}
              theme={theme.value}
              onSubmit={handleCreateOrUpdate}
              onCancel={() => setEditingLink(null)}
              loading={saving}
            />

            {/* Draggable List */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId={`theme-${theme.value}`}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`space-y-3 p-4 rounded-lg border-2 border-dashed ${
                      snapshot.isDraggingOver ? "border-primary bg-primary/5" : "border-transparent"
                    }`}
                  >
                    {themeLinks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhum link neste tema. Adicione um acima.
                      </p>
                    ) : (
                      themeLinks.map((link, index) => (
                        <Draggable key={link.id} draggableId={link.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <AlertDialog>
                                <HubLinkCard
                                  link={link}
                                  isDragging={snapshot.isDragging}
                                  onEdit={() => setEditingLink(link)}
                                  onToggle={() => handleToggle(link.id)}
                                  onDelete={() => {}} // Trigger via AlertDialog
                                />
                                <AlertDialogTrigger asChild>
                                  <button className="hidden" />
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogTitle>Deletar Link</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja deletar "{link.title}"?
                                  </AlertDialogDescription>
                                  <div className="flex gap-2 justify-end">
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(link.id)}
                                      disabled={deleting === link.id}
                                    >
                                      {deleting === link.id && <Loader2 className="mr-2 animate-spin" size={16} />}
                                      Deletar
                                    </AlertDialogAction>
                                  </div>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Install react-beautiful-dnd**

Run: `npm install react-beautiful-dnd @types/react-beautiful-dnd`
Expected: Packages installed

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/HubLinksEditor.tsx package.json package-lock.json
git commit -m "feat: add HubLinksEditor with drag-and-drop and tabs"
```

---

### Task 9: HubLinksPreview Component

**Files:**
- Create: `src/components/admin/HubLinksPreview.tsx`

**Interfaces:**
- Consumes: `HubLink[]` from main page
- Produces: Live preview of Hub Maker

- [ ] **Step 1: Create preview component**

```typescript
// src/components/admin/HubLinksPreview.tsx
"use client"

import { HubLink } from "@/types/hub-links"
import { PlayCircle, Download, Users } from "lucide-react"

interface HubLinksPreviewProps {
  links: HubLink[]
}

export function HubLinksPreview({ links }: HubLinksPreviewProps) {
  const groupedByTheme = {
    tutoriais: links.filter((l) => l.theme === "tutoriais"),
    ia: links.filter((l) => l.theme === "ia"),
    calibracao: links.filter((l) => l.theme === "calibracao"),
    comunidade: links.filter((l) => l.theme === "comunidade"),
  }

  return (
    <div className="space-y-8 pb-10 bg-card border border-border rounded-xl p-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Preview</h2>
        <p className="text-sm text-muted-foreground mt-1">Como ficará no Hub Maker</p>
      </div>

      {/* Community CTA */}
      {groupedByTheme.comunidade.length > 0 && (
        <section className="bg-gradient-to-r from-primary/20 to-cyan-500/20 border border-primary/30 rounded-xl p-6">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
              <Users className="text-primary" size={20} /> Comunidade
            </h3>
            {groupedByTheme.comunidade.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-primary hover:underline"
              >
                {link.title}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Tutoriais */}
      {groupedByTheme.tutoriais.length > 0 && (
        <section>
          <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <PlayCircle className="text-primary" size={20} /> Tutoriais
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {groupedByTheme.tutoriais.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg bg-card border border-border hover:border-primary transition-colors group"
              >
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                  {link.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* IA */}
      {groupedByTheme.ia.length > 0 && (
        <section>
          <h3 className="text-lg font-bold text-foreground mb-3">Ferramentas IA</h3>
          <div className="grid grid-cols-1 gap-3">
            {groupedByTheme.ia.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg bg-card border border-border hover:border-primary transition-colors group"
              >
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                  {link.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Calibração */}
      {groupedByTheme.calibracao.length > 0 && (
        <section>
          <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Download className="text-primary" size={20} /> Calibração (MakerWorld)
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {groupedByTheme.calibracao.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg bg-card border border-border hover:border-primary transition-colors group"
              >
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                  {link.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {Object.values(groupedByTheme).every((arr) => arr.length === 0) && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhum link ativo. Adicione links no editor à esquerda.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/HubLinksPreview.tsx
git commit -m "feat: add HubLinksPreview component for real-time preview"
```

---

### Task 10: Update DashboardSidebar

**Files:**
- Modify: `src/components/layout/DashboardSidebar.tsx`

**Interfaces:**
- Consumes: Existing sidebar structure
- Produces: New "Configuração do Hub" link in Admin section

- [ ] **Step 1: Add import for LinkIcon or Settings**

In the imports section, check if `Settings` is already imported. If not, add it:

```typescript
// Existing imports
import { Settings } from "lucide-react" // Add if not present
```

- [ ] **Step 2: Add link to items array**

Find the section where items are pushed for sysadmin (around line 126-133):

```typescript
if (isSysadmin) {
  sections.push({
    title: t("sidebar.admin", "Admin"),
    items: [
      { name: t("sidebar.adminPanel", "Painel Admin"), href: "/dashboard/admin", icon: ShieldAlert },
      { name: t("sidebar.photoCurator", "Curadoria de Fotos"), href: "/dashboard/photo-curator", icon: ScanSearch },
      { name: "Configuração do Hub", href: "/dashboard/admin/hub-links", icon: Settings }, // ADD THIS
    ],
  })
}
```

- [ ] **Step 3: Test sidebar link in browser**

Start dev server: `npm run dev`
Navigate to dashboard, check sidebar has new link
Click link → should navigate to `/dashboard/admin/hub-links`

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/DashboardSidebar.tsx
git commit -m "feat: add 'Configuração do Hub' link to admin sidebar"
```

---

### Task 11: Update Hub Maker Page

**Files:**
- Modify: `src/app/dashboard/hub/page.tsx`

**Interfaces:**
- Consumes: `HubLink[]` from API
- Produces: Dynamic Hub Maker page with database-driven links

- [ ] **Step 1: Update imports and fetch logic**

Replace the entire page with:

```typescript
"use client"

import { useEffect, useState } from "react"
import { PlayCircle, Download, Users } from "lucide-react"
import { HubLink } from "@/types/hub-links"

export default function HubPage() {
  const [links, setLinks] = useState<HubLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const res = await fetch("/api/admin/hub-links")
        if (!res.ok) throw new Error("Failed to fetch hub links")
        const { data } = await res.json()
        setLinks(data.filter((l: HubLink) => l.is_active))
      } catch (err) {
        console.error("Error fetching hub links:", err)
        // Fallback to empty array or hardcoded defaults
      } finally {
        setLoading(false)
      }
    }

    fetchLinks()
  }, [])

  const groupedByTheme = {
    tutoriais: links.filter((l) => l.theme === "tutoriais"),
    ia: links.filter((l) => l.theme === "ia"),
    calibracao: links.filter((l) => l.theme === "calibracao"),
    comunidade: links.filter((l) => l.theme === "comunidade"),
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Hub Maker</h1>
        <p className="text-muted-foreground mt-1">
          Recursos, tutoriais e arquivos úteis para você melhorar suas impressões.
        </p>
      </div>

      {/* Community CTA */}
      {groupedByTheme.comunidade.length > 0 && (
        <section className="bg-gradient-to-r from-primary/20 to-cyan-500/20 border border-primary/30 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Users className="text-primary" /> Comunidade Maker VIP
            </h2>
            <p className="text-muted-foreground">
              Junte-se a outros criadores no nosso grupo exclusivo. Tire dúvidas, compartilhe configurações de fatiador e tenha acesso a novidades em primeira mão.
            </p>
          </div>
          {groupedByTheme.comunidade[0] && (
            <a
              href={groupedByTheme.comunidade[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              {groupedByTheme.comunidade[0].title}
            </a>
          )}
        </section>
      )}

      {/* Tutoriais Section */}
      {groupedByTheme.tutoriais.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <PlayCircle className="text-primary" /> Tutoriais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {groupedByTheme.tutoriais.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-card border border-border rounded-xl p-4 hover:border-primary transition-colors group"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {link.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* IA Tools Section */}
      {groupedByTheme.ia.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">Ferramentas IA</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {groupedByTheme.ia.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors group"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {link.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Calibration Section */}
      {groupedByTheme.calibracao.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Download className="text-primary" /> Calibração (MakerWorld)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {groupedByTheme.calibracao.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors group"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {link.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Test in browser**

Start dev server: `npm run dev`
Navigate to `/dashboard/hub`
Verify links load (or show placeholders if no data)

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/hub/page.tsx
git commit -m "feat: update Hub Maker page to fetch links from database"
```

---

### Task 12: Verify Admin Access Control

**Files:**
- Check/verify: `src/lib/auth.ts` or similar (verify `verifyAdminAccess` exists)

**Interfaces:**
- Consumes: Existing auth utilities
- Produces: Confirmation that admin checks are in place

- [ ] **Step 1: Check if verifyAdminAccess helper exists**

Run: `grep -r "verifyAdminAccess" src/lib/`
Expected: Found in auth file

If not found, create it:

```typescript
// src/lib/auth.ts (add this function)
import { getSupabaseServer } from "@/lib/supabase"

export async function verifyAdminAccess() {
  const supabase = getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (error || profile?.role !== "sysadmin") {
    throw new Error("Admin access required")
  }

  return true
}
```

- [ ] **Step 2: Commit if added**

```bash
git add src/lib/auth.ts
git commit -m "feat: add verifyAdminAccess auth helper"
```

---

### Task 13: Integration Test

**Files:**
- Test manually via browser

**Interfaces:**
- Tests: Full CRUD workflow

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server runs on http://localhost:3000

- [ ] **Step 2: Navigate to admin page**

Go to: `http://localhost:3000/dashboard/admin/hub-links`
Expected: Page loads, sees "Configuração do Hub" heading

- [ ] **Step 3: Create a test link**

Form fills:
- Theme: "Tutoriais"
- Title: "Test Video"
- Description: "A test video link"
- URL: "https://youtube.com/watch?v=test"

Click "Adicionar Link" → should see success toast and card appear in preview

- [ ] **Step 4: Edit the link**

Click "Editar" on card → form pre-populates
Change title to "Updated Test Video"
Click "Salvar Alterações" → card updates

- [ ] **Step 5: Reorder link**

If multiple links in same theme, drag one card to different position → position updates in preview

- [ ] **Step 6: Toggle on/off**

Click toggle icon → link disappears from preview

- [ ] **Step 7: Delete link**

Click delete button → confirmation dialog → confirm → link removed

- [ ] **Step 8: Verify Hub Maker**

Go to: `http://localhost:3000/dashboard/hub`
Expected: Links appear matching the active ones from admin

- [ ] **Step 9: Take screenshots/notes**

Document any issues or UX improvements

- [ ] **Step 10: Commit test results**

```bash
git add .
git commit -m "test: manual integration test passed for hub-links admin"
```

---

## Summary

This plan breaks down the Hub Links Admin feature into 13 focused tasks:

1. **Database migration** — Create table
2. **Types & validation** — TypeScript and Zod schemas
3. **API CRUD** — Create, read, update endpoints
4. **API reorder** — Bulk position updates
5. **Admin page** — Main container with two-column layout
6. **Form component** — Create/edit link form with validation
7. **Card component** — Draggable card UI
8. **Editor component** — Tabs, form, draggable list
9. **Preview component** — Live Hub Maker preview
10. **Sidebar update** — Add link to navigation
11. **Hub page update** — Fetch from database
12. **Auth verification** — Ensure admin access control
13. **Integration test** — Full workflow verification

Each task is self-contained with clear inputs/outputs and includes code, test commands, and commit messages.

---

**Next Steps:**

Choose your execution approach:

1. **Subagent-Driven (Recommended)** — Fresh subagent per task, review checkpoints
2. **Inline Execution** — Execute all tasks in this session with batch reviews

Which approach?
