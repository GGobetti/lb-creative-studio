"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { getSupabaseBrowser } from "@/lib/supabase"
import { ImageIcon, Package, RefreshCw, Loader2, ArrowRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { getPerceptualHash, hammingDistance } from "@/lib/imageHash"

export function AcervoTab() {
  const [indexedModels, setIndexedModels] = useState<any[]>([])
  const [indexedError, setIndexedError] = useState<string | null>(null)
  const [isFetchingIndexed, setIsFetchingIndexed] = useState(false)
  const [indexedPage, setIndexedPage] = useState(1)
  const [selectedIndexedModel, setSelectedIndexedModel] = useState<any | null>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)

  const fetchIndexedModels = useCallback(async () => {
    try {
      setIsFetchingIndexed(true)
      setIndexedError(null)
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from("telegram_indexed_stls")
        .select("*")
        .eq("has_appended_photos", true)
        .order("created_at", { ascending: false })
        .limit(300)

      if (error) throw error
      const models = data || []
      setIndexedModels(models)

      const checkAndFilterBanned = async (currentModels: any[]) => {
        try {
          const res = await fetch("/api/telegram/banned-images")
          if (!res.ok) return
          const { banned_hashes } = await res.json()
          if (!banned_hashes || banned_hashes.length === 0) return

          const modelsWithPhotos = currentModels.filter(m => m.photos?.length > 0)
          if (modelsWithPhotos.length === 0) return

          let hasModifications = false
          const updatedModels = [...currentModels]

          for (const model of modelsWithPhotos) {
            let modelModified = false
            const validPhotos: string[] = []
            for (const url of model.photos) {
              try {
                const hash = await getPerceptualHash(url)
                const isBanned = banned_hashes.some((banned: string) => hammingDistance(hash, banned) <= 10)
                if (!isBanned) {
                  validPhotos.push(url)
                } else {
                  modelModified = true
                  hasModifications = true
                }
              } catch {
                validPhotos.push(url)
              }
            }
            if (modelModified) {
              const idx = updatedModels.findIndex(m => m.id === model.id)
              if (idx > -1) {
                updatedModels[idx] = { ...updatedModels[idx], photos: validPhotos }
                await supabase.from("telegram_indexed_stls").update({ photos: validPhotos }).eq("id", model.id)
              }
            }
          }
          if (hasModifications) setIndexedModels(updatedModels)
        } catch (err) {
          console.error("Erro no auto-filtro (Acervo):", err)
        }
      }
      checkAndFilterBanned(models)
    } catch (err: any) {
      setIndexedError(err.message || "Erro desconhecido")
    } finally {
      setIsFetchingIndexed(false)
    }
  }, [])

  useEffect(() => {
    fetchIndexedModels()
  }, [fetchIndexedModels])

  const handleRemovePhoto = async (modelId: string, photoIndex: number) => {
    try {
      const model = indexedModels.find(m => m.id === modelId)
      if (!model?.photos) return
      const newPhotos = [...model.photos]
      newPhotos.splice(photoIndex, 1)
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.from("telegram_indexed_stls").update({ photos: newPhotos }).eq("id", modelId)
      if (error) throw error
      setIndexedModels(prev => prev.map(m => m.id === modelId ? { ...m, photos: newPhotos } : m))
      if (selectedIndexedModel?.id === modelId) {
        setSelectedIndexedModel({ ...selectedIndexedModel, photos: newPhotos })
        if (activePhotoIndex >= newPhotos.length) setActivePhotoIndex(Math.max(0, newPhotos.length - 1))
      }
    } catch {
      alert("Erro ao remover a foto.")
    }
  }

  const handleMarkAsReviewed = async (modelId: string) => {
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.from("telegram_indexed_stls").update({ has_appended_photos: false }).eq("id", modelId)
      if (error) throw error
      setIndexedModels(prev => prev.filter(m => m.id !== modelId))
      setSelectedIndexedModel(null)
    } catch {
      alert("Erro ao marcar modelo como revisado.")
    }
  }

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm("Tem certeza que deseja excluir este modelo inteiro do acervo?")) return
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.from("telegram_indexed_stls").delete().eq("id", modelId)
      if (error) throw error
      setIndexedModels(prev => prev.filter(m => m.id !== modelId))
      if (selectedIndexedModel?.id === modelId) setSelectedIndexedModel(null)
    } catch {
      alert("Erro ao excluir o modelo.")
    }
  }

  const ITEMS_PER_PAGE = 24
  const totalIndexedPages = Math.ceil(indexedModels.length / ITEMS_PER_PAGE)
  const paginatedModels = indexedModels.slice((indexedPage - 1) * ITEMS_PER_PAGE, indexedPage * ITEMS_PER_PAGE)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ImageIcon className="text-primary" size={20} />
              Revisão de Fotos Mescladas
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie os modelos duplicados que receberam novas fotos do scraper.
            </p>
          </div>
          <button
            onClick={fetchIndexedModels}
            className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} className={isFetchingIndexed ? "animate-spin" : ""} />
            Atualizar Lista
          </button>
        </div>

        <div className="p-6">
          {isFetchingIndexed ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="animate-spin text-primary" size={32} />
              <p className="text-sm text-muted-foreground">Buscando acervo no banco de dados...</p>
            </div>
          ) : indexedError ? (
            <div className="p-12 text-center text-sm text-red-400 border border-red-500/20 bg-red-500/5 rounded-xl">
              Falha ao carregar modelos indexados: {indexedError}
            </div>
          ) : indexedModels.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum modelo indexado encontrado no banco.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {paginatedModels.map((model) => {
                  const hasPhotos = model.photos && model.photos.length > 0
                  const dbThumb = model.thumbnail_url?.includes("unsplash") ? "" : model.thumbnail_url
                  const thumbUrl = hasPhotos ? model.photos[0] : dbThumb
                  const formattedSize = model.file_size_bytes
                    ? `${(model.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                    : "N/A"

                  return (
                    <div key={model.id} className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:border-amber-500/30 transition-all flex flex-col justify-between shadow-md">
                      <div className="relative aspect-video w-full bg-muted overflow-hidden">
                        {hasPhotos ? (
                          <img src={thumbUrl} alt={model.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 text-muted-foreground group-hover:scale-105 transition-transform duration-500">
                            <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                            <span className="text-xs font-bold uppercase tracking-wider opacity-50">Sem Foto</span>
                          </div>
                        )}
                        <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/70 backdrop-blur-sm text-[10px] font-bold text-amber-400 border border-amber-500/30">
                          {formattedSize}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedIndexedModel(model); setActivePhotoIndex(0) }}
                          className="absolute inset-0 z-10 w-full h-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-bold backdrop-blur-sm cursor-pointer"
                        >
                          Gerenciar {hasPhotos && `(${model.photos.length} foto${model.photos.length > 1 ? "s" : ""})`}
                        </button>
                      </div>
                      <div className="p-4">
                        <h4 className="font-bold text-sm text-foreground line-clamp-2" title={model.file_name}>{model.file_name}</h4>
                        <div className="mt-2 text-[11px] text-muted-foreground flex justify-between items-center">
                          <span>Indexado em:</span>
                          <span>{new Date(model.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {totalIndexedPages > 1 && (
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                  <div className="text-sm text-muted-foreground font-medium">
                    Página {indexedPage} de {totalIndexedPages} (Total: {indexedModels.length})
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setIndexedPage(p => Math.max(1, p - 1))} disabled={indexedPage === 1} className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Anterior</button>
                    <button onClick={() => setIndexedPage(p => Math.min(totalIndexedPages, p + 1))} disabled={indexedPage === totalIndexedPages} className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Próxima</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de Gestão do Acervo */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {selectedIndexedModel && (
            <div key="indexed-modal" className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedIndexedModel(null)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-5xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
              >
                {/* Left: Images */}
                <div className="w-full md:w-3/5 bg-muted/50 relative flex items-center justify-center min-h-[300px]">
                  {selectedIndexedModel.photos && selectedIndexedModel.photos.length > 0 ? (
                    <>
                      <img src={selectedIndexedModel.photos[activePhotoIndex]} alt={`Foto ${activePhotoIndex + 1}`} className="max-w-full max-h-[70vh] object-contain" />
                      {selectedIndexedModel.photos.length > 1 && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(prev => prev > 0 ? prev - 1 : selectedIndexedModel.photos.length - 1) }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-all cursor-pointer border border-white/10">
                            <ArrowRight size={20} className="rotate-180" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(prev => prev < selectedIndexedModel.photos.length - 1 ? prev + 1 : 0) }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-all cursor-pointer border border-white/10">
                            <ArrowRight size={20} />
                          </button>
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-2 rounded-full bg-black/30 backdrop-blur-md">
                            {selectedIndexedModel.photos.map((_: any, idx: number) => (
                              <button key={idx} onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(idx) }} className={`w-2 h-2 rounded-full transition-all cursor-pointer ${idx === activePhotoIndex ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"}`} />
                            ))}
                          </div>
                        </>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm("Excluir apenas esta foto do modelo?")) handleRemovePhoto(selectedIndexedModel.id, activePhotoIndex) }}
                        className="absolute top-4 left-4 bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 backdrop-blur-md transition-all shadow-md"
                      >
                        Excluir Foto Atual
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-3">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <Package size={24} />
                      </div>
                      <p className="text-sm font-medium">Nenhuma imagem disponível</p>
                    </div>
                  )}
                </div>

                {/* Right: Info & Actions */}
                <div className="w-full md:w-2/5 p-6 flex flex-col max-h-[50vh] md:max-h-[90vh] overflow-y-auto">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <h3 className="text-xl font-bold text-foreground">Gerenciar Modelo</h3>
                    <button onClick={() => setSelectedIndexedModel(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted-foreground/20 text-muted-foreground transition-colors shrink-0">✕</button>
                  </div>
                  <div className="flex-1 space-y-6">
                    <div className="space-y-1 bg-muted/30 p-4 rounded-xl border border-border">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome Original (Arquivo)</p>
                      <p className="text-sm font-medium text-foreground break-all">{selectedIndexedModel.file_name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1 bg-muted/30 p-4 rounded-xl border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tamanho Real</p>
                        <p className="text-sm font-bold text-amber-500">
                          {selectedIndexedModel.file_size_bytes ? `${(selectedIndexedModel.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : "---"}
                        </p>
                      </div>
                      <div className="space-y-1 bg-muted/30 p-4 rounded-xl border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Origem</p>
                        <p className="text-sm font-medium text-foreground truncate" title={selectedIndexedModel.chat_title}>{selectedIndexedModel.chat_title || "Desconhecida"}</p>
                      </div>
                    </div>
                    <div className="space-y-1 bg-muted/30 p-4 rounded-xl border border-border">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Indexado Em</p>
                      <p className="text-sm font-medium text-foreground">{new Date(selectedIndexedModel.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-border flex flex-col gap-3">
                    <button onClick={() => handleMarkAsReviewed(selectedIndexedModel.id)} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer">
                      Marcar como Revisado (Ocultar)
                    </button>
                    <button onClick={() => handleDeleteModel(selectedIndexedModel.id)} className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer">
                      Excluir Modelo Inteiro do Acervo
                    </button>
                    <button onClick={() => setSelectedIndexedModel(null)} className="w-full py-2.5 bg-muted hover:bg-border text-foreground text-sm font-bold rounded-xl flex items-center justify-center transition-all cursor-pointer">
                      Fechar Janela
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
