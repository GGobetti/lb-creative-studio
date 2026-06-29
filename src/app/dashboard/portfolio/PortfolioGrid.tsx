'use client'

import { Box, Download, Calendar, CheckCircle, Layers, ImageIcon } from 'lucide-react'
import type { UserStlPortfolio } from '@/lib/supabase'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—'
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

// ─── Portfolio Card ───────────────────────────────────────────────────────────

function PortfolioCard({ item }: { item: UserStlPortfolio }) {
  const hasMultipleParts = item.parts_count > 1

  return (
    <div className="flex flex-col bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-cyan-400/30 hover:shadow-md transition-all hover:scale-[1.01] duration-200 group cursor-pointer">
      {/* Thumbnail */}
      <div className="relative w-full aspect-square overflow-hidden bg-muted/30">
        {item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 text-muted-foreground group-hover:scale-105 transition-transform duration-300">
            <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs font-bold uppercase tracking-wider opacity-50">Sem Foto</span>
          </div>
        )}

        {/* Unlocked badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1 bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Desbloqueado
        </div>

        {/* Parts count or file size */}
        {hasMultipleParts ? (
          <div className="absolute top-3 right-3 bg-primary/90 backdrop-blur-md text-primary-foreground text-[10px] px-2.5 py-1 rounded-full font-bold border border-primary/30 shadow-lg shadow-primary/20 flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            {item.parts_count} partes
          </div>
        ) : (
          <div className="absolute top-3 right-3 bg-background/60 backdrop-blur-md text-foreground text-xs px-2 py-1 rounded-md font-medium border border-border/60">
            {formatBytes(item.file_size_bytes)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-bold text-foreground line-clamp-2 mb-2 group-hover:text-cyan-400 transition-colors">
          {item.title}
        </h3>

        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2 flex-1">
            {item.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-500/70" />
            <span>{formatDate(item.acquired_at)}</span>
          </div>
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-muted border border-border/50 text-muted-foreground px-1.5 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Download button */}
        <button
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border cursor-pointer bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-3.5 h-3.5" />
          Baixar
        </button>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex flex-col bg-card border border-border/60 rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-muted/50" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-8 bg-muted rounded-full mt-4" />
      </div>
    </div>
  )
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

interface PortfolioGridProps {
  items: UserStlPortfolio[]
  isLoading?: boolean
}

export function PortfolioGrid({ items, isLoading = false }: PortfolioGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-2xl bg-muted/20">
        <Box className="w-14 h-14 text-muted-foreground/30 mb-4 animate-pulse" />
        <p className="text-lg font-bold text-foreground">Nenhum STL adquirido ainda</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Explore a busca de STLs e desbloqueie seus primeiros modelos.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item) => (
        <PortfolioCard key={item.acquisition_id} item={item} />
      ))}
    </div>
  )
}
