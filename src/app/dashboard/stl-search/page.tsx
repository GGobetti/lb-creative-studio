"use client";

import { useState, useMemo, useEffect } from "react";
import { SearchBar } from "@/components/stl-search/SearchBar";
import { StlGrid } from "@/components/stl-search/StlGrid";
import { StlDetailsModal } from "@/components/stl-search/StlDetailsModal";
import { MergePartsModal } from "@/components/stl-search/MergePartsModal";
import { StlItem } from "@/lib/mockStlData";
import { PackageSearch, Heart, Trophy, TrendingUp, Loader2, Download, GitMerge, Trash2, X as XIcon, CheckSquare, Tag } from "lucide-react";
import { STL_CATEGORIES } from "@/types/games";
import { useAppStore } from "@/store/store";
import { getSupabaseBrowser } from "@/lib/supabase";
import { DotMatrixLoader } from "@/components/ui/DotMatrixLoader";
import { useToast } from "@/components/ui/Toast";

const usePageSize = () => {
  const [pageSize, setPageSize] = useState(28);

  useEffect(() => {
    const updatePageSize = () => {
      if (typeof window === 'undefined') return;

      const width = window.innerWidth;
      if (width >= 1280) {
        setPageSize(28); // xl: 4 columns
      } else if (width >= 1024) {
        setPageSize(24); // lg: 3 columns
      } else {
        setPageSize(20); // md/sm: 2 columns
      }
    };

    updatePageSize();
    window.addEventListener('resize', updatePageSize);
    return () => window.removeEventListener('resize', updatePageSize);
  }, []);

  return pageSize;
};

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function StlSearchPage() {
  const profile = useAppStore((s) => s.profile);
  const refreshCredits = useAppStore((s) => s.refreshCredits);
  const { toast } = useToast();
  const pageSize = usePageSize();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<StlItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [printerFilter, setPrinterFilter] = useState<"all" | "resin" | "fdm">("all");
  const [photoFilter, setPhotoFilter] = useState<"all" | "with_photo" | "without_photo">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StlItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [featureCost, setFeatureCost] = useState<number | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<string[]>([]);

  // Rankings state
  const [activeSearchTab, setActiveSearchTab] = useState<"explore" | "rankings">("explore");
  const [topDownloads, setTopDownloads] = useState<StlItem[]>([]);
  const [topFavorites, setTopFavorites] = useState<StlItem[]>([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);
  const [showMoreDownloads, setShowMoreDownloads] = useState(false);
  const [showMoreFavorites, setShowMoreFavorites] = useState(false);

  // Merge mode (admin only)
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  // Delete mode (admin only)
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = profile?.role === "sysadmin";

  // Debounce input search query (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Fetch feature cost from DB
  useEffect(() => {
    if (!profile) return;
    const getCost = async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data, error } = await supabase
          .from("feature_costs")
          .select("*")
          .eq("feature_key", "telegram_search")
          .single();
        if (!error && data) {
          const plan = profile.plan || "free";
          const downloadCost = plan === "max" 
            ? data.cost_max 
            : plan === "pro" 
              ? data.cost_pro 
              : data.cost_free;
          setFeatureCost(downloadCost);
        }
      } catch (err) {
        console.error("Error fetching telegram feature cost:", err);
      }
    };
    getCost();
  }, [profile]);

  // Fetch favorites on mount or profile load
  useEffect(() => {
    if (!profile) return;
    const fetchFavorites = async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data, error } = await supabase
          .from("telegram_user_favorites")
          .select("stl_id")
          .eq("user_id", profile.id);

        if (error) throw error;
        if (data) {
          setFavorites(data.map((fav: any) => fav.stl_id));
        }
      } catch (err) {
        console.error("Error fetching user favorites:", err);
      }
    };
    fetchFavorites();
  }, [profile]);

  // Reset para a primeira página sempre que filtros mudarem
  useEffect(() => {
    setPage(0);
    setItems([]);
  }, [debouncedQuery, printerFilter, photoFilter, categoryFilter]);

  // Fetch real STL files from Supabase telegram_indexed_stls (paginated)
  useEffect(() => {
    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const supabase = getSupabaseBrowser();
        const trimmed = debouncedQuery.trim();
        const isTagSearch = trimmed.startsWith("#");
        const rawTerm = trimmed.toLowerCase().replace(/^#/, "");

        let query = supabase
          .from("telegram_indexed_stls")
          .select("*")
          .is("parent_id", null) // filtro no DB, não no cliente
          .neq("id", "00000000-0000-0000-0000-000000000000") // ignora a caixinha de fotos
          .eq("needs_validation", false)
          .eq("marked_for_removal", false);

        if (trimmed) {
          if (isTagSearch) {
            // Busca por tag exata
            query = query.contains("tags", [rawTerm]);
          } else {
            // Partial text search (contains)
            query = query.or(`title.ilike.%${trimmed}%,file_name.ilike.%${trimmed}%`);
          }
        }

        if (categoryFilter) {
          query = query.contains("categories", [categoryFilter]);
        }

        if (printerFilter !== "all") {
          query = query.eq("printer_type", printerFilter);
        }

        if (photoFilter === "with_photo") {
          query = query.or('has_appended_photos.eq.true,thumbnail_url.not.is.null');
        } else if (photoFilter === "without_photo") {
          query = query.or('has_appended_photos.is.null,has_appended_photos.eq.false').is("thumbnail_url", null);
        }

        query = query.order("created_at", { ascending: false });

        if (!categoryFilter) {
          query = query.range(page * pageSize, (page + 1) * pageSize - 1);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data) {
          // Fetch deleted files to filter them out
          const { data: deletedFiles } = await supabase
            .from("user_deleted_files")
            .select("file_name, file_size_bytes");

          const deletedSet = new Set(
            (deletedFiles || []).map((d: any) => `${d.file_name}|${d.file_size_bytes}`)
          );

          const mapped = data
            .filter((item: any) => {
              const key = `${item.file_name}|${item.file_size_bytes}`;
              return !deletedSet.has(key);
            })
            .map((item: any) => ({
              id: item.id,
              title: item.title,
              imageUrl: item.thumbnail_url?.includes("unsplash") ? "" : item.thumbnail_url || "",
              telegramGroupId: item.telegram_group_id,
              telegramGroupName: item.telegram_group_name,
              telegramMessageId: Number(item.telegram_message_id),
              fileSize: formatBytes(item.file_size_bytes),
              fileSizeBytes: item.file_size_bytes,
              addedAt: item.created_at,
              photos: item.photos || [],
              downloadCount: item.download_count || 0,
              tags: item.tags || [],
              fileName: item.file_name,
              parent_id: item.parent_id ?? null,
              parts_count: item.parts_count ?? 0,
              printer_type: item.printer_type || "fdm"
            }));

          setItems(prev => page === 0 ? mapped : [...prev, ...mapped]);
          setHasMore(!categoryFilter && data.length === pageSize);
        }
      } catch (err) {
        console.error("Error fetching telegram stls:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [debouncedQuery, printerFilter, photoFilter, categoryFilter, page, pageSize]);

  const fetchRankings = async () => {
    setIsLoadingRankings(true);
    try {
      const supabase = getSupabaseBrowser();

      // Fetch deleted files to filter them out
      const { data: deletedFiles } = await supabase
        .from("user_deleted_files")
        .select("file_name, file_size_bytes");

      const deletedSet = new Set(
        (deletedFiles || []).map((d: any) => `${d.file_name}|${d.file_size_bytes}`)
      );

      const { data: dlData, error: dlErr } = await supabase
        .from("telegram_indexed_stls")
        .select("*")
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .eq("needs_validation", false)
        .eq("marked_for_removal", false)
        .order("download_count", { ascending: false })
        .limit(10);

      if (dlErr) throw dlErr;

      const { data: favData, error: favErr } = await supabase
        .from("telegram_indexed_stls")
        .select("*")
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .eq("needs_validation", false)
        .eq("marked_for_removal", false)
        .order("favorites_count", { ascending: false })
        .limit(10);

      if (favErr) throw favErr;

      const mapItem = (item: any) => ({
        id: item.id,
        title: item.title,
        imageUrl: item.thumbnail_url?.includes("unsplash") ? "" : item.thumbnail_url || "",
        telegramGroupId: item.telegram_group_id,
        telegramGroupName: item.telegram_group_name,
        telegramMessageId: Number(item.telegram_message_id),
        fileSize: formatBytes(item.file_size_bytes),
        addedAt: item.created_at,
        photos: item.photos || [],
        downloadCount: item.download_count || 0,
        favoritesCount: item.favorites_count || 0,
        tags: item.tags || [],
        fileName: item.file_name,
      });

      const filterDeleted = (items: any[]) =>
        items.filter((item: any) => {
          const key = `${item.file_name}|${item.file_size_bytes}`;
          return !deletedSet.has(key);
        });

      setTopDownloads(dlData ? filterDeleted(dlData).map(mapItem) : []);
      setTopFavorites(favData ? filterDeleted(favData).map(mapItem) : []);
    } catch (err) {
      console.error("Error fetching rankings:", err);
    } finally {
      setIsLoadingRankings(false);
    }
  };

  useEffect(() => {
    if (activeSearchTab === "rankings") {
      fetchRankings();
    }
  }, [activeSearchTab]);

  const plan = profile?.plan || "free";
  const cost = profile?.role === "sysadmin"
    ? 0
    : (featureCost !== null 
      ? featureCost 
      : plan === "free" 
        ? 1 
        : 0);

  // Filter items client-side if "only favorites" is active
  const displayedItems = useMemo(() => {
    if (showOnlyFavorites) {
      return items.filter((item) => favorites.includes(item.id));
    }
    return items;
  }, [items, favorites, showOnlyFavorites]);

  const handleToggleFavorite = async (id: string) => {
    if (!profile) {
      toast("Por favor, faça login para favoritar modelos.", "warning");
      return;
    }

    const isFav = favorites.includes(id);
    const supabase = getSupabaseBrowser();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      toast("Sessão expirada. Faça login novamente.", "error");
      return;
    }

    // Optimistic UI update
    const adjustment = isFav ? -1 : 1;
    const adjustItem = (i: StlItem) =>
      i.id === id ? { ...i, favoritesCount: Math.max(0, (i.favoritesCount || 0) + adjustment) } : i;

    if (isFav) {
      setFavorites((prev) => prev.filter((favId) => favId !== id));
    } else {
      setFavorites((prev) => [...prev, id]);
    }
    setTopDownloads((prev) => prev.map(adjustItem));
    setTopFavorites((prev) => prev.map(adjustItem));

    try {
      const res = await fetch("/api/telegram/favorite", {
        method: isFav ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        throw new Error("Falha ao salvar favorito no servidor.");
      }
    } catch (err) {
      console.error(err);
      // Revert optimistic update on failure
      const revertAdjustment = isFav ? 1 : -1;
      const revertItem = (i: StlItem) =>
        i.id === id ? { ...i, favoritesCount: Math.max(0, (i.favoritesCount || 0) + revertAdjustment) } : i;

      if (isFav) {
        setFavorites((prev) => [...prev, id]);
      } else {
        setFavorites((prev) => prev.filter((favId) => favId !== id));
      }
      setTopDownloads((prev) => prev.map(revertItem));
      setTopFavorites((prev) => prev.map(revertItem));
      toast("Não foi possível sincronizar o favorito. Tente novamente.", "error");
    }
  };

  // Ao abrir o modal, buscar as partes filhas e enriquecer o item
  const handleOpenItem = async (item: StlItem) => {
    // Se estiver em mergeMode, faz seleção em vez de abrir modal
    if (mergeMode) {
      setMergeSelection((prev) =>
        prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
      );
      return;
    }

    // Se estiver em deleteMode, faz seleção em vez de abrir modal
    if (deleteMode) {
      setDeleteSelection((prev) =>
        prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
      );
      return;
    }

    try {
      const supabase = getSupabaseBrowser();

      // Fetch deleted files to filter them out
      const { data: deletedFiles } = await supabase
        .from("user_deleted_files")
        .select("file_name, file_size_bytes");

      const deletedSet = new Set(
        (deletedFiles || []).map((d: any) => `${d.file_name}|${d.file_size_bytes}`)
      );

      const { data: parts } = await supabase
        .from("telegram_indexed_stls")
        .select("id, title, file_name, file_size_bytes, photos")
        .eq("parent_id", item.id)
        .order("created_at", { ascending: true });

      const filteredParts = (parts || []).filter((p: any) => {
        const key = `${p.file_name}|${p.file_size_bytes}`;
        return !deletedSet.has(key);
      });

      const itemWithParts: StlItem = {
        ...item,
        parts: filteredParts.map((p: any) => ({
          id: p.id,
          title: p.title,
          fileName: p.file_name,
          fileSize: formatBytes(p.file_size_bytes),
          fileSizeBytes: p.file_size_bytes,
          photos: p.photos || [],
        })),
      };
      setSelectedItem(itemWithParts);
    } catch (err) {
      console.error("Erro ao buscar partes:", err);
      setSelectedItem(item); // fallback: abre sem partes
    }
  };

  const handleMergeSuccess = (parentId: string, childIds: string[]) => {
    // Remove filhos da listagem e atualiza parts_count do pai
    setItems((prev) =>
      prev
        .filter((i) => !childIds.includes(i.id))
        .map((i) =>
          i.id === parentId
            ? { ...i, parts_count: (i.parts_count ?? 0) + childIds.length }
            : i
        )
    );
    setMergeMode(false);
    setMergeSelection([]);
    setIsMergeModalOpen(false);
  };

  const handleDeleteSelected = async () => {
    if (deleteSelection.length === 0) return;
    if (!confirm(`Tem certeza que deseja deletar ${deleteSelection.length} STL(s)? Não será possível recuperar.`)) return;

    setIsDeleting(true);
    try {
      const supabase = getSupabaseBrowser();

      // Get the items to delete (for file_name and file_size_bytes)
      const itemsToDelete = items.filter((i) => deleteSelection.includes(i.id));

      // Check which items are already in user_deleted_files
      const fileNames = itemsToDelete.map((item) => item.fileName);
      const { data: existingDeleted } = await supabase
        .from("user_deleted_files")
        .select("file_name, file_size_bytes")
        .in("file_name", fileNames);

      // Filter out items that are already deleted
      const newlyDeletedRecords = itemsToDelete
        .filter((item) => {
          const existing = existingDeleted?.find(
            (e: any) => e.file_name === item.fileName &&
                   e.file_size_bytes === item.fileSizeBytes
          );
          return !existing;
        })
        .map((item) => ({
          file_name: item.fileName,
          file_size_bytes: item.fileSizeBytes,
          deleted_at: new Date().toISOString()
        }));

      // Insert only new records
      if (newlyDeletedRecords.length > 0) {
        const { error: insertError } = await supabase
          .from("user_deleted_files")
          .insert(newlyDeletedRecords);

        if (insertError) throw insertError;
      }

      // Remove all from local state
      setItems((prev) => prev.filter((i) => !deleteSelection.includes(i.id)));
      setTopDownloads((prev) => prev.filter((i) => !deleteSelection.includes(i.id)));
      setTopFavorites((prev) => prev.filter((i) => !deleteSelection.includes(i.id)));

      const newCount = newlyDeletedRecords.length;
      const alreadyDeletedCount = deleteSelection.length - newCount;

      let message = `${newCount} STL(s) movido(s) para lixeira`;
      if (alreadyDeletedCount > 0) {
        message += ` (${alreadyDeletedCount} já estava(m) deletado(s))`;
      }
      message += ". Não será(ão) reprocessado(s)";

      toast(message, "success");

      setDeleteMode(false);
      setDeleteSelection([]);
    } catch (err) {
      console.error("Erro ao deletar STLs:", err);
      toast("Falha ao deletar STLs", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnmergeSuccess = (parentId: string) => {
    // Refresh the list to show the unmerged children again
    setItems((prev) =>
      prev.map((i) =>
        i.id === parentId ? { ...i, parts_count: 0 } : i
      )
    );
    setSelectedItem(null);
    // Full re-fetch to show the unmerged items
    const supabase = getSupabaseBrowser();
    supabase
      .from("user_deleted_files")
      .select("file_name, file_size_bytes")
      .then(({ data: deletedFiles }: { data: any[] | null }) => {
        const deletedSet = new Set(
          (deletedFiles || []).map((d: any) => `${d.file_name}|${d.file_size_bytes}`)
        );

        supabase
          .from("telegram_indexed_stls")
          .select("*")
          .is("parent_id", null)
          .neq("id", "00000000-0000-0000-0000-000000000000")
          .eq("needs_validation", false)
          .eq("marked_for_removal", false)
          .order("created_at", { ascending: false })
          .then(({ data }: { data: any[] | null }) => {
            if (data) {
              const filteredData = data.filter((item: any) => {
                const key = `${item.file_name}|${item.file_size_bytes}`;
                return !deletedSet.has(key);
              });

              setItems(
                filteredData.map((item: any) => ({
                  id: item.id,
                  title: item.title,
                  imageUrl: item.thumbnail_url?.includes("unsplash") ? "" : item.thumbnail_url || "",
                  telegramGroupId: item.telegram_group_id,
                  telegramGroupName: item.telegram_group_name,
                  telegramMessageId: Number(item.telegram_message_id),
                  fileSize: formatBytes(item.file_size_bytes),
                  fileSizeBytes: item.file_size_bytes,
                  addedAt: item.created_at,
                  photos: item.photos || [],
                  downloadCount: item.download_count || 0,
                  tags: item.tags || [],
                  fileName: item.file_name,
                  parent_id: item.parent_id ?? null,
                  parts_count: item.parts_count ?? 0,
                }))
              );
            }
          });
      });
  };

  const handleDownload = async (id: string) => {
    if (downloadingIds.includes(id)) return;

    const item = items.find((i) => i.id === id) || 
                 topDownloads.find((i) => i.id === id) || 
                 topFavorites.find((i) => i.id === id);
    if (!item) return;

    if (!profile) {
      toast("Por favor, faça login para baixar arquivos STL.", "warning");
      return;
    }

    if (profile.credits < cost) {
      toast(`Créditos insuficientes. Esta operação custa ${cost} crédito${cost !== 1 ? 's' : ''}. Saldo atual: ${profile.credits}`, "error");
      return;
    }

    setDownloadingIds((prev) => [...prev, id]);

    try {
      const supabase = getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast("Sessão expirada. Faça login novamente.", "error");
        setDownloadingIds((prev) => prev.filter((dId) => dId !== id));
        return;
      }

      // Download file and deduct credits in backend
      const res = await fetch("/api/telegram/download", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.error === "INSUFFICIENT_CREDITS") {
          toast("Créditos insuficientes para este download.", "error");
          setDownloadingIds((prev) => prev.filter((dId) => dId !== id));
          return;
        }
        throw new Error(json.error || "Erro ao processar download.");
      }

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("application/json")) {
        // Caminho R2: a API devolve uma presigned URL; baixamos direto do R2
        const { url: r2Url, fileName: r2Name } = await res.json();
        const a = document.createElement("a");
        a.href = r2Url;
        a.download = r2Name || `${item.title.replace(/\s+/g, "_")}.stl`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        // Caminho legado: stream binário vindo do proxy
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const contentDisposition = res.headers.get("Content-Disposition");
        let filename = `${item.title.replace(/\s+/g, "_")}.stl`;
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
          if (filenameMatch && filenameMatch[1]) {
            filename = decodeURIComponent(filenameMatch[1]);
          }
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }

      // Increment download counter locally for instant screen feedback
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, downloadCount: (i.downloadCount || 0) + 1 } : i
        )
      );
      setTopDownloads((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, downloadCount: (i.downloadCount || 0) + 1 } : i
        )
      );
      setTopFavorites((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, downloadCount: (i.downloadCount || 0) + 1 } : i
        )
      );

      if (selectedItem && selectedItem.id === id) {
        setSelectedItem((prev) =>
          prev ? { ...prev, downloadCount: (prev.downloadCount || 0) + 1 } : null
        );
      }

      // Update remaining credits in local state
      const remainingHeader = res.headers.get("X-Remaining-Credits");
      if (remainingHeader) {
        refreshCredits(parseInt(remainingHeader, 10));
      } else {
        const { data: freshProfile } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", profile.id)
          .single();
        if (freshProfile) {
          refreshCredits(freshProfile.credits);
        }
      }

      toast(`Download de "${item.title}" iniciado!`, "success");
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Falha ao processar download.", "error");
    } finally {
      setDownloadingIds((prev) => prev.filter((dId) => dId !== id));
    }
  };

  return (
    <div className="pb-20 text-foreground">
      {/* Header Section — compact bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 pb-6 border-b border-border">
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-primary/10 p-2 rounded-xl ring-1 ring-primary/20">
            <PackageSearch className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-foreground leading-tight">Garimpo 3D</h1>
            <p className="text-xs text-muted-foreground leading-tight">Sua mina de STLs prontos para impressão</p>
          </div>
        </div>
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar modelos, personagens ou grupos..."
          />
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-border gap-2 overflow-x-auto pb-px scrollbar-none mb-8">
        <button
          onClick={() => setActiveSearchTab("explore")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSearchTab === "explore"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Explorar Catálogo
        </button>
        <button
          onClick={() => setActiveSearchTab("rankings")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSearchTab === "rankings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          🏆 Rankings de Popularidade
        </button>
      </div>

      {activeSearchTab === "explore" ? (
        /* Results Section */
        <div className="py-2">
          {/* Category Filter */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categorias</span>
              {categoryFilter && (
                <button
                  onClick={() => setCategoryFilter(null)}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <XIcon className="w-3 h-3" /> Limpar filtro
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
                    categoryFilter === cat
                      ? "bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-600/30"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Printer Type Filter */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setPrinterFilter("all")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                printerFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setPrinterFilter("fdm")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                printerFilter === "fdm" 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              }`}
            >
              FDM
            </button>
            <button
              onClick={() => setPrinterFilter("resin")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                printerFilter === "resin" 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              }`}
            >
              Resina
            </button>
          </div>

          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-foreground">
                {mergeMode
                  ? `Selecione os arquivos para mesclar (${mergeSelection.length} selecionados)`
                  : showOnlyFavorites
                    ? "Favoritos salvos"
                    : categoryFilter
                      ? `Categoria: ${categoryFilter}${searchQuery ? ` · "${searchQuery}"` : ""}`
                      : searchQuery
                        ? `Resultados para "${searchQuery}"`
                        : "Modelos Recentes"}
              </h2>
              {!mergeMode && (
                <span className="text-xs text-muted-foreground font-semibold bg-muted border border-border px-3 py-1 rounded-full">
                  {displayedItems.length} encontrados
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Favorites Filter Toggle */}
              {profile && !mergeMode && (
                <button
                  onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                    showOnlyFavorites
                      ? "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20"
                      : "bg-muted border-border text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  <Heart className={`w-4 h-4 ${showOnlyFavorites ? "fill-current text-red-500" : ""}`} />
                  <span>{showOnlyFavorites ? "Ver Todos" : "Apenas Favoritos"}</span>
                </button>
              )}

              {/* Merge Mode (Admin only) */}
              {isAdmin && !mergeMode && !deleteMode && (
                <button
                  onClick={() => { setMergeMode(true); setMergeSelection([]); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 transition-all cursor-pointer"
                >
                  <GitMerge className="w-4 h-4" />
                  <span>Mesclar Partes</span>
                </button>
              )}

              {/* Delete Mode (Admin only) */}
              {isAdmin && !mergeMode && !deleteMode && (
                <button
                  onClick={() => { setDeleteMode(true); setDeleteSelection([]); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-rose-500/30 bg-rose-500/8 text-rose-500 hover:bg-rose-500/15 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Deletar em Massa</span>
                </button>
              )}

              {/* Merge mode actions */}
              {isAdmin && mergeMode && (
                <>
                  <button
                    onClick={() => { setMergeMode(false); setMergeSelection([]); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  >
                    <XIcon className="w-4 h-4" />
                    Cancelar
                  </button>
                  <button
                    disabled={mergeSelection.length < 2}
                    onClick={() => setIsMergeModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-primary bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm shadow-primary/20"
                  >
                    <GitMerge className="w-4 h-4" />
                    Mesclar ({mergeSelection.length})
                  </button>
                </>
              )}

              {/* Delete mode actions */}
              {isAdmin && deleteMode && (
                <>
                  <button
                    onClick={() => { setDeleteMode(false); setDeleteSelection([]); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  >
                    <XIcon className="w-4 h-4" />
                    Cancelar
                  </button>
                  <button
                    disabled={deleteSelection.length === 0 || isDeleting}
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-rose-600 bg-rose-600 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm shadow-rose-600/20"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Deletar ({deleteSelection.length})
                  </button>
                </>
              )}
            </div>
            
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setPhotoFilter("all")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  photoFilter === "all" 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setPhotoFilter("with_photo")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  photoFilter === "with_photo" 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                }`}
              >
                Com Foto
              </button>
              <button
                onClick={() => setPhotoFilter("without_photo")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  photoFilter === "without_photo" 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                }`}
              >
                Sem Foto
              </button>
            </div>
          </div>

          <StlGrid
            items={displayedItems}
            onDownload={handleDownload}
            onCardClick={handleOpenItem}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            isLoading={isLoading}
            cost={cost}
            downloadingIds={downloadingIds}
            mergeMode={mergeMode}
            mergeSelection={mergeSelection}
            deleteMode={deleteMode}
            deleteSelection={deleteSelection}
          />

          {!showOnlyFavorites && !categoryFilter && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
                className="px-4 py-2.5 rounded-xl border border-border bg-muted text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ← Anterior
              </button>

              <div className="text-sm font-semibold text-muted-foreground">
                Página {page + 1} {hasMore ? "de ?" : `(${items.length} carregados)`}
              </div>

              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore || isLoading}
                className="px-4 py-2.5 rounded-xl border border-border bg-muted text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Rankings Section */
        <div className="py-2">
          {isLoadingRankings ? (
            <div className="h-64 flex flex-col items-center justify-center bg-muted/20 border border-border/80 rounded-3xl">
              <DotMatrixLoader text="Carregando estatísticas e rankings..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Column 1: Top Downloads */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <TrendingUp className="w-6 h-6 text-emerald-500" />
                  <h3 className="text-lg font-bold text-foreground">Top Downloads</h3>
                </div>

                <div className="space-y-3">
                  {topDownloads.length === 0 ? (
                    <div className="p-8 text-center text-sm border border-dashed border-border bg-muted/20 rounded-2xl text-muted-foreground">
                      Nenhum dado de download disponível.
                    </div>
                  ) : (
                    (showMoreDownloads ? topDownloads : topDownloads.slice(0, 5)).map((item, idx) => (
                      <RankingRow
                        key={item.id}
                        item={item}
                        rank={idx + 1}
                        statType="downloads"
                        statValue={item.downloadCount || 0}
                        onClick={() => setSelectedItem(item)}
                      />
                    ))
                  )}
                </div>

                {topDownloads.length > 5 && (
                  <button
                    onClick={() => setShowMoreDownloads(!showMoreDownloads)}
                    className="w-full py-2.5 bg-muted/60 hover:bg-muted border border-border hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {showMoreDownloads ? "Ver Menos" : "Ver Mais (Top 10)"}
                  </button>
                )}
              </div>

              {/* Column 2: Top Favorites */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <Trophy className="w-6 h-6 text-amber-500" />
                  <h3 className="text-lg font-bold text-foreground">Top Favoritados</h3>
                </div>

                <div className="space-y-3">
                  {topFavorites.length === 0 ? (
                    <div className="p-8 text-center text-sm border border-dashed border-border bg-muted/20 rounded-2xl text-muted-foreground">
                      Nenhum modelo favoritado ainda.
                    </div>
                  ) : (
                    (showMoreFavorites ? topFavorites : topFavorites.slice(0, 5)).map((item, idx) => (
                      <RankingRow
                        key={item.id}
                        item={item}
                        rank={idx + 1}
                        statType="favorites"
                        statValue={item.favoritesCount || 0}
                        onClick={() => setSelectedItem(item)}
                      />
                    ))
                  )}
                </div>

                {topFavorites.length > 5 && (
                  <button
                    onClick={() => setShowMoreFavorites(!showMoreFavorites)}
                    className="w-full py-2.5 bg-muted/60 hover:bg-muted border border-border hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {showMoreFavorites ? "Ver Menos" : "Ver Mais (Top 10)"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {selectedItem && (
        <StlDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDownload={handleDownload}
          isFavorited={favorites.includes(selectedItem.id)}
          onToggleFavorite={handleToggleFavorite}
          cost={cost}
          isDownloading={downloadingIds.includes(selectedItem.id)}
          onTagClick={(tag) => setSearchQuery(`#${tag}`)}
          onDeleteSuccess={(deletedId) => {
            setItems((prev) => prev.filter((i) => i.id !== deletedId));
            setTopDownloads((prev) => prev.filter((i) => i.id !== deletedId));
            setTopFavorites((prev) => prev.filter((i) => i.id !== deletedId));
            setSelectedItem(null);
          }}
          onPrinterTypeUpdate={(id, newType) => {
            const updateType = (prev: StlItem[]) =>
              prev.map((i) => (i.id === id ? { ...i, printer_type: newType } : i));
            setItems(updateType);
            setTopDownloads(updateType);
            setTopFavorites(updateType);
            if (selectedItem && selectedItem.id === id) {
              setSelectedItem({ ...selectedItem, printer_type: newType });
            }
          }}
          onPhotosUpdate={(id, updatedPhotos, updatedThumbnailUrl) => {
            const updatePhotosList = (prev: StlItem[]) =>
              prev.map((i) =>
                i.id === id
                  ? { ...i, photos: updatedPhotos, imageUrl: updatedThumbnailUrl }
                  : i
              );
            setItems(updatePhotosList);
            setTopDownloads(updatePhotosList);
            setTopFavorites(updatePhotosList);
            setSelectedItem((prev) =>
              prev && prev.id === id
                ? { ...prev, photos: updatedPhotos, imageUrl: updatedThumbnailUrl }
                : prev
            );
          }}
          onUnmergeSuccess={handleUnmergeSuccess}
        />
      )}

      {/* Merge Parts Modal */}
      {isMergeModalOpen && mergeSelection.length >= 2 && (
        <MergePartsModal
          selectedItems={items.filter((i) => mergeSelection.includes(i.id))}
          onClose={() => setIsMergeModalOpen(false)}
          onMergeSuccess={handleMergeSuccess}
        />
      )}
    </div>
  );
}

interface RankingRowProps {
  item: StlItem;
  rank: number;
  statType: "downloads" | "favorites";
  statValue: number;
  onClick: () => void;
}

function RankingRow({ item, rank, statType, statValue, onClick }: RankingRowProps) {
  const rankColors = {
    1: "bg-amber-500/20 border-amber-500/30 text-amber-400",
    2: "bg-slate-400/20 border-slate-400/30 text-slate-300",
    3: "bg-amber-700/20 border-amber-700/30 text-amber-600",
  };
  const badgeClass = rankColors[rank as keyof typeof rankColors] || "bg-muted border-border text-muted-foreground";

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3.5 bg-card border border-border/60 rounded-2xl hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer group shadow-sm"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Rank Number */}
        <div className={`w-8 h-8 shrink-0 rounded-xl border flex items-center justify-center text-sm font-black font-mono ${badgeClass}`}>
          #{rank}
        </div>
        
        {/* Thumbnail */}
        <div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-muted border border-border relative">
          <img src={item.imageUrl} alt={item.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
        </div>

        {/* Title / Filename */}
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors" title={item.title}>
            {item.title}
          </h4>
          <p className="text-[10px] text-muted-foreground truncate" title={item.fileName}>
            {item.fileName}
          </p>
        </div>
      </div>

      {/* Stats Badge */}
      <div className="shrink-0 pl-2">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
          statType === "downloads" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {statType === "downloads" ? (
            <Download className="w-3 h-3" />
          ) : (
            <Heart className="w-3 h-3 fill-current" />
          )}
          {statValue}
        </span>
      </div>
    </div>
  );
}
