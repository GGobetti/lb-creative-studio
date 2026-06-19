import { StlItem } from "@/lib/mockStlData";
import { StlCard } from "./StlCard";
import { DotMatrixLoader } from "@/components/ui/DotMatrixLoader";
import { CheckCircle2, Circle } from "lucide-react";

interface StlGridProps {
  items: StlItem[];
  onDownload: (id: string) => void;
  onCardClick: (item: StlItem) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  isLoading?: boolean;
  cost?: number;
  downloadingIds?: string[];
  /** Ativa o modo de seleção múltipla para merge (admin only) */
  mergeMode?: boolean;
  /** IDs dos itens atualmente selecionados para merge */
  mergeSelection?: string[];
}

export function StlGrid({
  items,
  onDownload,
  onCardClick,
  favorites,
  onToggleFavorite,
  isLoading = false,
  cost = 0,
  downloadingIds = [],
  mergeMode = false,
  mergeSelection = [],
}: StlGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DotMatrixLoader text="Pesquisando modelos STL nos grupos..." />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <div className="bg-muted rounded-full p-6 mb-4">
          <svg className="w-12 h-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum STL encontrado</h3>
        <p className="text-muted-foreground max-w-md">
          Não conseguimos encontrar modelos 3D correspondentes a essa visualização ou busca.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
      {items.map((item) => {
        const isSelected = mergeSelection.includes(item.id);
        return (
          <div key={item.id} className="relative">
            <StlCard
              item={item}
              onDownload={onDownload}
              onClick={onCardClick}
              isFavorited={favorites.includes(item.id)}
              onToggleFavorite={onToggleFavorite}
              cost={cost}
              isDownloading={downloadingIds.includes(item.id)}
            />
            {/* Overlay de seleção no modo merge */}
            {mergeMode && (
              <button
                onClick={() => onCardClick(item)}
                className={`absolute inset-0 rounded-2xl border-2 transition-all cursor-pointer z-10 flex items-start justify-end p-3 ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                    : "border-transparent hover:border-primary/30 hover:bg-primary/5"
                }`}
                aria-label={isSelected ? "Desselecionar" : "Selecionar para merge"}
              >
                {isSelected ? (
                  <CheckCircle2 className="w-6 h-6 text-primary drop-shadow-md" />
                ) : (
                  <Circle className="w-6 h-6 text-primary/40" />
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
