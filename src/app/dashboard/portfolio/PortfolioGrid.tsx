'use client'

import { Box } from 'lucide-react'
import { StlCard } from '@/components/stl-search/StlCard'
import type { UserStlPortfolio } from '@/lib/supabase'
import type { StlItem } from '@/lib/mockStlData'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a UserStlPortfolio row (from vw_user_stl_portfolio) into a StlItem
 * shape that StlCard can render. All acquisition-only fields are given
 * sensible defaults so no data is lost.
 */
function toStlItem(p: UserStlPortfolio): StlItem {
  return {
    id: p.stl_id,
    title: p.title,
    imageUrl: p.thumbnail_url ?? '',
    photos: p.thumbnail_url ? [p.thumbnail_url] : [],
    telegramGroupId: p.telegram_group_id,
    telegramGroupName: '',
    telegramMessageId: 0,
    fileSize: p.file_size_bytes > 0
      ? `${(p.file_size_bytes / 1_048_576).toFixed(1)} MB`
      : '—',
    addedAt: p.stl_created_at,
    description: p.description ?? undefined,
    tags: p.tags ?? [],
    downloadCount: 0,
    favoritesCount: 0,
    parts_count: p.parts_count > 1 ? p.parts_count - 1 : 0,
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex flex-col bg-card border border-border/60 rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-muted/50" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-8 bg-muted rounded-full mt-4" />
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

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
        <StlCard
          key={item.acquisition_id}
          item={toStlItem(item)}
          hasAccess={true}
          isFavorited={false}
          onDownload={() => {}}
          onClick={() => {}}
          onToggleFavorite={() => {}}
        />
      ))}
    </div>
  )
}
