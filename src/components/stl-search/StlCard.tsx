import { useState } from "react";
import { Download, MessageSquare, Heart, ChevronLeft, ChevronRight, Layers, ImageIcon, Calendar, Check } from "lucide-react";
import { StlItem } from "@/lib/mockStlData";
import { useAppStore } from "@/store/store";
import { useTranslation } from "@/lib/translations";

/**
 * Format date to the active locale
 * Example: "2026-06-25T10:30:00Z" → "25 jun 2026"
 */
function formatDate(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface StlCardProps {
  item: StlItem;
  onDownload: (id: string) => void;
  onClick: (item: StlItem) => void;
  isFavorited: boolean;
  onToggleFavorite: (id: string) => void;
  cost?: number;
  isDownloading?: boolean;
  hasAccess?: boolean;
}

export function StlCard({
  item,
  onDownload,
  onClick,
  isFavorited,
  onToggleFavorite,
  cost = 0,
  isDownloading = false,
  hasAccess = false,
}: StlCardProps) {
  const photos = item.photos && item.photos.length > 0 ? item.photos : [item.imageUrl].filter(Boolean);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const { profile } = useAppStore();
  const isAdmin = profile?.role === "sysadmin";
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR';

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const validIndex = activePhotoIndex < photos.length ? activePhotoIndex : 0;

  return (
    <div 
      onClick={() => onClick(item)}
      className="flex flex-col bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all hover:scale-[1.01] duration-200 group cursor-pointer"
    >
      {/* Image Container with Mini Carousel */}
      <div className="relative w-full aspect-square overflow-hidden bg-muted/30">
        {photos[validIndex] ? (
          <img
            src={photos[validIndex]}
            alt={item.title}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 text-muted-foreground group-hover:scale-105 transition-transform duration-300">
            <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs font-bold uppercase tracking-wider opacity-50">{t("stlCard.noPhoto", "Sem Foto")}</span>
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.id);
          }}
          className={`absolute top-3 left-3 z-10 p-2 rounded-xl border backdrop-blur-md transition-all ${
            isFavorited
              ? "bg-red-500/20 border-red-500/40 text-red-500"
              : "bg-background/60 border-border/80 text-muted-foreground hover:text-foreground hover:bg-background/80"
          }`}
          title={isFavorited ? t("stlSearch.removeFavorite", "Remover dos Favoritos") : t("stlSearch.addFavorite", "Adicionar aos Favoritos")}
        >
          <Heart className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`} />
        </button>

        {/* Badge de partes (multi-arquivo) ou tamanho */}
        {item.parts_count && item.parts_count > 0 ? (
          <div className="absolute top-3 right-3 bg-primary/90 backdrop-blur-md text-primary-foreground text-[10px] px-2.5 py-1 rounded-full font-bold border border-primary/30 shadow-lg shadow-primary/20 flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            {t("stlCard.partsCount", "{count} partes").replace("{count}", String(item.parts_count + 1))}
          </div>
        ) : (
          <div className="absolute top-3 right-3 bg-background/60 backdrop-blur-md text-foreground text-xs px-2 py-1 rounded-md font-medium border border-border/60">
            {item.fileSize}
          </div>
        )}

        {/* Unlocked Badge */}
        {hasAccess && (
          <div className="absolute top-3 left-3 bg-green-900/40 border border-green-500/50 text-green-200 text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 backdrop-blur-sm">
            <Check className="w-3 h-3" />
            {t("stlSearch.unlocked", "Desbloqueado")}
          </div>
        )}

        {/* Printer Type Badge */}
        {item.printer_type && item.printer_type !== "all" && (
          <div className={`absolute bottom-3 left-3 z-10 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border backdrop-blur-md shadow-sm ${
            item.printer_type === "resin"
              ? "bg-purple-500/80 text-white border-purple-500/50 shadow-purple-500/20"
              : "bg-blue-500/80 text-white border-blue-500/50 shadow-blue-500/20"
          }`}>
            {item.printer_type === "resin" ? "Resina" : "FDM"}
          </div>
        )}

        {/* Hover Mini Carousel Controls */}
        {photos.length > 1 && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={handlePrevPhoto}
              className="p-1 bg-background/80 hover:bg-background text-foreground rounded-full border border-border/60 backdrop-blur-sm transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextPhoto}
              className="p-1 bg-background/80 hover:bg-background text-foreground rounded-full border border-border/60 backdrop-blur-sm transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mini Carousel Dots Indicator */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 bg-background/50 px-2 py-1 rounded-full backdrop-blur-sm">
            {photos.map((_, idx) => (
              <span
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === activePhotoIndex ? "bg-primary w-2.5" : "bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-base font-bold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>

        {/* Download Count & Upload Date */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Download className="w-3.5 h-3.5 text-emerald-500/70" />
            <span className="font-semibold">{item.downloadCount || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-500/70" />
            <span className="font-semibold">{formatDate(item.addedAt, locale)}</span>
          </div>
          {hasAccess && (
            <span className="text-green-600 font-semibold text-[10px] uppercase tracking-wider">Desbloqueado</span>
          )}
        </div>

        {/* Source info — visível apenas para admins */}
        {isAdmin && item.telegramGroupName && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs mt-auto mb-3">
            <MessageSquare className="w-4 h-4 text-primary/70" />
            <span className="truncate">{item.telegramGroupName}</span>
          </div>
        )}

        {/* Multi-part indicator */}
        {item.parts_count && item.parts_count > 0 ? (
          <div className="flex items-center gap-1.5 text-[10px] text-primary font-semibold bg-primary/8 border border-primary/20 rounded-lg px-2.5 py-1.5 mb-3">
            <Layers className="w-3 h-3" />
            <span>Modelo com {item.parts_count + 1} arquivos · ver partes no modal</span>
          </div>
        ) : null}

        {/* Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload(item.id);
          }}
          disabled={isDownloading || hasAccess}
          className={`w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
            isDownloading
              ? "bg-muted text-muted-foreground border-border cursor-not-allowed"
              : hasAccess
              ? "bg-green-900/40 border-green-500/50 text-green-200 cursor-default hover:bg-green-900/40"
              : "bg-primary border-primary hover:bg-transparent text-primary-foreground hover:text-primary shadow-sm"
          }`}
        >
          {isDownloading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
              <span>Baixando...</span>
            </>
          ) : hasAccess ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Desbloqueado</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              {cost > 0 ? `Download (${cost} crd)` : "Grátis"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
