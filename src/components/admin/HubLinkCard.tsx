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
      className={`bg-card border border-border rounded-xl p-4 transition-all overflow-hidden w-full max-w-full ${
        isDragging ? "opacity-50 scale-95 shadow-lg" : ""
      }`}
    >
      <div className="flex gap-3">
        <div className="text-muted-foreground mt-1 cursor-grab active:cursor-grabbing flex-shrink-0">
          <GripVertical size={20} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Thumbnail */}
          {link.thumbnail_url && (
            <div className="mb-3 rounded overflow-hidden border border-border/50">
              <img
                src={link.thumbnail_url}
                alt={link.title}
                className="w-full h-auto max-h-24 object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          )}

          {/* Content */}
          <h3 className="font-semibold text-foreground break-words">{link.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 break-words whitespace-normal">{link.description}</p>
          <p className="text-xs text-muted-foreground/70 mt-2 break-all">{link.url}</p>

          {/* Tags */}
          {link.tags && link.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {link.tags.map((tag) => (
                <span key={tag} className="inline-block px-2 py-0.5 text-xs rounded bg-primary/20 text-primary">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-col flex-shrink-0">
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
