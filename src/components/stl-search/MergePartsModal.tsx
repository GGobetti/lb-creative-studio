"use client";

import { useState } from "react";
import { X, Layers, Check, Crown, Loader2, GitMerge, AlertTriangle } from "lucide-react";
import { StlItem } from "@/lib/mockStlData";
import { getSupabaseBrowser } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

interface MergePartsModalProps {
  selectedItems: StlItem[];
  onClose: () => void;
  onMergeSuccess: (parentId: string, childIds: string[]) => void;
}

export function MergePartsModal({ selectedItems, onClose, onMergeSuccess }: MergePartsModalProps) {
  const [parentId, setParentId] = useState<string>(selectedItems[0]?.id || "");
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parent = selectedItems.find((i) => i.id === parentId);
  const children = selectedItems.filter((i) => i.id !== parentId);

  const handleConfirmMerge = async () => {
    if (!parentId || children.length === 0) return;
    setIsMerging(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowser();
      const childIds = children.map((c) => c.id);

      const { error: updateError } = await supabase
        .from("telegram_indexed_stls")
        .update({ parent_id: parentId })
        .in("id", childIds);

      if (updateError) throw updateError;

      onMergeSuccess(parentId, childIds);
    } catch (err: any) {
      console.error("Erro ao mesclar partes:", err);
      setError(err.message || "Falha ao mesclar. Tente novamente.");
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: "spring", duration: 0.38, bounce: 0.12 }}
          className="relative w-full max-w-lg bg-card border border-border rounded-3xl overflow-hidden shadow-2xl z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl ring-1 ring-primary/20">
                <GitMerge className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-black text-foreground">Mesclar Partes</h2>
                <p className="text-[11px] text-muted-foreground">
                  {selectedItems.length} arquivos serão agrupados em 1 modelo
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full border border-border transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Instruction */}
            <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-xl px-4 py-3 leading-relaxed">
              Selecione qual arquivo será o <strong className="text-foreground">item principal</strong> (pai). Os demais aparecerão como partes dentro do modal dele e serão ocultados da listagem principal.
            </p>

            {/* Items list */}
            <div className="space-y-2">
              {selectedItems.map((item) => {
                const isSelected = item.id === parentId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setParentId(item.id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary/50 bg-primary/8 shadow-sm shadow-primary/10"
                        : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-muted border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{item.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">{item.fileSize}</p>
                    </div>

                    {/* Radio + Crown indicator */}
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-border bg-muted"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      {isSelected && (
                        <span className="text-[9px] font-black text-primary uppercase tracking-wider flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" /> Pai
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            {parent && (
              <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Resultado após merge
                </p>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-foreground">{parent.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      + {children.length} {children.length === 1 ? "parte" : "partes"}: {children.map((c) => c.title).join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 pt-0">
            <button
              onClick={onClose}
              disabled={isMerging}
              className="flex-1 py-2.5 px-4 rounded-full text-xs font-bold uppercase tracking-wider bg-muted hover:bg-muted/80 text-muted-foreground border border-border transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <motion.button
              onClick={handleConfirmMerge}
              disabled={isMerging || !parentId || children.length === 0}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-2.5 px-4 rounded-full text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed border border-primary transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm shadow-primary/20"
            >
              {isMerging ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mesclando...
                </>
              ) : (
                <>
                  <GitMerge className="w-3.5 h-3.5" />
                  Confirmar Merge
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
