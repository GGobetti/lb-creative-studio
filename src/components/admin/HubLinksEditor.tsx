"use client"

import { useState, useCallback } from "react"
import { HubLink, HubTheme } from "@/types/hub-links"
import { HubLinkForm } from "./HubLinkForm"
import { HubLinkCard } from "./HubLinkCard"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Trash2, X } from "lucide-react"
import { getSupabaseBrowser } from "@/lib/supabase"

async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await getSupabaseBrowser().auth.getSession()
  const token = session?.access_token ?? ""
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
}

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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  const themeLinks = links.filter((l) => l.theme === activeTheme)

  const handleCreateOrUpdate = useCallback(
    async (data: any) => {
      setSaving(true)
      try {
        if (editingLink) {
          // Update
          const res = await authedFetch(`/api/admin/hub-links/${editingLink.id}`, {
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
          const res = await authedFetch("/api/admin/hub-links", {
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
      setDeletingId(id)
      try {
        const res = await authedFetch(`/api/admin/hub-links/${id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete")

        onLinksChange(links.filter((l) => l.id !== id))
        setShowDeleteConfirm(null)
      } catch (err: any) {
        onError(err.message)
      } finally {
        setDeletingId(null)
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
        const res = await authedFetch(`/api/admin/hub-links/${id}`, {
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

  const handleReorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return

      // Reorder locally first
      const reordered = Array.from(themeLinks)
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, moved)

      // Update positions in state
      const newPositions = reordered.map((l, i) => ({ ...l, position: i }))
      const allLinks = links.map((l) => {
        const updated = newPositions.find((p) => p.id === l.id)
        return updated || l
      })
      onLinksChange(allLinks)

      // Persist to API
      try {
        const res = await authedFetch("/api/admin/hub-links/reorder", {
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
      {/* Tab Selector */}
      <div className="flex gap-2 border-b border-border">
        {THEMES.map((theme) => (
          <button
            key={theme.value}
            onClick={() => setActiveTheme(theme.value)}
            className={`relative px-4 py-3 font-medium text-sm transition-colors ${
              activeTheme === theme.value
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {theme.label}
            {activeTheme === theme.value && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Form */}
      <div>
        <HubLinkForm
          link={editingLink?.theme === activeTheme ? editingLink : null}
          theme={activeTheme}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => setEditingLink(null)}
          loading={saving}
        />
      </div>

      {/* List with Drag and Drop Support */}
      <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/20">
        {themeLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum link neste tema. Adicione um acima.
          </p>
        ) : (
          <div className="space-y-2">
            {themeLinks.map((link, index) => (
              <motion.div
                key={link.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", damping: 20, stiffness: 200 }}
                draggable
                onDragStart={() => setDraggingIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggingIndex !== null && draggingIndex !== index) {
                    handleReorder(draggingIndex, index)
                    setDraggingIndex(null)
                  }
                }}
                onDragEnd={() => setDraggingIndex(null)}
                className={`transition-opacity ${
                  draggingIndex === index ? "opacity-50" : "opacity-100"
                }`}
              >
                <div className="group flex items-center gap-3">
                  {/* Drag Handle */}
                  <div className="cursor-grab active:cursor-grabbing p-2 text-muted-foreground group-hover:text-foreground transition-colors">
                    <div className="flex flex-col gap-1">
                      <div className="w-1 h-1 rounded-full bg-current" />
                      <div className="w-1 h-1 rounded-full bg-current" />
                      <div className="w-1 h-1 rounded-full bg-current" />
                    </div>
                  </div>

                  {/* Card */}
                  <div className="flex-1">
                    <HubLinkCard
                      link={link}
                      isDragging={draggingIndex === index}
                      onEdit={() => setEditingLink(link)}
                      onToggle={() => handleToggle(link.id)}
                      onDelete={() => setShowDeleteConfirm(link.id)}
                    />
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => setShowDeleteConfirm(link.id)}
                    disabled={deletingId === link.id}
                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  >
                    {deletingId === link.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm mx-4 bg-card rounded-lg shadow-xl border border-border p-6 space-y-6"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>

              {/* Content */}
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">Deletar Link</h2>
                <p className="text-sm text-muted-foreground">
                  Tem certeza que deseja deletar este link? Esta ação não pode ser desfeita.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  disabled={deletingId !== null}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (showDeleteConfirm) {
                      handleDelete(showDeleteConfirm)
                    }
                  }}
                  disabled={deletingId !== null}
                  className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deletingId && <Loader2 size={16} className="animate-spin" />}
                  Deletar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
