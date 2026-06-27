"use client"

import { useState } from "react"
import { HubLink, HubTheme, CreateHubLinkSchema } from "@/types/hub-links"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

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
    <form
      onSubmit={handleSubmit}
      className={cn(
        "space-y-4 rounded-xl border p-6",
        "bg-slate-900/50 border-slate-700"
      )}
    >
      {errors.form && (
        <div className="flex gap-2 rounded bg-red-900/30 p-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <p>{errors.form}</p>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          Tema
        </label>
        <select
          value={formData.theme}
          onChange={(e) =>
            setFormData({ ...formData, theme: e.target.value as HubTheme })
          }
          disabled={submitting || loading}
          className={cn(
            "w-full rounded border px-3 py-2 bg-slate-800 text-white placeholder-slate-400",
            "border-slate-600 focus:border-cyan-500 focus:outline-none",
            "disabled:opacity-50"
          )}
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          Título{" "}
          {errors.title && (
            <span className="text-red-400">({errors.title})</span>
          )}
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) =>
            setFormData({ ...formData, title: e.target.value })
          }
          placeholder="Ex: Como precificar corretamente"
          disabled={submitting || loading}
          className={cn(
            "w-full rounded border px-3 py-2 bg-slate-800 text-white placeholder-slate-400",
            "border-slate-600 focus:border-cyan-500 focus:outline-none",
            "disabled:opacity-50"
          )}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          Descrição{" "}
          {errors.description && (
            <span className="text-red-400">({errors.description})</span>
          )}
        </label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Ex: Tutorial completo sobre estratégias de precificação"
          rows={3}
          disabled={submitting || loading}
          className={cn(
            "w-full rounded border px-3 py-2 bg-slate-800 text-white placeholder-slate-400",
            "border-slate-600 focus:border-cyan-500 focus:outline-none",
            "disabled:opacity-50"
          )}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          URL{" "}
          {errors.url && (
            <span className="text-red-400">({errors.url})</span>
          )}
        </label>
        <input
          type="text"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          placeholder="Ex: https://youtube.com/watch?v=..."
          disabled={submitting || loading}
          className={cn(
            "w-full rounded border px-3 py-2 bg-slate-800 text-white placeholder-slate-400",
            "border-slate-600 focus:border-cyan-500 focus:outline-none",
            "disabled:opacity-50"
          )}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={submitting || loading}
          className={cn(
            "rounded px-4 py-2 font-medium transition-colors",
            "bg-cyan-500 text-white hover:bg-cyan-600",
            "disabled:opacity-50"
          )}
        >
          {link ? "Salvar Alterações" : "Adicionar Link"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting || loading}
            className={cn(
              "rounded px-4 py-2 font-medium transition-colors",
              "bg-slate-700 text-white hover:bg-slate-600",
              "disabled:opacity-50"
            )}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
