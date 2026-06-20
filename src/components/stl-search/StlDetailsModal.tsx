import { useState, useEffect, useMemo } from "react";
import { X, Heart, Download, MessageSquare, Calendar, HardDrive, FileText, ChevronLeft, ChevronRight, Trash2, Send, Plus, Upload, Loader2, Layers, Unlink, Package, Star, ImageIcon } from "lucide-react";
import { StlItem } from "@/lib/mockStlData";
import { useAppStore } from "@/store/store";
import { getSupabaseBrowser } from "@/lib/supabase";
import { useTranslation } from "@/lib/translations";
import { motion, AnimatePresence } from "framer-motion";

interface StlDetailsModalProps {
  item: StlItem;
  onClose: () => void;
  onDownload: (id: string) => void;
  isFavorited: boolean;
  onToggleFavorite: (id: string) => void;
  cost: number;
  isDownloading?: boolean;
  onTagClick?: (tag: string) => void;
  onDeleteSuccess?: (id: string) => void;
  onPhotosUpdate?: (id: string, updatedPhotos: string[], updatedThumbnailUrl: string) => void;
  onUnmergeSuccess?: (parentId: string) => void;
  onPrinterTypeUpdate?: (id: string, newType: string) => void;
}

export function StlDetailsModal({
  item,
  onClose,
  onDownload,
  isFavorited,
  onToggleFavorite,
  cost,
  isDownloading = false,
  onTagClick,
  onDeleteSuccess,
  onPhotosUpdate,
  onUnmergeSuccess,
  onPrinterTypeUpdate,
}: StlDetailsModalProps) {
  const { profile } = useAppStore();
  const isAdmin = profile?.role === "sysadmin";
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"details" | "comments">("details");
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUnmerging, setIsUnmerging] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // ── Galeria unificada (fotos do pai + fotos das partes) ───────────
  const ownPhotos = item.photos && item.photos.length > 0 ? item.photos : [item.imageUrl].filter(Boolean);

  // Cada foto carrega o índice da parte a que pertence para o caption
  interface TaggedPhoto { url: string; partTitle: string | null }
  const allPhotos = useMemo<TaggedPhoto[]>(() => {
    const base: TaggedPhoto[] = ownPhotos.map((url) => ({ url, partTitle: null }));
    if (!item.parts || item.parts.length === 0) return base;
    const partPhotos: TaggedPhoto[] = item.parts.flatMap((part) =>
      (part.photos || []).map((url) => ({ url, partTitle: part.title }))
    );
    return [...base, ...partPhotos];
  }, [ownPhotos, item.parts]);

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  // reset index when item changes
  useEffect(() => { setActivePhotoIndex(0); }, [item.id]);

  const handleNext = () => setActivePhotoIndex((prev) => (prev + 1) % allPhotos.length);
  const handlePrev = () => setActivePhotoIndex((prev) => (prev - 1 + allPhotos.length) % allPhotos.length);

  const activePhoto = allPhotos[activePhotoIndex] ?? { url: item.imageUrl || "", partTitle: null };

  const formattedDate = new Date(item.addedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // ── Carregar comentários ──────────────────────────────────────────
  const fetchComments = async () => {
    try {
      setIsLoadingComments(true);
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("telegram_stl_comments")
        .select(`id, comment_text, created_at, user_id, profiles ( email )`)
        .eq("stl_id", item.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error("Erro ao carregar comentários:", err);
    } finally {
      setIsLoadingComments(false);
    }
  };

  useEffect(() => { fetchComments(); }, [item.id]);

  // ── Comentário submit ─────────────────────────────────────────────
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !profile) return;
    try {
      setIsSubmitting(true);
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from("telegram_stl_comments")
        .insert({ stl_id: item.id, user_id: profile.id, comment_text: newComment.trim() })
        .select(`id, comment_text, created_at, user_id, profiles ( email )`)
        .single();
      if (error) throw error;
      setComments((prev) => [...prev, data]);
      setNewComment("");
    } catch (err: any) {
      alert(err.message || "Falha ao publicar comentário.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Deletar comentário ────────────────────────────────────────────
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(t("stlSearch.confirmDeleteComment", "Tem certeza que deseja excluir este comentário?"))) return;
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.from("telegram_stl_comments").delete().eq("id", commentId);
      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      alert(err.message || "Falha ao excluir comentário.");
    }
  };

  // ── Deletar modelo (admin) ────────────────────────────────────────
  const handleDeleteModel = async () => {
    if (!confirm(t("stlSearch.confirmDeleteModel", `Tem certeza de que deseja EXCLUIR DEFINITIVAMENTE o modelo "{title}"? Esta ação é irreversível.`).replace("{title}", item.title))) return;
    try {
      setIsDeleting(true);
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.from("telegram_indexed_stls").delete().eq("id", item.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Permissão negada ou registro não encontrado.");
      alert(t("stlSearch.modelDeletedSuccess", `Modelo "{title}" excluído com sucesso.`).replace("{title}", item.title));
      if (onDeleteSuccess) onDeleteSuccess(item.id);
      onClose();
    } catch (err: any) {
      alert(err.message || "Falha ao excluir modelo.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Atualizar Tipo de Impressora (admin) ────────────────────────────────────
  const [isUpdatingPrinterType, setIsUpdatingPrinterType] = useState(false);
  const handleUpdatePrinterType = async (newType: string) => {
    try {
      setIsUpdatingPrinterType(true);
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.from("telegram_indexed_stls").update({ printer_type: newType }).eq("id", item.id);
      if (error) throw error;
      if (onPrinterTypeUpdate) onPrinterTypeUpdate(item.id, newType);
      item.printer_type = newType;
    } catch (err: any) {
      alert("Falha ao atualizar tipo: " + err.message);
    } finally {
      setIsUpdatingPrinterType(false);
    }
  };

  // ── Deletar foto ativa (admin) ────────────────────────────────────
  const handleDeletePhoto = async () => {
    // Only delete from the main item's own photos (not from parts)
    if (!item.photos || item.photos.length === 0) {
      alert(t("stlSearch.noPhotosToDelete", "Não há fotos associadas a este modelo para excluir."));
      return;
    }
    const photoToDelete = activePhoto.url;
    if (!item.photos.includes(photoToDelete)) {
      alert("Esta foto pertence a uma parte do modelo. Acesse a parte individualmente para gerenciá-la.");
      return;
    }
    if (!confirm(t("stlSearch.confirmDeletePhoto", "Tem certeza que deseja excluir esta imagem do modelo?"))) return;
    try {
      const supabase = getSupabaseBrowser();
      const updatedPhotos = item.photos.filter((p) => p !== photoToDelete);
      const defaultPlaceholder = "";
      const updatedThumbnailUrl = updatedPhotos.length > 0 ? updatedPhotos[0] : defaultPlaceholder;
      const { error } = await supabase.from("telegram_indexed_stls").update({ photos: updatedPhotos, thumbnail_url: updatedThumbnailUrl }).eq("id", item.id);
      if (error) throw error;
      if (photoToDelete.includes("/storage/v1/object/public/portfolio/")) {
        const pathPart = photoToDelete.split("/storage/v1/object/public/portfolio/")[1];
        if (pathPart) await supabase.storage.from("portfolio").remove([decodeURIComponent(pathPart)]);
      }
      if (activePhotoIndex >= updatedPhotos.length) setActivePhotoIndex(Math.max(0, updatedPhotos.length - 1));
      if (onPhotosUpdate) onPhotosUpdate(item.id, updatedPhotos, updatedThumbnailUrl);
    } catch (err: any) {
      alert(err.message || "Falha ao excluir imagem.");
    }
  };

  // ── Definir foto como capa (admin) ───────────────────────────────
  const handleSetCoverPhoto = async () => {
    const photoUrl = activePhoto.url;
    try {
      const supabase = getSupabaseBrowser();
      const currentPhotos = item.photos || [];
      
      // Coloca a imagem escolhida como primeira no array de fotos
      let updatedPhotos = [...currentPhotos];
      if (updatedPhotos.includes(photoUrl)) {
        updatedPhotos = updatedPhotos.filter((p) => p !== photoUrl);
      }
      updatedPhotos = [photoUrl, ...updatedPhotos];
      
      const { error } = await supabase
        .from("telegram_indexed_stls")
        .update({
          thumbnail_url: photoUrl,
          photos: updatedPhotos
        })
        .eq("id", item.id);
        
      if (error) throw error;
      
      if (onPhotosUpdate) {
        onPhotosUpdate(item.id, updatedPhotos, photoUrl);
      }
      
      setActivePhotoIndex(0);
    } catch (err: any) {
      alert(err.message || "Falha ao definir imagem de capa.");
    }
  };

  // ── Adicionar foto via URL (admin) ────────────────────────────────
  const handleAddPhotoUrl = async () => {
    const url = prompt(t("stlSearch.promptPhotoUrl", "Digite a URL da imagem:"));
    if (!url?.trim()) return;
    try {
      const supabase = getSupabaseBrowser();
      const currentPhotos = item.photos || [];
      const updatedPhotos = [...currentPhotos, url.trim()];
      const updatedThumbnailUrl = !item.imageUrl || item.imageUrl.includes("unsplash") ? url.trim() : item.imageUrl;
      const { error } = await supabase.from("telegram_indexed_stls").update({ photos: updatedPhotos, thumbnail_url: updatedThumbnailUrl }).eq("id", item.id);
      if (error) throw error;
      if (onPhotosUpdate) onPhotosUpdate(item.id, updatedPhotos, updatedThumbnailUrl);
      setActivePhotoIndex(allPhotos.length); // jump to new photo
    } catch (err: any) {
      alert(err.message || "Falha ao adicionar URL da imagem.");
    }
  };

  // ── Upload de foto (admin) ────────────────────────────────────────
  const handleUploadPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingPhoto(true);
      const supabase = getSupabaseBrowser();
      const fileExt = file.name.split(".").pop();
      const filePath = `telegram/manual/${item.id}/${Date.now()}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage.from("portfolio").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(filePath);
      const currentPhotos = item.photos || [];
      const updatedPhotos = [...currentPhotos, publicUrl];
      const updatedThumbnailUrl = !item.imageUrl || item.imageUrl.includes("unsplash") ? publicUrl : item.imageUrl;
      const { error: dbErr } = await supabase.from("telegram_indexed_stls").update({ photos: updatedPhotos, thumbnail_url: updatedThumbnailUrl }).eq("id", item.id);
      if (dbErr) throw dbErr;
      if (onPhotosUpdate) onPhotosUpdate(item.id, updatedPhotos, updatedThumbnailUrl);
      setActivePhotoIndex(allPhotos.length);
    } catch (err: any) {
      alert(err.message || "Falha ao fazer upload da imagem.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // ── Desagrupar partes (admin) ─────────────────────────────────────
  const handleUnmerge = async () => {
    if (!item.parts || item.parts.length === 0) return;
    if (!confirm(`Deseja desagrupar as ${item.parts.length} partes? Elas voltarão a aparecer individualmente no catálogo.`)) return;
    try {
      setIsUnmerging(true);
      const supabase = getSupabaseBrowser();
      const childIds = item.parts.map((p) => p.id);
      const { error } = await supabase.from("telegram_indexed_stls").update({ parent_id: null }).in("id", childIds);
      if (error) throw error;
      if (onUnmergeSuccess) onUnmergeSuccess(item.id);
      onClose();
    } catch (err: any) {
      alert(err.message || "Falha ao desagrupar.");
    } finally {
      setIsUnmerging(false);
    }
  };

  // ── Download de parte individual ──────────────────────────────────
  const handleDownloadPart = (partId: string) => {
    onDownload(partId);
  };

  const hasParts = item.parts && item.parts.length > 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
          className="relative w-full max-w-4xl bg-card border border-border rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh] md:max-h-[85vh] z-10 backdrop-blur-md"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full border border-border backdrop-blur-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* ── LEFT: Galeria Unificada ───────────────────────────── */}
          <div className="relative w-full md:w-1/2 aspect-square md:aspect-auto md:h-full min-h-[300px] md:min-h-[500px] bg-muted/20 flex items-center justify-center overflow-hidden border-r border-border/40">
            <AnimatePresence mode="wait">
              {activePhoto.url ? (
                <motion.img
                  key={activePhotoIndex}
                  src={activePhoto.url}
                  alt={`${item.title} - Foto ${activePhotoIndex + 1}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.22 }}
                  className="object-cover w-full h-full absolute"
                />
              ) : (
                <motion.div
                  key="no-photo"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.22 }}
                  className="absolute w-full h-full flex flex-col items-center justify-center bg-muted/50 text-muted-foreground"
                >
                  <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
                  <span className="text-sm font-bold uppercase tracking-wider opacity-50">Sem Foto</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Caption da parte ativa */}
            {activePhoto.partTitle && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                <Package className="w-3 h-3 text-primary" />
                {activePhoto.partTitle}
              </div>
            )}

            {/* Multi-part header badge */}
            {hasParts && (
              <div className="absolute top-4 left-4 z-10 bg-primary/90 backdrop-blur-sm text-primary-foreground text-[10px] font-bold px-3 py-1.5 rounded-full border border-primary/30 shadow-lg flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                {(item.parts?.length ?? 0) + 1} partes
              </div>
            )}

            {/* Admin Photo Controls (Cover Photo + Delete) */}
            {isAdmin && (
              <div className={`absolute z-10 flex gap-2 ${hasParts ? "top-14" : "top-4"} left-4`}>
                {activePhoto.url === item.imageUrl ? (
                  <div className="py-1.5 px-3 bg-primary/95 text-primary-foreground rounded-full border border-primary/30 backdrop-blur-md flex items-center gap-1 shadow-lg text-[9px] uppercase tracking-wider font-bold select-none">
                    <Star className="w-3 h-3 fill-current" />
                    <span>Capa</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSetCoverPhoto}
                    className="py-1.5 px-3 bg-background/90 hover:bg-muted text-foreground rounded-full border border-border backdrop-blur-md transition-all flex items-center gap-1 shadow-lg text-[9px] uppercase tracking-wider font-bold cursor-pointer"
                  >
                    <Star className="w-3 h-3 text-primary" />
                    <span>Definir Capa</span>
                  </button>
                )}

                {item.photos && item.photos.length > 0 && !activePhoto.partTitle && (
                  <button
                    onClick={handleDeletePhoto}
                    className="py-1.5 px-3 bg-destructive hover:opacity-90 text-destructive-foreground rounded-full border border-destructive/20 backdrop-blur-md transition-all flex items-center gap-1.5 shadow-lg text-[9px] uppercase tracking-wider font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                )}
              </div>
            )}

            {/* Add Photo Actions (Admin) */}
            {isAdmin && (
              <div className={`absolute z-10 flex gap-2 ${hasParts ? "top-14" : "top-4"} right-16`}>
                <button onClick={handleAddPhotoUrl} className="py-1.5 px-3 bg-background/90 hover:bg-muted text-foreground rounded-full border border-border backdrop-blur-md transition-all flex items-center gap-1.5 shadow-lg text-[9px] uppercase tracking-wider font-bold cursor-pointer">
                  <Plus className="w-3 h-3 text-primary" />
                  <span className="hidden sm:inline">Add URL</span>
                </button>
                <label className="py-1.5 px-3 bg-background/90 hover:bg-muted text-foreground rounded-full border border-border backdrop-blur-md transition-all flex items-center gap-1.5 shadow-lg text-[9px] uppercase tracking-wider font-bold cursor-pointer">
                  {isUploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3 text-primary" />}
                  <span className="hidden sm:inline">{isUploadingPhoto ? "Enviando..." : "Upload"}</span>
                  <input type="file" accept="image/*" onChange={handleUploadPhotoFile} disabled={isUploadingPhoto} className="hidden" />
                </label>
              </div>
            )}

            {/* Carousel arrows */}
            {allPhotos.length > 1 && (
              <>
                <button onClick={handlePrev} className="absolute left-4 p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full border border-border/45 backdrop-blur-sm transition-colors cursor-pointer z-10">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={handleNext} className="absolute right-4 p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full border border-border/45 backdrop-blur-sm transition-colors cursor-pointer z-10">
                  <ChevronRight className="w-4 h-4" />
                </button>
                {/* Dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 bg-black/30 px-2.5 py-1 rounded-full backdrop-blur-sm z-10">
                  {allPhotos.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${idx === activePhotoIndex ? "bg-primary w-3" : "bg-white/40 w-1.5"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── RIGHT: Detalhes ───────────────────────────────────── */}
          <div className="w-full md:w-1/2 p-6 md:p-7 flex flex-col justify-between overflow-y-auto bg-card">
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="shrink-0 mb-4">
                <div className="inline-flex items-center gap-1.5 bg-muted border border-border text-muted-foreground text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full mb-2">
                  <MessageSquare className="w-3 h-3 text-primary" />
                  <span>{item.telegramGroupName}</span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight mb-4">
                  {item.title}
                </h2>

                {/* Tabs */}
                <div className="flex border-b border-border gap-6">
                  <button
                    onClick={() => setActiveTab("details")}
                    className={`pb-2 text-[10px] uppercase tracking-wider font-bold transition-all border-b-2 ${activeTab === "details" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    Detalhes
                  </button>
                  <button
                    onClick={() => setActiveTab("comments")}
                    className={`pb-2 text-[10px] uppercase tracking-wider font-bold transition-all border-b-2 flex items-center gap-1.5 ${activeTab === "comments" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    Comentários <span className="bg-muted px-1.5 py-0.5 rounded-full text-[9px]">{comments.length}</span>
                  </button>
                </div>
              </div>

              {/* Scrollable tab content */}
              <div className="flex-1 overflow-y-auto pr-1 scrollbar-none mb-4">
                {activeTab === "details" ? (
                  <div className="space-y-4 fade-in">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {t("stlSearch.modalDesc", "Este modelo foi garimpado de nossa comunidade no Telegram e está disponível para download.")}
                    </p>

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => { if (onTagClick) onTagClick(tag); onClose(); }}
                            className="text-[10px] font-semibold bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/30 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* File metadata grid */}
                    <div className="grid grid-cols-2 gap-3 border-t border-b border-border py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                          <FileText className="w-3 h-3 text-muted-foreground/60" />
                          {t("stlSearch.fileName", "Arquivo")}
                        </span>
                        <span className="text-foreground font-mono text-[11px] truncate max-w-[140px]" title={item.fileName}>
                          {item.fileName}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                          <HardDrive className="w-3 h-3 text-muted-foreground/60" />
                          {t("stlSearch.fileSize", "Tamanho")}
                        </span>
                        <span className="text-foreground font-semibold text-[11px]">{item.fileSize}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                          <Calendar className="w-3 h-3 text-muted-foreground/60" />
                          {t("stlSearch.indexedAt", "Indexado")}
                        </span>
                        <span className="text-foreground font-medium text-[11px]">{formattedDate}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                          <Download className="w-3 h-3 text-muted-foreground/60" />
                          {t("stlSearch.downloadsDone", "Downloads")}
                        </span>
                        <span className="text-foreground font-bold text-[11px] flex items-center gap-1.5">
                          {item.downloadCount ?? 0}
                          <span className="text-[9px] text-muted-foreground uppercase font-semibold">vezes</span>
                        </span>
                      </div>
                    </div>

                    {/* ── Seção de Partes do Modelo ────────────── */}
                    {hasParts && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            <span className="text-[11px] font-black uppercase tracking-wider text-foreground">
                              Partes do Modelo
                            </span>
                            <span className="bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 rounded-full border border-primary/20">
                              {(item.parts?.length ?? 0) + 1} arquivos
                            </span>
                          </div>
                          {/* Unmerge button (admin only) */}
                          {isAdmin && (
                            <button
                              onClick={handleUnmerge}
                              disabled={isUnmerging}
                              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isUnmerging ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Unlink className="w-3 h-3" />
                              )}
                              Desagrupar
                            </button>
                          )}
                        </div>

                        {/* Arquivo principal (pai) */}
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Package className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-foreground">{item.title}</p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">{item.fileName}</p>
                            <p className="text-[10px] text-muted-foreground">{item.fileSize} · arquivo principal</p>
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 shrink-0">
                            Principal
                          </span>
                        </div>

                        {/* Partes filhas */}
                        {item.parts?.map((part, idx) => (
                          <motion.div
                            key={part.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:border-border/80 hover:bg-muted/30 transition-all"
                          >
                            <div className="p-2 bg-muted rounded-lg border border-border">
                              <Package className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-foreground">{part.title}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate">{part.fileName}</p>
                              <p className="text-[10px] text-muted-foreground">{part.fileSize}</p>
                            </div>
                            <motion.button
                              onClick={() => handleDownloadPart(part.id)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="shrink-0 flex items-center gap-1 py-1.5 px-3 rounded-full text-[9px] font-bold uppercase tracking-wider bg-muted border border-border hover:border-primary/40 hover:text-primary hover:bg-primary/5 text-muted-foreground transition-all cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              Baixar
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Comments tab */
                  <div className="flex flex-col h-full fade-in">
                    <div className="flex-1 space-y-2 mb-3">
                      {isLoadingComments ? (
                        <div className="text-center py-4 text-[10px] text-muted-foreground">
                          {t("common.loading", "Carregando...")}
                        </div>
                      ) : comments.length === 0 ? (
                        <div className="text-center py-8 text-[10px] text-muted-foreground border border-dashed border-border rounded-xl">
                          {t("stlSearch.noComments", "Nenhum comentário ainda. Seja o primeiro!")}
                        </div>
                      ) : (
                        comments.map((comment) => {
                          const username = comment.profiles?.email ? comment.profiles.email.split("@")[0] : "Usuário";
                          const commentDate = new Date(comment.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
                          const canDelete = (profile && profile.id === comment.user_id) || isAdmin;
                          return (
                            <div key={comment.id} className="bg-muted/30 border border-border/50 p-2.5 rounded-xl flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] font-bold text-foreground truncate max-w-[120px]">{username}</span>
                                  <span className="text-[8px] text-muted-foreground font-mono">{commentDate}</span>
                                </div>
                                <p className="text-foreground text-[11px] leading-relaxed break-words whitespace-pre-wrap">{comment.comment_text}</p>
                              </div>
                              {canDelete && (
                                <button onClick={() => handleDeleteComment(comment.id)} className="p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                    {profile ? (
                      <form onSubmit={handleSubmitComment} className="flex gap-2 shrink-0">
                        <input
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder={t("stlSearch.commentPlaceholder", "Escreva um comentário...")}
                          maxLength={300}
                          disabled={isSubmitting}
                          className="flex-1 bg-muted/30 border border-border rounded-full px-4 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                        />
                        <motion.button type="submit" disabled={isSubmitting || !newComment.trim()} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="p-2 bg-primary hover:opacity-90 text-primary-foreground rounded-full disabled:bg-muted disabled:text-muted-foreground transition-all flex items-center justify-center cursor-pointer shadow-sm">
                          <Send className="w-4 h-4" />
                        </motion.button>
                      </form>
                    ) : (
                      <div className="text-center py-2 text-[10px] text-muted-foreground bg-muted/40 border border-border rounded-full shrink-0">
                        {t("stlSearch.loginToComment", "Faça login para comentar.")}
                      </div>
                    )}
                  </div>
                )}

                {/* Printer Type Admin Control */}
                {isAdmin && (
                  <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border mt-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tipo (Admin):</span>
                    {isUpdatingPrinterType ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <select
                        value={item.printer_type || "fdm"}
                        onChange={(e) => handleUpdatePrinterType(e.target.value)}
                        className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="fdm">FDM</option>
                        <option value="resin">Resina</option>
                        <option value="all">Ambos</option>
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Action Buttons ─────────────────────────────────── */}
            <div className="flex flex-col gap-2 shrink-0 pt-2 border-t border-border/40">
              <div className="flex gap-2">
                {/* Favorite */}
                <motion.button
                  onClick={() => onToggleFavorite(item.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center justify-center px-4 py-2 rounded-full border transition-all cursor-pointer shadow-sm ${
                    isFavorited
                      ? "bg-red-500/10 border-red-500/40 text-red-500 hover:bg-red-500/20"
                      : "bg-background/50 border-border/80 hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorited ? "fill-current" : ""}`} />
                </motion.button>

                {/* Download: "Baixar Tudo" if has parts, else single download */}
                <motion.button
                  onClick={() => onDownload(item.id)}
                  disabled={isDownloading || isDownloadingAll}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm border ${
                    isDownloading || isDownloadingAll
                      ? "bg-muted text-muted-foreground cursor-not-allowed border-border/80"
                      : "bg-primary border-primary hover:bg-transparent text-primary-foreground hover:text-primary"
                  }`}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      <span>{t("stlSearch.downloading", "Baixando...")}</span>
                    </>
                  ) : hasParts ? (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      <span>
                        {cost > 0
                          ? `Baixar Conjunto (${cost} crd)`
                          : `Baixar Arquivo Principal`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {cost > 0
                          ? t("stlSearch.downloadForCredits", "Baixar ({cost} crd)").replace("{cost}", cost.toString())
                          : t("stlSearch.downloadFree", "Download Grátis")}
                      </span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Admin: Unmerge + Delete */}
              {isAdmin && (
                <motion.button
                  onClick={handleDeleteModel}
                  disabled={isDeleting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full text-[9px] font-bold uppercase tracking-wider bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground text-destructive border border-destructive/20 hover:border-destructive transition-all cursor-pointer"
                >
                  {isDeleting ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /><span>{t("stlSearch.deletingModel", "Excluindo...")}</span></>
                  ) : (
                    <><Trash2 className="w-3 h-3" /><span>{t("stlSearch.deleteModel", "Excluir Modelo (Admin)")}</span></>
                  )}
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
