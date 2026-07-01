"use client"

import { useState } from "react"
import { HubLink, HubTheme, HubTag, CreateHubLinkSchema, PREDEFINED_TAGS } from "@/types/hub-links"
import { AlertCircle, Wand2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getYouTubeThumbnail, isYouTubeUrl } from "@/lib/youtube"

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

export function HubLinkForm({ link, theme, onSubmit, onCancel, loading = false }: HubLinkFormProps) {
  const [formData, setFormData] = useState({
    theme: theme || ("tutoriais" as HubTheme),
    title: link?.title || "",
    description: link?.description || "",
    url: link?.url || "",
    thumbnail_url: link?.thumbnail_url || "",
    tags: (link?.tags || []) as HubTag[],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const handleAutoDetect = () => {
    if (!formData.url) return
    const thumb = getYouTubeThumbnail(formData.url)
    if (thumb) setFormData((f) => ({ ...f, thumbnail_url: thumb }))
  }

  const toggleTag = (tag: HubTag) => {
    setFormData((f) => ({
      ...f,
      tags: f.tags.includes(tag)
        ? f.tags.filter((t) => t !== tag)
        : [...f.tags, tag],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    try {
      const payload = {
        ...formData,
        thumbnail_url: formData.thumbnail_url || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
      }
      const validated = CreateHubLinkSchema.parse(payload)
      setSubmitting(true)
      await onSubmit(validated)
      if (!link) {
        setFormData((f) => ({
          ...f,
          title: "",
          description: "",
          url: "",
          thumbnail_url: "",
          tags: [],
        }))
      }
    } catch (err: any) {
      if (err.errors) {
        const errMap: Record<string, string> = {}
        err.errors.forEach((e: any) => {
          errMap[e.path.join(".")] = e.message
        })
        setErrors(errMap)
      } else {
        setErrors({ form: err.message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = cn(
    "w-full rounded border px-3 py-2 bg-slate-800 text-white placeholder-slate-400",
    "border-slate-600 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-6 bg-slate-900/50 border-slate-700">
      {errors.form && (
        <div className="flex gap-2 rounded bg-red-900/30 p-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <p>{errors.form}</p>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">Tema</label>
        <select
          value={formData.theme}
          onChange={(e) => setFormData({ ...formData, theme: e.target.value as HubTheme })}
          disabled={submitting || loading}
          className={inputClass}
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
          Título {errors.title && <span className="text-red-400">({errors.title})</span>}
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Ex: Como precificar corretamente"
          disabled={submitting || loading}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          Descrição {errors.description && <span className="text-red-400">({errors.description})</span>}
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Ex: Tutorial completo sobre estratégias de precificação"
          rows={3}
          disabled={submitting || loading}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          URL {errors.url && <span className="text-red-400">({errors.url})</span>}
        </label>
        <input
          type="text"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          placeholder="Ex: https://youtube.com/watch?v=..."
          disabled={submitting || loading}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          Thumbnail (opcional) {errors.thumbnail_url && <span className="text-red-400">({errors.thumbnail_url})</span>}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={formData.thumbnail_url}
            onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
            placeholder="https://... (URL da imagem de capa)"
            disabled={submitting || loading}
            className={cn(inputClass, "flex-1")}
          />
          {isYouTubeUrl(formData.url) && (
            <button
              type="button"
              onClick={handleAutoDetect}
              disabled={submitting || loading}
              title="Auto-detectar thumbnail do YouTube"
              className="flex items-center gap-1.5 rounded border border-cyan-600 bg-cyan-600/20 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-600/40 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Wand2 size={14} />
              Auto YouTube
            </button>
          )}
        </div>
        {formData.thumbnail_url && (
          <img
            src={formData.thumbnail_url}
            alt="Preview thumbnail"
            className="mt-2 h-24 w-auto rounded border border-slate-600 object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
      </div>

      <div>
        <label className="mb-3 block text-sm font-medium text-slate-200">
          Tags (opcional)
        </label>
        <div className="flex flex-wrap gap-2">
          {PREDEFINED_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              disabled={submitting || loading}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors",
                formData.tags.includes(tag)
                  ? "bg-cyan-500 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              )}
            >
              {tag}
              {formData.tags.includes(tag) && <X size={14} />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={submitting || loading}
          className="rounded px-4 py-2 font-medium transition-colors bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50"
        >
          {link ? "Salvar Alterações" : "Adicionar Link"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting || loading}
            className="rounded px-4 py-2 font-medium transition-colors bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
