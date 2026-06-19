"use client"

import React, { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { useConfiguratorStore } from "@/store/store"
import { getSupabaseBrowser, Profile, CatalogItem, FeatureCost } from "@/lib/supabase"
import { 
  ShieldAlert, 
  Settings, 
  Users, 
  Package, 
  Save, 
  Check, 
  Loader2, 
  Lock, 
  Zap, 
  ArrowRight,
  UserCheck,
  Activity,
  RefreshCw,
  Download,
  AlertTriangle,
  LifeBuoy,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  X,
  ImageIcon,
  Plus,
  Upload
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/lib/translations"
import { TicketsTab } from "@/components/admin/TicketsTab"
import { UserDetailsModal } from "@/components/admin/UserDetailsModal"
// import { GameAdminShortcuts } from "@/components/admin/GameAdminShortcuts"
import { getPerceptualHash, hammingDistance } from "@/lib/imageHash"

export default function AdminPage() {
  const { profile } = useConfiguratorStore()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<"features" | "models" | "users" | "scraper" | "analytics" | "tickets" | "flags" | "acervo">("features")
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null)
  
  // Data State
  const [features, setFeatures] = useState<FeatureCost[]>([])
  const [models, setModels] = useState<CatalogItem[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [selectedUserForModal, setSelectedUserForModal] = useState<Profile | null>(null)
  const [featureFlags, setFeatureFlagsData] = useState<any[]>([])
  const [scraperJobs, setScraperJobs] = useState<any[]>([])
  const [scraperError, setScraperError] = useState<string | null>(null)
  const [actingJobId, setActingJobId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  // Scraper UI States
  const [scraperSubTab, setScraperSubTab] = useState<"moderation" | "queue" | "config">("moderation")
  const [showAllPending, setShowAllPending] = useState(false)
  const [selectedJobDetails, setSelectedJobDetails] = useState<any | null>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [scraperStatusFilter, setScraperStatusFilter] = useState<string>("all")
  const [selectedBans, setSelectedBans] = useState<string[]>([])
  const [dismissedPhotos, setDismissedPhotosState] = useState<string[]>([])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dismissedAdminPhotos");
      if (saved) {
        try {
          setDismissedPhotosState(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, []);

  const setDismissedPhotos = (updater: any) => {
    setDismissedPhotosState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (typeof window !== "undefined") {
        localStorage.setItem("dismissedAdminPhotos", JSON.stringify(next));
      }
      return next;
    });
  };

  // Scraper Settings State
  const [scraperGroupsConfig, setScraperGroupsConfig] = useState<{ id: string; type: string }[]>([])
  const [scraperSizeLimit, setScraperSizeLimit] = useState<number>(750)
  const [scraperHeartbeat, setScraperHeartbeat] = useState<string | null>(null)
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false)

  // Backfill State
  const [backfillHoursBack, setBackfillHoursBack] = useState<number>(24)
  const [isRunningBackfill, setIsRunningBackfill] = useState<boolean>(false)
  const [backfillResult, setBackfillResult] = useState<{ ok: boolean; message: string; cutoff_date?: string } | null>(null)

  // Analytics State
  const [downloadHistory, setDownloadHistory] = useState<any[]>([])
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; count: number; label: string } | null>(null)

  // Acervo (Indexed Models) State
  const [indexedModels, setIndexedModels] = useState<any[]>([])
  const [indexedError, setIndexedError] = useState<string | null>(null)
  const [isFetchingIndexed, setIsFetchingIndexed] = useState(false)
  const [indexedPage, setIndexedPage] = useState(1)
  const [selectedIndexedModel, setSelectedIndexedModel] = useState<any | null>(null)

  const fetchScraperJobs = async () => {
    try {
      setScraperError(null)
      const supabase = getSupabaseBrowser()

      const { data, error } = await supabase
        .from("telegram_scraper_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300)

      if (error) throw error
      
      const jobs = data || [];
      setScraperJobs(jobs)

      // Background process: Auto-filter known banned hashes from UI
      const checkAndFilterBannedPhotos = async (currentJobs: any[]) => {
        try {
          const res = await fetch("/api/telegram/banned-images");
          if (!res.ok) return;
          const { banned_hashes } = await res.json();
          if (!banned_hashes || banned_hashes.length === 0) return;

          const pendingWithPhotos = currentJobs.filter(j => j.status === "pending_approval" && j.photos && j.photos.length > 0);
          if (pendingWithPhotos.length === 0) return;

          let hasModifications = false;
          const updatedJobs = [...currentJobs];
          
          for (const job of pendingWithPhotos) {
            let jobModified = false;
            const validPhotos: string[] = [];

            for (const url of job.photos) {
              try {
                const hash = await getPerceptualHash(url);
                const isBanned = banned_hashes.some((banned: string) => hammingDistance(hash, banned) <= 10);
                if (!isBanned) {
                  validPhotos.push(url);
                } else {
                  jobModified = true;
                  hasModifications = true;
                  console.log(`Auto-banned image removed from UI: ${url}`);
                }
              } catch (e) {
                validPhotos.push(url); // keep if hash fails
              }
            }

            if (jobModified) {
              const jobIndex = updatedJobs.findIndex(j => j.id === job.id);
              if (jobIndex > -1) {
                updatedJobs[jobIndex] = { ...updatedJobs[jobIndex], photos: validPhotos };
                await supabase.from("telegram_scraper_jobs").update({ photos: validPhotos }).eq("id", job.id);
              }
            }
          }

          if (hasModifications) {
            setScraperJobs(updatedJobs);
          }
        } catch (err) {
          console.error("Erro no auto-filtro de imagens:", err);
        }
      };

      // Run asynchronously without blocking
      checkAndFilterBannedPhotos(jobs);

    } catch (err: any) {
      setScraperError(err.message || "Erro desconhecido")
    }
  }

  const fetchIndexedModels = async () => {
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

      const models = data || []
      setIndexedModels(models)

      // Background process: Auto-filter known banned hashes from UI (Acervo)
      const checkAndFilterBannedPhotosAcervo = async (currentModels: any[]) => {
        try {
          const res = await fetch("/api/telegram/banned-images");
          if (!res.ok) return;
          const { banned_hashes } = await res.json();
          if (!banned_hashes || banned_hashes.length === 0) return;

          const modelsWithPhotos = currentModels.filter(m => m.photos && m.photos.length > 0);
          if (modelsWithPhotos.length === 0) return;

          let hasModifications = false;
          const updatedModels = [...currentModels];
          
          for (const model of modelsWithPhotos) {
            let modelModified = false;
            const validPhotos: string[] = [];

            for (const url of model.photos) {
              try {
                const hash = await getPerceptualHash(url);
                const isBanned = banned_hashes.some((banned: string) => hammingDistance(hash, banned) <= 10);
                if (!isBanned) {
                  validPhotos.push(url);
                } else {
                  modelModified = true;
                  hasModifications = true;
                  console.log(`Auto-banned image removed from Acervo: ${url}`);
                }
              } catch (e) {
                validPhotos.push(url); // keep if hash fails
              }
            }

            if (modelModified) {
              const modelIndex = updatedModels.findIndex(m => m.id === model.id);
              if (modelIndex > -1) {
                updatedModels[modelIndex] = { ...updatedModels[modelIndex], photos: validPhotos };
                await supabase.from("telegram_indexed_stls").update({ photos: validPhotos }).eq("id", model.id);
              }
            }
          }

          if (hasModifications) {
            setIndexedModels(updatedModels);
          }
        } catch (err) {
          console.error("Erro no auto-filtro de imagens (Acervo):", err);
        }
      };

      checkAndFilterBannedPhotosAcervo(models);
    } catch (err: any) {
      console.error("[Acervo Debug] Error fetching indexed models:", err)
      setIndexedError(err.message || "Erro desconhecido")
    } finally {
      setIsFetchingIndexed(false)
    }
  }

  const handleRemovePhoto = async (modelId: string, photoIndex: number) => {
    try {
      const model = indexedModels.find(m => m.id === modelId);
      if (!model || !model.photos) return;

      const newPhotos = [...model.photos];
      newPhotos.splice(photoIndex, 1);

      const supabase = getSupabaseBrowser();
      const { error } = await supabase
        .from("telegram_indexed_stls")
        .update({ photos: newPhotos })
        .eq("id", modelId);

      if (error) throw error;

      setIndexedModels(prev => prev.map(m => m.id === modelId ? { ...m, photos: newPhotos } : m));
      
      if (selectedIndexedModel?.id === modelId) {
        setSelectedIndexedModel({ ...selectedIndexedModel, photos: newPhotos });
        if (activePhotoIndex >= newPhotos.length) {
          setActivePhotoIndex(Math.max(0, newPhotos.length - 1));
        }
      }
    } catch (err) {
      console.error("Erro ao remover foto:", err);
      alert("Erro ao remover a foto.");
    }
  }

  const handleMarkAsReviewed = async (modelId: string) => {
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase
        .from("telegram_indexed_stls")
        .update({ has_appended_photos: false })
        .eq("id", modelId);

      if (error) throw error;

      setIndexedModels(prev => prev.filter(m => m.id !== modelId));
      setSelectedIndexedModel(null);
    } catch (err) {
      console.error("Erro ao marcar como revisado:", err);
      alert("Erro ao marcar modelo como revisado.");
    }
  }

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm("Tem certeza que deseja excluir este modelo inteiro do acervo?")) return;
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase
        .from("telegram_indexed_stls")
        .delete()
        .eq("id", modelId);

      if (error) throw error;

      setIndexedModels(prev => prev.filter(m => m.id !== modelId));
      if (selectedIndexedModel?.id === modelId) {
        setSelectedIndexedModel(null);
      }
    } catch (err) {
      console.error("Erro ao excluir modelo:", err);
      alert("Erro ao excluir o modelo.");
    }
  }

  const fetchScraperSettings = async () => {
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from("telegram_scraper_settings")
        .select("*")
        .eq("id", "default")
        .single()
      
      if (!error && data) {
        setScraperGroupsConfig(data.groups_config || [])
        setScraperSizeLimit(data.size_limit_mb)
        setScraperHeartbeat(data.last_heartbeat || null)
      }
    } catch (err) {
      console.error("Erro ao carregar configurações do scraper:", err)
    }
  }

  const handleSaveScraperSettings = async () => {
    try {
      setIsSavingSettings(true)
      const supabase = getSupabaseBrowser()

      const { error } = await supabase
        .from("telegram_scraper_settings")
        .update({
          groups_config: scraperGroupsConfig,
          size_limit_mb: scraperSizeLimit,
          updated_at: new Date().toISOString()
        })
        .eq("id", "default")

      if (error) throw error
      alert("Configurações do scraper salvas com sucesso!")
    } catch (err: any) {
      console.error("Erro ao salvar configurações do scraper:", err)
      alert(`Erro ao salvar configurações: ${err.message || err}`)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleRunBackfill = async () => {
    setIsRunningBackfill(true)
    setBackfillResult(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("Sessão não encontrada.")

      const res = await fetch("/api/telegram/backfill", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hours_back: backfillHoursBack }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setBackfillResult({ ok: true, message: data.message, cutoff_date: data.cutoff_date })
    } catch (err: any) {
      setBackfillResult({ ok: false, message: err.message || "Erro desconhecido ao disparar varredura." })
    } finally {
      setIsRunningBackfill(false)
    }
  }

  const handleJobAction = async (jobId: string, action: "approve" | "reject" | "cancel" | "retry") => {
    setActingJobId(jobId)
    try {
      const supabase = getSupabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Sessão não encontrada.")
      }

      const res = await fetch("/api/telegram/jobs", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action, jobId })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Erro do servidor (${res.status})`)
      }

      await fetchScraperJobs()
    } catch (err: any) {
      alert(`Falha ao realizar ação: ${err.message}`)
    } finally {
      setActingJobId(null)
    }
  }

  const [isUploadingJobPhoto, setIsUploadingJobPhoto] = useState(false);

  const handleRemoveJobPhoto = async (jobId: string, photoIndex: number) => {
    try {
      const job = scraperJobs.find(j => j.id === jobId);
      if (!job || !job.photos) return;

      const newPhotos = [...job.photos];
      newPhotos.splice(photoIndex, 1);

      const supabase = getSupabaseBrowser();
      const { error } = await supabase
        .from("telegram_scraper_jobs")
        .update({ photos: newPhotos })
        .eq("id", jobId);

      if (error) throw error;

      setScraperJobs(prev => prev.map(j => j.id === jobId ? { ...j, photos: newPhotos } : j));
      
      if (selectedJobDetails?.id === jobId) {
        setSelectedJobDetails({ ...selectedJobDetails, photos: newPhotos });
        if (activePhotoIndex >= newPhotos.length) {
          setActivePhotoIndex(Math.max(0, newPhotos.length - 1));
        }
      }
    } catch (err) {
      console.error("Erro ao remover foto do job:", err);
      alert("Erro ao remover a foto.");
    }
  }

  const handleAddJobPhotoUrl = async (jobId: string) => {
    const url = prompt("Digite a URL da imagem:");
    if (!url?.trim()) return;
    try {
      const job = scraperJobs.find(j => j.id === jobId);
      if (!job) return;

      const currentPhotos = job.photos || [];
      const updatedPhotos = [...currentPhotos, url.trim()];

      const supabase = getSupabaseBrowser();
      const { error } = await supabase
        .from("telegram_scraper_jobs")
        .update({ photos: updatedPhotos })
        .eq("id", jobId);

      if (error) throw error;

      setScraperJobs(prev => prev.map(j => j.id === jobId ? { ...j, photos: updatedPhotos } : j));
      
      if (selectedJobDetails?.id === jobId) {
        setSelectedJobDetails({ ...selectedJobDetails, photos: updatedPhotos });
        setActivePhotoIndex(updatedPhotos.length - 1);
      }
    } catch (err: any) {
      alert(err.message || "Falha ao adicionar URL da imagem.");
    }
  };

  const handleUploadJobPhotoFile = async (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingJobPhoto(true);
      const supabase = getSupabaseBrowser();
      const fileExt = file.name.split(".").pop();
      const filePath = `telegram/manual_job/${jobId}/${Date.now()}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage.from("portfolio").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(filePath);
      
      const job = scraperJobs.find(j => j.id === jobId);
      if (!job) return;

      const currentPhotos = job.photos || [];
      const updatedPhotos = [...currentPhotos, publicUrl];

      const { error: dbErr } = await supabase
        .from("telegram_scraper_jobs")
        .update({ photos: updatedPhotos })
        .eq("id", jobId);

      if (dbErr) throw dbErr;

      setScraperJobs(prev => prev.map(j => j.id === jobId ? { ...j, photos: updatedPhotos } : j));
      
      if (selectedJobDetails?.id === jobId) {
        setSelectedJobDetails({ ...selectedJobDetails, photos: updatedPhotos });
        setActivePhotoIndex(updatedPhotos.length - 1);
      }
    } catch (err: any) {
      alert(err.message || "Falha ao fazer upload da imagem.");
    } finally {
      setIsUploadingJobPhoto(false);
    }
  };

  const [isBanningPhoto, setIsBanningPhoto] = useState(false);

  const toggleBanSelection = (jobId: string, url: string) => {
    const key = `${jobId}|${url}`;
    setSelectedBans(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleBanMultiplePhotos = async () => {
    if (selectedBans.length === 0) return;
    if (!confirm(`Tem certeza que deseja banir ${selectedBans.length} imagem(ns)? Elas serão adicionadas à blacklist e removidas dos itens.`)) return;

    try {
      setIsBanningPhoto(true);
      const supabase = getSupabaseBrowser();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const payload = await Promise.all(selectedBans.map(async (key) => {
        const lastPipeIndex = key.lastIndexOf("|");
        const jobId = key.substring(0, lastPipeIndex);
        const url = key.substring(lastPipeIndex + 1);
        const hash = await getPerceptualHash(url);
        return { jobId, url, hash };
      }));

      // 1. Registrar na API (com verificação de sucesso)
      for (const item of payload) {
        const res = await fetch("/api/telegram/banned-images", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ image_hash: item.hash, image_url: item.url })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(`Erro ao banir imagem: ${errData.error || res.statusText}`);
        }
      }

      // 2. Atualizar jobs localmente e no DB
      const urlsByJob: Record<string, string[]> = {};
      payload.forEach(item => {
        if (!urlsByJob[item.jobId]) urlsByJob[item.jobId] = [];
        urlsByJob[item.jobId].push(item.url);
      });

      const updatedJobs = [...scraperJobs];

      for (const jobId of Object.keys(urlsByJob)) {
        const urlsToRemove = urlsByJob[jobId];
        const jobIndex = updatedJobs.findIndex(j => j.id === jobId);
        if (jobIndex > -1) {
          const job = updatedJobs[jobIndex];
          const newPhotos = job.photos.filter((p: string) => !urlsToRemove.includes(p));

          updatedJobs[jobIndex] = { ...job, photos: newPhotos };

          const { error } = await supabase
            .from("telegram_scraper_jobs")
            .update({ photos: newPhotos })
            .eq("id", jobId);

          if (error) throw error;
        }
      }

      setScraperJobs(updatedJobs);
      setSelectedBans([]);
      alert("Fotos banidas com sucesso!");

    } catch (err: any) {
      alert("Erro ao banir fotos: " + err.message);
    } finally {
      setIsBanningPhoto(false);
    }
  };

  const getScraperStatus = () => {
    if (!scraperHeartbeat) return "unknown"
    const heartbeatTime = new Date(scraperHeartbeat).getTime()
    const nowTime = new Date().getTime()
    const diffSeconds = (nowTime - heartbeatTime) / 1000
    
    if (diffSeconds < 120) {
      return "healthy"
    } else if (diffSeconds < 300) {
      return "warning"
    } else {
      return "offline"
    }
  }

  const fetchAnalyticsData = async () => {
    setIsLoadingAnalytics(true)
    setAnalyticsError(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from('telegram_downloads_history')
        .select(`
          id,
          downloaded_at,
          profiles (
            email
          ),
          telegram_indexed_stls (
            file_name,
            telegram_group_name,
            title
          )
        `)
        .order('downloaded_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const mappedHistory = (data || []).map((h: any) => ({
        id: h.id,
        downloaded_at: h.downloaded_at,
        user_email: h.profiles?.email || "desconhecido@lb.com",
        file_name: h.telegram_indexed_stls?.file_name || "Arquivo excluído",
        chat_title: h.telegram_indexed_stls?.telegram_group_name || "Canal desconhecido",
        title: h.telegram_indexed_stls?.title || "Modelo Sem Título"
      }))
      setDownloadHistory(mappedHistory)
    } catch (err: any) {
      console.error("Erro ao carregar histórico de downloads:", {
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code,
        error: err
      })
      setAnalyticsError(err.message || err.details || JSON.stringify(err) || "Erro ao consultar banco de dados")
    } finally {
      setIsLoadingAnalytics(false)
    }
  }

  // Fetch all admin data
  const fetchData = async () => {
    setLoading(true)
    setErrorMsg("")
    try {
      const supabase = getSupabaseBrowser()
      
      // 1. Fetch feature costs
      const { data: fcData, error: fcError } = await supabase
        .from("feature_costs")
        .select("*")
        .order("feature_key")
      
      if (fcError) throw fcError
      setFeatures(fcData as FeatureCost[])

      // 2. Fetch catalog items
      const { data: catData, error: catError } = await supabase
        .from("catalog_items")
        .select("*")
        .order("title")
      
      if (catError) throw catError
      setModels(catData as CatalogItem[])

      // 3. Fetch users profiles (limit 50 for testing)
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("email")
        .limit(50)
      
      if (profilesError) throw profilesError
      setUsers(profilesData as Profile[])

      // 4. Fetch scraper jobs (wrapped in try-catch so it won't crash if table doesn't exist yet)
      await fetchScraperJobs()

      // 5. Fetch scraper settings
      await fetchScraperSettings()

      // 6. Fetch analytics data
      await fetchAnalyticsData()

      // 7. Fetch feature flags
      const { data: ffData, error: ffError } = await supabase
        .from("feature_flags")
        .select("*")
        .order("display_name")
      
      if (ffError) throw ffError
      setFeatureFlagsData(ffData || [])

    } catch (err: any) {
      console.error("[Admin fetch error]:", err)
      setErrorMsg(err.message || "Falha ao carregar dados do painel.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile && profile.role === "sysadmin") {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [profile?.id, profile?.role])

  useEffect(() => {
    if (activeTab === "scraper") {
      fetchScraperJobs()
      fetchScraperSettings()
      
      const interval = setInterval(() => {
        fetchScraperJobs()
        fetchScraperSettings()
      }, 30000)
      
      return () => clearInterval(interval)
    } else if (activeTab === "analytics") {
      fetchAnalyticsData()
    } else if (activeTab === "acervo") {
      fetchIndexedModels()
    }
  }, [activeTab])

  // Poll progress for downloading jobs
  useEffect(() => {
    if (activeTab !== "scraper") return;

    const interval = setInterval(async () => {
      const downloadingJobs = scraperJobs.filter(j => j.status === "downloading_file");
      if (downloadingJobs.length === 0) return;

      let updated = false;
      const newJobs = [...scraperJobs];

      for (const job of downloadingJobs) {
        try {
          const res = await fetch(`/api/telegram/progress?job_id=${job.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.progress !== undefined && data.progress !== job.progress) {
              const jobIndex = newJobs.findIndex(j => j.id === job.id);
              if (jobIndex > -1) {
                newJobs[jobIndex] = { ...newJobs[jobIndex], progress: data.progress };
                updated = true;
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }

      if (updated) {
        setScraperJobs(newJobs);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTab, scraperJobs]);

  // Process downloads over time (last 7 days)
  const downloadsOverTimeData = useMemo(() => {
    const days: Array<{ label: string; key: string; count: number }> = []
    
    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      const keyStr = d.toISOString().split('T')[0]
      days.push({ label: dateStr, key: keyStr, count: 0 })
    }

    // Accumulate counts
    downloadHistory.forEach(h => {
      if (!h || !h.downloaded_at) return
      const dateKey = h.downloaded_at.split('T')[0]
      const dayObj = days.find(d => d.key === dateKey)
      if (dayObj) {
        dayObj.count++
      }
    })

    return days
  }, [downloadHistory])

  // Process top downloads by channel
  const downloadsByChannelData = useMemo(() => {
    const counts: Record<string, number> = {}
    downloadHistory.forEach(h => {
      if (!h) return
      const channel = h.chat_title || "Outros"
      counts[channel] = (counts[channel] || 0) + 1
    })

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [downloadHistory])

  // Restrict access
  if (!profile || profile.role !== "sysadmin") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 ring-4 ring-red-500/5">
          <Lock size={32} />
        </div>
        <h1 className="text-2xl font-black text-foreground tracking-tight">Acesso Restrito</h1>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          Esta área é exclusiva para administradores (sysadmin) do LB Creative Studio. Faça login com um perfil sysadmin.
        </p>
      </div>
    )
  }

  // Handle saving generic feature costs
  const handleSaveFeature = async (featureKey: string, costFree: number, costPro: number, costMax: number) => {
    setSavingId(featureKey)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("feature_costs")
        .update({
          cost_free: costFree,
          cost_pro: costPro,
          cost_max: costMax,
          updated_at: new Date().toISOString()
        })
        .eq("feature_key", featureKey)

      if (error) throw error
      
      setSaveSuccessId(featureKey)
      setTimeout(() => setSaveSuccessId(null), 2000)
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message)
    } finally {
      setSavingId(null)
    }
  }

  // Handle saving catalog item costs
  const handleSaveModelPrice = async (itemId: string, priceFree: number, pricePro: number, priceMax: number) => {
    setSavingId(itemId)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("catalog_items")
        .update({
          price_free: priceFree,
          price_pro: pricePro,
          price_max: priceMax,
          updated_at: new Date().toISOString()
        })
        .eq("id", itemId)

      if (error) throw error
      
      setSaveSuccessId(itemId)
      setTimeout(() => setSaveSuccessId(null), 2000)
    } catch (err: any) {
      console.error("Error saving model price:", err)
      alert("Erro ao salvar preços: " + err.message)
    } finally {
      setSavingId(null)
    }
  }

  // Handle saving profile modifications (plan & credits)
  const handleSaveUser = async (userId: string, plan: "free" | "pro" | "max", credits: number) => {
    setSavingId(userId)
    try {
      const supabase = getSupabaseBrowser()
      
      // Get previous credits to calculate difference
      const user = users.find(u => u.id === userId)
      const diff = user ? credits - user.credits : 0

      const { error } = await supabase
        .from("profiles")
        .update({
          plan,
          credits,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId)

      if (error) throw error

      if (diff !== 0) {
        await supabase.from("transactions").insert({
          user_id: userId,
          credits_added: diff,
          description: diff > 0 ? `Créditos adicionados manualmente pelo sysadmin` : `Créditos removidos manualmente pelo sysadmin`
        })
      }
      
      // Refresh local user state list
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan, credits } : u))
      
      setSaveSuccessId(userId)
      setTimeout(() => setSaveSuccessId(null), 2000)
    } catch (err: any) {
      alert("Erro ao atualizar usuário: " + err.message)
    } finally {
      setSavingId(null)
    }
  }

  // Handle toggling feature flag states
  const handleToggleFlag = async (key: string, currentVal: boolean) => {
    try {
      const supabase = getSupabaseBrowser()
      const newVal = !currentVal
      
      const { error } = await supabase
        .from("feature_flags")
        .update({
          is_enabled: newVal,
          updated_at: new Date().toISOString()
        })
        .eq("key", key)
      
      if (error) throw error
      
      // Update local state
      setFeatureFlagsData(prev => prev.map(f => f.key === key ? { ...f, is_enabled: newVal } : f))
      
      // Update store state immediately
      const currentFlags = useConfiguratorStore.getState().featureFlags
      useConfiguratorStore.getState().setFeatureFlags({
        ...currentFlags,
        [key]: newVal
      })
    } catch (err: any) {
      alert("Erro ao alterar feature flag: " + err.message)
    }
  }

  const scraperStatus = getScraperStatus()
  const scraperStatusConfig = {
    healthy:  { label: "Scraper Online",       color: "text-success",     bg: "bg-success/10",     border: "border-success/20",     dot: "bg-success badge-pulse-success" },
    warning:  { label: "Scraper Lento",        color: "text-warning",     bg: "bg-warning/10",     border: "border-warning/20",     dot: "bg-warning badge-pulse-warning" },
    offline:  { label: "Scraper Offline",      color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", dot: "bg-destructive badge-pulse-destructive" },
    unknown:  { label: "Status Desconhecido",  color: "text-muted-foreground", bg: "bg-muted",    border: "border-border",         dot: "bg-muted-foreground/40" },
  }[scraperStatus]

  const lastHeartbeatFormatted = scraperHeartbeat
    ? new Date(scraperHeartbeat).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—"

  const scraperTabAlert = scraperStatus !== "healthy" && scraperStatus !== "unknown"
  const adminTabs: { key: typeof activeTab; icon: any; label: string; alert?: boolean }[] = [
    { key: "features",  icon: Settings,     label: t('admin.tabFeatures', "Custos por Feature") },
    { key: "models",    icon: Package,      label: t('admin.tabModels', "Preço dos Modelos") },
    { key: "users",     icon: Users,        label: `${t('admin.tabUsers', "Usuários")} (${users.length})` },
    { key: "scraper",   icon: Activity,     label: t('admin.tabScraper', "Scraper"), alert: scraperTabAlert },
    { key: "acervo",    icon: Package,      label: "Revisão de Fotos" },
    { key: "analytics", icon: Activity,     label: t('admin.tabAnalytics', "Uso da Plataforma") },
    { key: "tickets",   icon: LifeBuoy,     label: t('admin.tabTickets', "Chamados") },
    { key: "flags",     icon: ToggleRight,  label: t('admin.tabFlags', "Feature Flags") },
  ]

  return (
    <div className="space-y-6 pb-16 fade-in">

      {/* Header Banner with Scraper Health */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0A0E20] via-[#0E1230] to-[#0A0E20] rounded-3xl p-7 border border-primary/15 shadow-overlay">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
              <ShieldAlert size={12} />
              Painel Administrativo
            </div>
            <h1 className="text-display text-2xl text-white">{t('admin.title', "Admin")}</h1>
            <p className="text-white/50 max-w-lg text-sm leading-relaxed">
              {t('admin.subtitle', "Controle de custos, usuários, scraper e features em tempo real.")}
            </p>
          </div>

          {/* Scraper Status Card */}
          <button
            onClick={() => setActiveTab("scraper")}
            className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all hover:scale-[1.02] cursor-pointer text-left shrink-0 ${scraperStatusConfig.bg} ${scraperStatusConfig.border}`}
          >
            <div className="relative flex h-3 w-3 shrink-0">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${scraperStatusConfig.dot}`} />
              <span className={`relative inline-flex rounded-full h-3 w-3 ${scraperStatusConfig.dot.split(" ")[0]}`} />
            </div>
            <div>
              <p className={`text-sm font-bold ${scraperStatusConfig.color}`}>{scraperStatusConfig.label}</p>
              <p className="text-xs text-white/35 mt-0.5">
                Heartbeat: {lastHeartbeatFormatted}
              </p>
            </div>
            <RefreshCw
              size={14}
              className={`ml-2 text-white/30 ${scraperStatus === "healthy" ? "text-success/60" : ""}`}
              onClick={(e) => { e.stopPropagation(); fetchScraperSettings() }}
            />
          </button>
        </div>
      </div>

      {/* Games Admin Shortcuts */}
      {/* <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gestão de Games</p>
        <GameAdminShortcuts />
      </div> */}

      {/* 1-Column Layout for Admin with Horizontal Menu */}
      <div className="flex flex-col gap-6">
        {/* Admin Horizontal Menu */}
        <div className="w-full bg-card border border-border rounded-2xl p-1.5 shadow-card">
          <div className="flex flex-wrap gap-1">
            {adminTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer
                    ${isActive
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                >
                  <Icon size={15} className={isActive ? "text-primary" : "text-muted-foreground"} />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {tab.alert && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-card" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="w-full">
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center border border-border bg-card/20 rounded-2xl">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
          <span className="text-sm text-muted-foreground">Carregando dados administrativos...</span>
        </div>
      ) : errorMsg ? (
        <div className="p-6 border border-red-500/20 bg-red-500/5 rounded-2xl text-center">
          <p className="text-red-400 font-medium">{errorMsg}</p>
          <button 
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-500/10 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB 1: FEATURES COSTS */}
          {activeTab === "features" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {features.map((feature) => (
                <FeatureCostCard 
                  key={feature.feature_key} 
                  feature={feature} 
                  onSave={handleSaveFeature}
                  isSaving={savingId === feature.feature_key}
                  isSuccess={saveSuccessId === feature.feature_key}
                />
              ))}
            </motion.div>
          )}

          {/* TAB 2: MODEL PRICES */}
          {activeTab === "models" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {models.map((model) => (
                <ModelPriceCard 
                  key={model.id} 
                  model={model} 
                  onSave={handleSaveModelPrice}
                  isSaving={savingId === model.id}
                  isSuccess={saveSuccessId === model.id}
                />
              ))}
            </motion.div>
          )}

          {/* TAB 3: USER SIMULATOR */}
          {activeTab === "users" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
            >
              <div className="p-6 border-b border-border bg-muted/20">
                <h3 className="font-bold text-base">Gerenciador de Planos de Usuários</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Mude o plano de qualquer usuário ou injete créditos para testar as regras de cobrança dinâmica criadas.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/10 text-muted-foreground font-semibold">
                      <th className="px-6 py-4">Email do Usuário</th>
                      <th className="px-6 py-4">Plano Atual</th>
                      <th className="px-6 py-4">Créditos</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {users.map((u) => (
                      <UserRow 
                        key={u.id} 
                        user={u} 
                        onSave={handleSaveUser}
                        onOpenModal={setSelectedUserForModal}
                        isSaving={savingId === u.id}
                        isSuccess={saveSuccessId === u.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <UserDetailsModal 
                user={selectedUserForModal} 
                onClose={() => setSelectedUserForModal(null)} 
              />
            </motion.div>
          )}

          {/* TAB 4: SCRAPER STATUS */}
          {activeTab === "scraper" && (
            <div className="space-y-5 animate-in fade-in duration-300">

              {/* Scraper Sub-Tabs */}
              <div className="bg-card border border-border rounded-xl p-1 flex gap-1">
                {([
                  { key: "moderation" as const, label: "Aprovações e Moderação" },
                  { key: "queue" as const, label: "Fila e Histórico" },
                  { key: "config" as const, label: "Configurações" },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setScraperSubTab(tab.key)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      scraperSubTab === tab.key
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* SUB-TAB: MODERAÇÃO */}
              <div className={scraperSubTab !== "moderation" ? "hidden" : "space-y-6"}>

              {/* SECTION 1: PENDING APPROVALS */}
              {(() => {
                const pendingJobs = scraperJobs.filter(j => j.status === "pending_approval");
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold text-foreground">Fila de Aprovação (Arquivos &gt; {scraperSizeLimit} MB)</h3>
                        <p className="text-xs text-muted-foreground">
                          Estes arquivos excederam o limite automático de {scraperSizeLimit} MB e requerem aprovação manual para iniciar o download.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold font-mono">
                        {pendingJobs.length} pendentes
                      </span>
                    </div>

                    {pendingJobs.length === 0 ? (
                      <div className="p-8 text-center text-sm border border-dashed border-border bg-card/20 rounded-2xl text-muted-foreground">
                        Nenhum arquivo aguardando aprovação no momento.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {(showAllPending ? pendingJobs : pendingJobs.slice(0, 3)).map((job) => {
                            const formattedSize = job.file_size_bytes 
                              ? `${(job.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                              : "---";
                            
                            const hasPhotos = job.photos && job.photos.length > 0;
                            const dbThumb = job.thumbnail_url?.includes("unsplash") ? "" : job.thumbnail_url;
                            const thumbUrl = hasPhotos 
                              ? job.photos[0] 
                              : dbThumb;

                            return (
                              <div key={job.id} className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:border-amber-500/30 transition-all flex flex-col justify-between shadow-md">
                                <div className="relative aspect-video w-full bg-muted overflow-hidden">
                                  {thumbUrl ? (
                                    <img 
                                      src={thumbUrl} 
                                      alt={job.file_name} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
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
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedJobDetails(job);
                                      setActivePhotoIndex(0);
                                    }}
                                    className="absolute inset-0 z-10 w-full h-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-bold backdrop-blur-sm cursor-pointer"
                                  >
                                    Ver Detalhes {hasPhotos && `(${job.photos.length} foto${job.photos.length > 1 ? 's' : ''})`}
                                  </button>
                                </div>
                                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                                  <div className="space-y-2">
                                    <h4 className="font-bold text-sm text-foreground line-clamp-2" title={job.file_name}>
                                      {job.file_name}
                                    </h4>
                                    <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                                      <div>Origem: <span className="font-medium text-foreground">{job.chat_title}</span></div>
                                      <div>Postado em: <span>{new Date(job.created_at).toLocaleString("pt-BR")}</span></div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button
                                      onClick={() => handleJobAction(job.id, "approve")}
                                      disabled={actingJobId !== null}
                                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                    >
                                      {actingJobId === job.id ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <Check size={12} />
                                      )}
                                      Aprovar
                                    </button>
                                    <button
                                      onClick={() => handleJobAction(job.id, "reject")}
                                      disabled={actingJobId !== null}
                                      className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                    >
                                      Rejeitar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {!showAllPending && pendingJobs.length > 3 && (
                          <div className="flex justify-center pt-2">
                            <button
                              onClick={() => setShowAllPending(true)}
                              className="px-4 py-2 bg-muted text-foreground text-xs font-bold rounded-xl hover:bg-muted/80 transition-colors cursor-pointer"
                            >
                              Ver Mais ({pendingJobs.length - 3} restantes)
                            </button>
                          </div>
                        )}
                        {showAllPending && pendingJobs.length > 3 && (
                          <div className="flex justify-center pt-2">
                            <button
                              onClick={() => setShowAllPending(false)}
                              className="px-4 py-2 bg-muted text-foreground text-xs font-bold rounded-xl hover:bg-muted/80 transition-colors cursor-pointer"
                            >
                              Mostrar Menos
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SECTION 1.5: MODERAÇÃO DE FOTOS (Global Grid) */}
              {(() => {
                // Flatten all photos from recent jobs (not just pending_approval)
                let allPhotos: { jobId: string; url: string; index: number; jobTitle: string }[] = [];
                const seen = new Set<string>();

                scraperJobs.forEach(job => {
                  if (job.photos && job.photos.length > 0) {
                    job.photos.forEach((url: string, index: number) => {
                      const key = `${job.id}|${url}`;
                      if (!seen.has(key)) {
                        seen.add(key);
                        allPhotos.push({ jobId: job.id, url, index, jobTitle: job.file_name });
                      }
                    });
                  }
                });

                allPhotos = allPhotos.filter(p => !dismissedPhotos.includes(`${p.jobId}|${p.url}`));

                if (allPhotos.length === 0) return null;

                return (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm p-6 space-y-4 mt-6">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-base text-foreground">Moderação Rápida de Propagandas</h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold font-mono">
                        {allPhotos.length} fotos aguardando revisão
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecione uma ou mais fotos indesejadas e clique no botão para banir. Elas serão removidas da fila e adicionadas à Blacklist.
                    </p>

                    <div className="flex justify-between items-center pb-2">
                      <button
                        onClick={() => {
                          if (selectedBans.length === allPhotos.length) {
                            setSelectedBans([]);
                          } else {
                            setSelectedBans(allPhotos.map(p => `${p.jobId}|${p.url}`));
                          }
                        }}
                        className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-[11px] font-bold rounded-lg transition-colors cursor-pointer border border-border"
                      >
                        {selectedBans.length === allPhotos.length ? "Desmarcar Todos" : "Selecionar Todos"}
                      </button>

                      {selectedBans.length > 0 && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setDismissedPhotos((prev: string[]) => [...prev, ...selectedBans]);
                              setSelectedBans([]);
                            }}
                            className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer animate-in slide-in-from-bottom-2"
                          >
                            Ignorar / Ocultar ({selectedBans.length})
                          </button>
                          <button
                            onClick={handleBanMultiplePhotos}
                            disabled={isBanningPhoto}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 animate-in slide-in-from-bottom-2"
                          >
                            {isBanningPhoto ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                            Banir {selectedBans.length} selecionada(s)
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {allPhotos.map((photoObj, idx) => {
                        const isSelected = selectedBans.includes(`${photoObj.jobId}|${photoObj.url}`);
                        return (
                          <div 
                            key={`${photoObj.jobId}-${idx}`} 
                            onClick={() => toggleBanSelection(photoObj.jobId, photoObj.url)}
                            className={`group relative aspect-square rounded-xl overflow-hidden bg-muted border-2 cursor-pointer transition-all duration-200 ${isSelected ? 'border-red-500 scale-95 shadow-inner' : 'border-border shadow-sm hover:border-red-500/50'}`}
                          >
                            <img 
                              src={photoObj.url} 
                              alt={photoObj.jobTitle} 
                              className={`w-full h-full object-cover transition-all ${isSelected ? 'opacity-80' : ''}`} 
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-red-500/10');
                                const span = document.createElement('span');
                                span.className = 'text-xs text-red-400 font-bold p-2 text-center';
                                span.innerText = 'Foto Expirada';
                                e.currentTarget.parentElement?.appendChild(span);
                              }}
                            />
                            
                            {/* Selection Checkbox/Overlay */}
                            <div className="absolute top-2 right-2 z-10">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-red-500 border-red-500 text-white' : 'bg-black/50 border-white/50 text-transparent opacity-0 group-hover:opacity-100'}`}>
                                <Check size={14} className={isSelected ? 'block' : 'hidden group-hover:block opacity-50'} />
                              </div>
                            </div>

                            {!isSelected && (
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 pointer-events-none">
                                <span className="w-full py-1.5 bg-black/80 text-white text-[10px] font-bold rounded flex items-center justify-center gap-1">
                                  Selecionar
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              </div>{/* end moderation sub-tab */}

              {/* SUB-TAB: CONFIGURAÇÕES */}
              <div className={scraperSubTab !== "config" ? "hidden" : "space-y-6"}>

              {/* SECTION: CONFIGURAÇÃO DO MONITORAMENTO */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Settings className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-base text-foreground">Configurações do Monitoramento (Grupos e Limites)</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Limite de Tamanho */}
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">
                      Limite de Aprovação Automática (MB)
                    </label>
                    <input
                      type="number"
                      value={scraperSizeLimit}
                      onChange={(e) => setScraperSizeLimit(Number(e.target.value))}
                      className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Ex: 750"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Arquivos maiores que este valor precisarão de aprovação manual.
                    </p>
                  </div>

                  {/* Canais/Grupos Monitorados */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase flex items-center justify-between">
                      <span>Canais e Grupos Monitorados</span>
                      <button 
                        onClick={() => setScraperGroupsConfig([...scraperGroupsConfig, { id: "", type: "fdm" }])}
                        className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] rounded"
                      >
                        + Adicionar
                      </button>
                    </label>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                      {scraperGroupsConfig.length === 0 && (
                        <p className="text-[10px] text-muted-foreground italic py-2">Nenhum grupo configurado.</p>
                      )}
                      {scraperGroupsConfig.map((group, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={group.id}
                            onChange={(e) => {
                              const newGroups = [...scraperGroupsConfig];
                              newGroups[index].id = e.target.value;
                              setScraperGroupsConfig(newGroups);
                            }}
                            className="flex-1 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary font-mono"
                            placeholder="Ex: LB Creative STls ou -100..."
                          />
                          <select
                            value={group.type}
                            onChange={(e) => {
                              const newGroups = [...scraperGroupsConfig];
                              newGroups[index].type = e.target.value;
                              setScraperGroupsConfig(newGroups);
                            }}
                            className="w-24 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="fdm">FDM</option>
                            <option value="resin">Resina</option>
                            <option value="all">Ambos</option>
                          </select>
                          <button
                            onClick={() => {
                              const newGroups = [...scraperGroupsConfig];
                              newGroups.splice(index, 1);
                              setScraperGroupsConfig(newGroups);
                            }}
                            className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors shrink-0"
                            title="Remover"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Aceita títulos exatos, usernames públicos ou IDs numéricos do Telegram (com ou sem o prefixo -100).
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveScraperSettings}
                    disabled={isSavingSettings}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isSavingSettings ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Salvar Configurações
                  </button>
                </div>
              </div>

              </div>{/* end config sub-tab */}

              {/* SUB-TAB: FILA E HISTÓRICO */}
              <div className={scraperSubTab !== "queue" ? "hidden" : "space-y-4"}>

              {/* SECTION 2: SCRAPER QUEUE & HISTORY */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-bold text-base">Fila e Histórico do Scraper</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Status de todos os downloads e indexações passadas ou em andamento.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Farol de Status do Scraper */}
                    {(() => {
                      const status = getScraperStatus();
                      const timeText = scraperHeartbeat 
                        ? (() => {
                            const diff = Math.max(0, Math.floor((Date.now() - new Date(scraperHeartbeat).getTime()) / 1000));
                            if (diff < 60) return `há ${diff}s`;
                            return `há ${Math.floor(diff / 60)}m`;
                          })()
                        : "";

                      if (status === "healthy") {
                        return (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                            <span>Servidor Ativo ({timeText})</span>
                          </div>
                        );
                      }
                      if (status === "warning") {
                        return (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                            <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
                            <span>Instável ({timeText})</span>
                          </div>
                        );
                      }
                      if (status === "offline") {
                        return (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                            <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                            <span>Fora do Ar ou Travado ({timeText})</span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-500/10 border border-zinc-500/30 text-zinc-400 text-xs font-bold">
                          <span className="h-2 w-2 rounded-full bg-zinc-500" />
                          <span>Status Desconhecido</span>
                        </div>
                      );
                    })()}

                    <button
                      onClick={() => {
                        fetchScraperJobs();
                        fetchScraperSettings();
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/25 transition-all cursor-pointer"
                    >
                      <RefreshCw size={14} />
                      Atualizar Status
                    </button>
                  </div>
                </div>

                {/* Filter Bar */}
                {(() => {
                  const validJobs = scraperJobs.filter(j => j.status !== "pending_approval");
                  const counts = {
                    all: validJobs.length,
                    pending: validJobs.filter(j => j.status === "pending").length,
                    downloading_file: validJobs.filter(j => j.status === "downloading_file").length,
                    uploading_vault: validJobs.filter(j => j.status === "uploading_vault").length,
                    indexing: validJobs.filter(j => j.status === "indexing").length,
                    completed: validJobs.filter(j => j.status === "completed").length,
                    failed: validJobs.filter(j => j.status === "failed").length,
                  };

                  const filterOptions = [
                    { id: "all", label: "Todos", count: counts.all, selectedClasses: "bg-zinc-500/20 border-zinc-500/50 text-zinc-300 ring-1 ring-zinc-500/50", hoverClasses: "hover:bg-zinc-500/10 hover:border-zinc-500/30 hover:text-zinc-300", badgeSelected: "bg-zinc-500/40 text-zinc-200", badgeUnselected: "bg-muted text-muted-foreground" },
                    { id: "pending", label: "⏳ Na Fila", count: counts.pending, selectedClasses: "bg-indigo-500/20 border-indigo-500/50 text-indigo-400 ring-1 ring-indigo-500/50", hoverClasses: "hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-400", badgeSelected: "bg-indigo-500/40 text-indigo-200", badgeUnselected: "bg-muted text-muted-foreground" },
                    { id: "downloading_file", label: "⬇️ Baixando", count: counts.downloading_file, selectedClasses: "bg-blue-500/20 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/50", hoverClasses: "hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400", badgeSelected: "bg-blue-500/40 text-blue-200", badgeUnselected: "bg-muted text-muted-foreground" },
                    { id: "uploading_vault", label: "☁️ Salvando", count: counts.uploading_vault, selectedClasses: "bg-purple-500/20 border-purple-500/50 text-purple-400 ring-1 ring-purple-500/50", hoverClasses: "hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-400", badgeSelected: "bg-purple-500/40 text-purple-200", badgeUnselected: "bg-muted text-muted-foreground" },
                    { id: "indexing", label: "🔍 Indexando", count: counts.indexing, selectedClasses: "bg-amber-500/20 border-amber-500/50 text-amber-400 ring-1 ring-amber-500/50", hoverClasses: "hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400", badgeSelected: "bg-amber-500/40 text-amber-200", badgeUnselected: "bg-muted text-muted-foreground" },
                    { id: "completed", label: "✅ Concluído", count: counts.completed, selectedClasses: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 ring-1 ring-emerald-500/50", hoverClasses: "hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400", badgeSelected: "bg-emerald-500/40 text-emerald-200", badgeUnselected: "bg-muted text-muted-foreground" },
                    { id: "failed", label: "❌ Falhou", count: counts.failed, selectedClasses: "bg-rose-500/20 border-rose-500/50 text-rose-400 ring-1 ring-rose-500/50", hoverClasses: "hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400", badgeSelected: "bg-rose-500/40 text-rose-200", badgeUnselected: "bg-muted text-muted-foreground" },
                  ];

                  return (
                    <div className="p-4 border-b border-border bg-muted/10 flex flex-col gap-3">
                      <span className="text-muted-foreground font-bold text-sm">Filtro Rápido de Status:</span>
                      <div className="flex flex-wrap gap-2">
                        {filterOptions.map(opt => {
                          const isSelected = scraperStatusFilter === opt.id;
                          const dynamicClasses = isSelected ? opt.selectedClasses : `bg-card border-border text-muted-foreground ${opt.hoverClasses}`;
                          const badgeClasses = isSelected ? opt.badgeSelected : opt.badgeUnselected;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setScraperStatusFilter(opt.id);
                                setHistoryPage(1);
                              }}
                              className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${dynamicClasses}`}
                            >
                              {opt.label}
                              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono transition-colors ${badgeClasses}`}>
                                {opt.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="overflow-x-auto">
                  {scraperError ? (
                    <div className="p-12 text-center text-sm text-red-400 border border-red-500/20 bg-red-500/5 m-6 rounded-xl">
                      Falha ao carregar registros do scraper: {scraperError}
                    </div>
                  ) : (() => {
                    const historyJobs = scraperJobs.filter(j => {
                      if (j.status === "pending_approval") return false;
                      if (scraperStatusFilter !== "all" && j.status !== scraperStatusFilter) return false;
                      return true;
                    });
                    
                    if (historyJobs.length === 0) {
                      return (
                        <div className="p-12 text-center text-sm text-muted-foreground">
                          {scraperStatusFilter !== "all" 
                            ? "Nenhum processo encontrado com este filtro." 
                            : "Nenhum processo registrado no histórico recentemente."}
                        </div>
                      );
                    }
                    
                    const ITEMS_PER_PAGE = 10;
                    const totalHistoryPages = Math.ceil(historyJobs.length / ITEMS_PER_PAGE);
                    const paginatedJobs = historyJobs.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);

                    return (
                      <>
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/10 text-muted-foreground font-semibold">
                            <th className="px-6 py-4">Arquivo</th>
                            <th className="px-6 py-4">Canal / Grupo</th>
                            <th className="px-6 py-4">Tamanho</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Atualizado Em</th>
                            <th className="px-6 py-4">Ação / Erro</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {paginatedJobs.map((job) => {
                            const dateFormatted = new Date(job.updated_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit"
                            });
                            
                            let statusText = job.status;
                            let statusColor = "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
                            
                            switch (job.status) {
                              case "downloading_file":
                                statusText = "Baixando STL";
                                statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                                break;
                              case "uploading_vault":
                                statusText = "Salvando no Vault";
                                statusColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                                break;
                              case "indexing":
                                statusText = "Indexando no Banco";
                                statusColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                                break;
                              case "completed":
                                statusText = "Concluído";
                                statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                                break;
                              case "failed":
                                statusText = "Falhou";
                                statusColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                                break;
                              case "pending":
                                statusText = "Na Fila";
                                statusColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                                break;
                            }

                            const formattedSize = job.file_size_bytes 
                              ? job.file_size_bytes > 1024 * 1024 * 1024
                                ? `${(job.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                : job.file_size_bytes > 1024 * 1024
                                  ? `${(job.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`
                                  : `${(job.file_size_bytes / 1024).toFixed(2)} KB`
                              : "---";

                            const isActive = ["pending", "downloading_file", "uploading_vault", "indexing"].includes(job.status);

                            return (
                              <tr key={job.id} className="hover:bg-muted/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-foreground">
                                  <div className="max-w-[220px] truncate" title={job.file_name}>{job.file_name}</div>
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                  <div className="max-w-[160px] truncate" title={job.chat_title}>{job.chat_title}</div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs">{formattedSize}</td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
                                    {typeof job.progress === "number" && job.progress > 0 && job.progress < 100
                                      ? `${statusText} (${job.progress}%)`
                                      : statusText}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-muted-foreground">{dateFormatted}</td>
                                <td className="px-6 py-4 text-xs max-w-[250px] truncate text-muted-foreground" title={job.error_message || ""}>
                                  {isActive ? (
                                    <button
                                      onClick={() => handleJobAction(job.id, "cancel")}
                                      disabled={actingJobId !== null}
                                      className="px-2 py-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded transition-all cursor-pointer disabled:opacity-50"
                                    >
                                      {actingJobId === job.id ? "Processando..." : "Cancelar Download"}
                                    </button>
                                  ) : job.status === "failed" ? (
                                    <div className="flex flex-col gap-1 items-start">
                                      <span className="text-red-400">{job.error_message}</span>
                                      <button
                                        onClick={() => handleJobAction(job.id, "retry")}
                                        disabled={actingJobId !== null}
                                        className="px-2 py-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 rounded transition-all cursor-pointer disabled:opacity-50 mt-1"
                                      >
                                        {actingJobId === job.id ? "Processando..." : "Re-processar"}
                                      </button>
                                    </div>
                                  ) : job.status === "completed" ? (
                                    <span className="text-emerald-400">Processado com sucesso</span>
                                  ) : (
                                    <span className="text-muted-foreground">---</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      
                      {/* History Pagination */}
                      {totalHistoryPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/5">
                          <div className="text-xs text-muted-foreground">
                            Página {historyPage} de {totalHistoryPages} (Total: {historyJobs.length})
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                              disabled={historyPage === 1}
                              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Anterior
                            </button>
                            <button 
                              onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                              disabled={historyPage === totalHistoryPages}
                              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Próxima
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* SECTION: VARREDURA RETROATIVA (BACKFILL) */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm p-6 space-y-5">
                <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Download className="w-5 h-5 text-primary" />
                      <h3 className="font-bold text-base text-foreground">Varredura Retroativa</h3>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xl">
                      Reprocessa mensagens históricas dos grupos monitorados para recuperar arquivos STL enviados enquanto o scraper estava offline.
                      A varredura roda em background — acompanhe os novos itens na fila acima.
                    </p>
                  </div>
                  <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${
                    scraperStatus === "healthy"
                      ? "bg-success/10 border-success/20 text-success"
                      : scraperStatus === "warning"
                      ? "bg-warning/10 border-warning/20 text-warning"
                      : "bg-destructive/10 border-destructive/20 text-destructive"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      scraperStatus === "healthy" ? "bg-success badge-pulse-success" :
                      scraperStatus === "warning" ? "bg-warning badge-pulse-warning" :
                      "bg-destructive badge-pulse-destructive"
                    }`} />
                    {scraperStatus === "offline" ? "Scraper Offline — reconecte antes de varrer" :
                     scraperStatus === "warning" ? "Scraper Instável" : "Scraper Online"}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
                  {/* Time window selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">
                      Janela de Tempo
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "1h", value: 1 },
                        { label: "3h", value: 3 },
                        { label: "6h", value: 6 },
                        { label: "12h", value: 12 },
                        { label: "24h", value: 24 },
                        { label: "48h", value: 48 },
                        { label: "7 dias", value: 168 },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setBackfillHoursBack(opt.value)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                            backfillHoursBack === opt.value
                              ? "bg-primary/15 border-primary/40 text-primary"
                              : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-primary/25"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Mensagens dos últimos <strong className="text-foreground">{backfillHoursBack}h</strong> serão verificadas (até 500 por grupo).
                    </p>
                  </div>

                  {/* Trigger button */}
                  <button
                    onClick={handleRunBackfill}
                    disabled={isRunningBackfill || scraperStatus === "offline"}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
                               text-primary-foreground text-sm font-bold transition-all shadow-primary cursor-pointer shrink-0"
                  >
                    {isRunningBackfill ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Disparando...
                      </>
                    ) : (
                      <>
                        <Download size={15} />
                        Disparar Varredura
                      </>
                    )}
                  </button>
                </div>

                {/* Result feedback */}
                <AnimatePresence>
                  {backfillResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className={`rounded-xl border px-4 py-3.5 text-sm flex items-start gap-3 ${
                        backfillResult.ok
                          ? "bg-success/8 border-success/25 text-success"
                          : "bg-destructive/8 border-destructive/25 text-destructive"
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {backfillResult.ok ? <Check size={16} /> : <AlertTriangle size={16} />}
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-semibold">{backfillResult.message}</p>
                        {backfillResult.cutoff_date && (
                          <p className="text-xs opacity-70">
                            Cobertura a partir de: {new Date(backfillResult.cutoff_date).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setBackfillResult(null)}
                        className="ml-auto shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              </div>
              </div>{/* end queue sub-tab */}

            </div>
          )}

          {/* ABA: ACERVO (REVISÃO DE FOTOS) */}
          {activeTab === "acervo" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <ImageIcon className="text-primary" size={20} />
                      Revisão de Fotos Mescladas
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Gerencie os modelos duplicados que receberam novas fotos do scraper para confirmar se não são imagens repetidas.
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
                  ) : (() => {
                    const ITEMS_PER_PAGE = 24;
                    const totalIndexedPages = Math.ceil(indexedModels.length / ITEMS_PER_PAGE);
                    const paginatedModels = indexedModels.slice((indexedPage - 1) * ITEMS_PER_PAGE, indexedPage * ITEMS_PER_PAGE);

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {paginatedModels.map((model) => {
                            const hasPhotos = model.photos && model.photos.length > 0;
                            const dbThumb = model.thumbnail_url?.includes("unsplash") ? "" : model.thumbnail_url;
                            const thumbUrl = hasPhotos ? model.photos[0] : dbThumb;
                            const formattedSize = model.file_size_bytes 
                              ? `${(model.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB` 
                              : "N/A";

                            return (
                              <div key={model.id} className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:border-amber-500/30 transition-all flex flex-col justify-between shadow-md">
                                <div className="relative aspect-video w-full bg-muted overflow-hidden">
                                  {hasPhotos ? (
                                    <img 
                                      src={thumbUrl} 
                                      alt={model.file_name} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
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
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedIndexedModel(model);
                                      setActivePhotoIndex(0);
                                    }}
                                    className="absolute inset-0 z-10 w-full h-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-bold backdrop-blur-sm cursor-pointer"
                                  >
                                    Gerenciar {hasPhotos && `(${model.photos.length} foto${model.photos.length > 1 ? 's' : ''})`}
                                  </button>
                                </div>
                                <div className="p-4">
                                  <h4 className="font-bold text-sm text-foreground line-clamp-2" title={model.file_name}>
                                    {model.file_name}
                                  </h4>
                                  <div className="mt-2 text-[11px] text-muted-foreground flex justify-between items-center">
                                    <span>Indexado em:</span>
                                    <span>{new Date(model.created_at).toLocaleDateString("pt-BR")}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Pagination for Indexed Models */}
                        {totalIndexedPages > 1 && (
                          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                            <div className="text-sm text-muted-foreground font-medium">
                              Página {indexedPage} de {totalIndexedPages} (Total: {indexedModels.length})
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setIndexedPage(p => Math.max(1, p - 1))}
                                disabled={indexedPage === 1}
                                className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Anterior
                              </button>
                              <button 
                                onClick={() => setIndexedPage(p => Math.min(totalIndexedPages, p + 1))}
                                disabled={indexedPage === totalIndexedPages}
                                className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Próxima
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PLATFORM ANALYTICS */}
          {activeTab === "analytics" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {analyticsError && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-yellow-500 flex items-center gap-2">
                      <AlertTriangle size={18} className="shrink-0" />
                      Banco de Dados desatualizado ou Erro de Conexão
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-2xl mt-1">
                      Não foi possível carregar o histórico de downloads. Isso geralmente ocorre se a tabela <code className="bg-muted px-1 py-0.5 rounded text-yellow-400 font-mono">telegram_downloads_history</code> ainda não foi criada no banco de dados Supabase remoto.
                    </p>
                    <p className="text-xs text-muted-foreground max-w-2xl">
                      Por favor, execute a migração localizada em <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">supabase/migrations/20260615_profile_enhancements_and_download_history.sql</code> utilizando o SQL Editor do seu painel do Supabase.
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
                      Detalhes do erro: {analyticsError}
                    </p>
                  </div>
                  <button
                    onClick={fetchAnalyticsData}
                    className="px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-xs font-bold rounded-lg border border-yellow-500/25 transition-all whitespace-nowrap cursor-pointer shrink-0"
                  >
                    Tentar Novamente
                  </button>
                </div>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: t('admin.totalDownloads', "Total de Downloads"), value: downloadHistory.length, unit: "arquivos" },
                  { title: t('admin.uniqueUsers', "Usuários Únicos"), value: new Set(downloadHistory.map(h => h.user_email)).size, unit: "usuários" },
                  { title: t('admin.activeChannels', "Canais Ativos"), value: new Set(downloadHistory.map(h => h.chat_title)).size, unit: "grupos" },
                  { title: t('admin.downloadsPeriod', "Downloads no Período"), value: downloadHistory.filter(h => {
                      const diffTime = Math.abs(new Date().getTime() - new Date(h.downloaded_at).getTime())
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                      return diffDays <= 7
                    }).length, unit: "últimos 7 dias" }
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className="bg-card border border-border border-glow-indigo-hover rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all duration-300"
                  >
                    <span className="text-xs font-bold text-muted-foreground uppercase">{stat.title}</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-foreground">{stat.value}</span>
                      <span className="text-xs text-muted-foreground">{stat.unit}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Downloads Over Time (Responsive SVG Area Chart) */}
                <div className="bg-card border border-border border-glow-indigo-hover rounded-2xl p-6 shadow-sm space-y-4 relative">
                  <h3 className="font-bold text-base text-foreground">{t('admin.downloadsOverTime', "Downloads ao Longo do Tempo (Últimos 7 dias)")}</h3>
                  <div className="h-64 relative pt-4 pb-2 px-2">
                    {(() => {
                      const maxCount = Math.max(...downloadsOverTimeData.map(x => x.count), 1)
                      const svgPoints = downloadsOverTimeData.map((d, i) => {
                        const x = (i / 6) * 440 + 30
                        const y = 170 - (d.count / maxCount) * 130
                        return { x, y, label: d.label, count: d.count, key: d.key }
                      })

                      return (
                        <div className="w-full h-full relative">
                          <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
                            <defs>
                              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            
                            {/* Grid Lines */}
                            <line x1="30" y1="40" x2="470" y2="40" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                            <line x1="30" y1="105" x2="470" y2="105" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                            <line x1="30" y1="170" x2="470" y2="170" stroke="var(--border)" strokeWidth="1.5" opacity="0.5" />

                            {/* Area Fill */}
                            {svgPoints.length > 0 && (
                              <motion.path
                                d={`M ${svgPoints[0].x} 170 L ${svgPoints.map(p => `${p.x} ${p.y}`).join(' L ')} L ${svgPoints[svgPoints.length - 1].x} 170 Z`}
                                fill="url(#areaGradient)"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.8, delay: 0.3 }}
                              />
                            )}

                            {/* Line Stroke */}
                            {svgPoints.length > 0 && (
                              <motion.path
                                d={`M ${svgPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 1.2, ease: "easeInOut" }}
                              />
                            )}

                            {/* Points & Interactive Tooltips */}
                            {svgPoints.map((p) => (
                              <g
                                key={p.key}
                                className="group cursor-pointer"
                                onMouseEnter={() => setHoveredPoint(p)}
                                onMouseLeave={() => setHoveredPoint(null)}
                              >
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="4"
                                  className="fill-card stroke-indigo-500 transition-all duration-200 group-hover:r-6"
                                  strokeWidth="3.5"
                                />
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="16"
                                  className="fill-transparent"
                                />
                                {/* Label Text below axis */}
                                <text
                                  x={p.x}
                                  y="192"
                                  textAnchor="middle"
                                  className="text-[10px] fill-muted-foreground font-mono font-bold"
                                >
                                  {p.label}
                                </text>
                              </g>
                            ))}
                          </svg>

                          {/* Hover Tooltip Overlay */}
                          <AnimatePresence>
                            {hoveredPoint && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 5 }}
                                transition={{ duration: 0.15 }}
                                className="absolute bg-slate-900 border border-slate-700 text-slate-100 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap z-20 flex flex-col items-center gap-0.5"
                                style={{
                                  left: `${(hoveredPoint.x / 500) * 100}%`,
                                  top: `${(hoveredPoint.y / 200) * 100}%`,
                                  transform: "translate(-50%, -125%)",
                                }}
                              >
                                <span className="text-[9px] text-indigo-400 font-mono">{hoveredPoint.label}</span>
                                <span>{hoveredPoint.count} downloads</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Chart 2: Downloads By Channel */}
                <div className="bg-card border border-border border-glow-indigo-hover rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-base text-foreground">{t('admin.downloadsByChannel', "Downloads por Canal de Origem")}</h3>
                  <div className="space-y-4 pt-2">
                    {downloadsByChannelData.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                        Nenhum dado disponível
                      </div>
                    ) : (
                      downloadsByChannelData.map((ch, idx) => {
                        const maxDownloads = Math.max(...downloadsByChannelData.map(x => x.count), 1)
                        const percentage = (ch.count / maxDownloads) * 100
                        return (
                          <div key={ch.name} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold text-foreground">
                              <span className="truncate max-w-[200px]">{ch.name}</span>
                              <span className="font-mono text-xs">{ch.count} downloads</span>
                            </div>
                            <div className="w-full bg-muted border border-border h-3.5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 1, delay: idx * 0.1, ease: "easeOut" }}
                                className="bg-gradient-to-r from-primary to-indigo-500 h-full rounded-full" 
                              />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* History Table */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-bold text-base text-foreground">{t('admin.historyTableTitle', "Histórico Detalhado de Utilização")}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('admin.historyTableSubtitle', "Lista completa de arquivos baixados por usuários.")}
                    </p>
                  </div>
                  <button
                    onClick={fetchAnalyticsData}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/25 transition-all cursor-pointer"
                  >
                    <RefreshCw size={14} />
                    Atualizar Relatório
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {isLoadingAnalytics ? (
                    <div className="p-12 text-center text-sm text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                      {t('admin.loadingStats', "Carregando estatísticas...")}
                    </div>
                  ) : downloadHistory.length === 0 ? (
                    <div className="p-12 text-center text-sm text-muted-foreground">
                      {t('admin.noRecords', "Nenhum registro de download encontrado no banco de dados.")}
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/10 text-muted-foreground font-semibold">
                          <th className="px-6 py-4">{t('admin.colUser', "Usuário")}</th>
                          <th className="px-6 py-4">{t('admin.colFile', "Arquivo")}</th>
                          <th className="px-6 py-4">{t('admin.colChannel', "Canal")}</th>
                          <th className="px-6 py-4">{t('admin.colDate', "Data do Download")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {downloadHistory.map((log) => {
                          const dateFormatted = new Date(log.downloaded_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          });
                          return (
                            <tr key={log.id} className="hover:bg-muted/5 transition-colors">
                              <td className="px-6 py-4 font-medium text-foreground">{log.user_email}</td>
                              <td className="px-6 py-4 font-medium text-foreground/90 max-w-[250px] truncate" title={log.file_name}>
                                {log.file_name}
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">{log.chat_title}</td>
                              <td className="px-6 py-4 text-xs font-mono text-muted-foreground">{dateFormatted}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 6: TICKETS CENTER */}
          {activeTab === "tickets" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <TicketsTab />
            </motion.div>
          )}

          {/* TAB 7: FEATURE FLAGS */}
          {activeTab === "flags" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
            >
              <div className="p-6 border-b border-border bg-muted/20">
                <h3 className="font-bold text-base">Controle de Features (Feature Flags)</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Ative ou desative funcionalidades em tempo real para os usuários da plataforma de forma faseada.
                </p>
              </div>

              <div className="p-6 divide-y divide-border/60">
                {featureFlags.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    Nenhuma feature flag cadastrada no banco de dados.
                  </div>
                ) : (
                  featureFlags.map((flag) => (
                    <div key={flag.key} className="py-4 flex items-center justify-between gap-6">
                      <div className="space-y-1">
                        <span className="font-bold text-sm text-foreground">{flag.display_name}</span>
                        <p className="text-[10px] text-muted-foreground font-mono">Chave: {flag.key}</p>
                      </div>
                      
                      {/* Styled Toggle Switch */}
                      <button
                        onClick={() => handleToggleFlag(flag.key, flag.is_enabled)}
                        className={`relative w-12 h-6 rounded-full p-0.5 transition-all duration-300 outline-none select-none cursor-pointer border shadow-inner flex items-center
                          ${flag.is_enabled 
                            ? "bg-primary/20 border-primary text-primary" 
                            : "bg-muted border-border text-muted-foreground"
                          }`}
                      >
                        <motion.div
                          layout
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className={`w-4.5 h-4.5 rounded-full shadow-md transition-all
                            ${flag.is_enabled 
                              ? "bg-primary translate-x-6" 
                              : "bg-muted-foreground/60 translate-x-0.5"
                            }`}
                        />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

        </div>
      )}

      {/* Modal de Detalhes do Job */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {selectedJobDetails && (
          <div key="job-modal" className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setSelectedJobDetails(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            >
              {/* Lado Esquerdo: Imagens */}
              <div className="w-full md:w-3/5 bg-muted/50 relative flex items-center justify-center min-h-[300px]">
                {selectedJobDetails.photos && selectedJobDetails.photos.length > 0 ? (
                  <>
                    <img 
                      src={selectedJobDetails.photos[activePhotoIndex]} 
                      alt={`Foto ${activePhotoIndex + 1}`} 
                      className="max-w-full max-h-[60vh] object-contain"
                    />
                    
                    {/* Controles de Navegação */}
                    {selectedJobDetails.photos.length > 1 && (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(prev => prev > 0 ? prev - 1 : selectedJobDetails.photos.length - 1); }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 backdrop-blur-md transition-all cursor-pointer"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(prev => prev < selectedJobDetails.photos.length - 1 ? prev + 1 : 0); }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 backdrop-blur-md transition-all cursor-pointer"
                        >
                          <ChevronRight size={20} />
                        </button>
                        
                        {/* Indicadores */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-2 rounded-full bg-black/30 backdrop-blur-md">
                          {selectedJobDetails.photos.map((_: any, idx: number) => (
                            <button
                              key={idx}
                              onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(idx); }}
                              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${idx === activePhotoIndex ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"}`}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {selectedJobDetails.photos.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if(confirm("Tem certeza que deseja excluir APENAS esta foto?")) {
                            handleRemoveJobPhoto(selectedJobDetails.id, activePhotoIndex);
                          }
                        }}
                        className="absolute top-4 left-4 bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 backdrop-blur-md transition-all shadow-md z-10 cursor-pointer"
                      >
                        Excluir Foto Atual
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <ImageIcon size={48} className="opacity-20" />
                    <span className="text-sm">Nenhuma foto disponível</span>
                  </div>
                )}

                <div className="absolute top-4 right-4 flex gap-2 z-10">
                  <button 
                    onClick={() => handleAddJobPhotoUrl(selectedJobDetails.id)} 
                    className="py-1.5 px-3 bg-background/90 hover:bg-muted text-foreground rounded-full border border-border backdrop-blur-md transition-all flex items-center gap-1.5 shadow-lg text-[9px] uppercase tracking-wider font-bold cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-primary" />
                    <span className="hidden sm:inline">Add URL</span>
                  </button>
                  <label className="py-1.5 px-3 bg-background/90 hover:bg-muted text-foreground rounded-full border border-border backdrop-blur-md transition-all flex items-center gap-1.5 shadow-lg text-[9px] uppercase tracking-wider font-bold cursor-pointer">
                    {isUploadingJobPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3 text-primary" />}
                    <span className="hidden sm:inline">{isUploadingJobPhoto ? "Enviando..." : "Upload"}</span>
                    <input type="file" accept="image/*" onChange={(e) => handleUploadJobPhotoFile(selectedJobDetails.id, e)} disabled={isUploadingJobPhoto} className="hidden" />
                  </label>
                </div>
              </div>
              
              {/* Lado Direito: Informações */}
              <div className="w-full md:w-2/5 p-6 flex flex-col h-full bg-card">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-lg font-bold text-foreground">Detalhes do Arquivo</h3>
                  <button 
                    onClick={() => setSelectedJobDetails(null)}
                    className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Nome Original</span>
                    <p className="text-sm font-medium text-foreground break-all">{selectedJobDetails.file_name}</p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Origem</span>
                    <p className="text-sm text-foreground">{selectedJobDetails.chat_title}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Tamanho</span>
                      <p className="text-sm text-foreground font-mono">
                        {selectedJobDetails.file_size_bytes 
                          ? `${(selectedJobDetails.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB` 
                          : "---"}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Status</span>
                      <p className="text-sm text-amber-500 font-medium">Aguardando Aprovação</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Criado em</span>
                    <p className="text-sm text-foreground">
                      {new Date(selectedJobDetails.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-border mt-auto grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      handleJobAction(selectedJobDetails.id, "approve");
                      setSelectedJobDetails(null);
                    }}
                    disabled={actingJobId !== null}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Check size={16} /> Aprovar
                  </button>
                  <button
                    onClick={() => {
                      handleJobAction(selectedJobDetails.id, "reject");
                      setSelectedJobDetails(null);
                    }}
                    disabled={actingJobId !== null}
                    className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/20 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        </AnimatePresence>,
        document.body
      )}

      {/* Modal de Gestão do Acervo (Indexed Models) */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {selectedIndexedModel && (
            <div key="indexed-modal" className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={() => setSelectedIndexedModel(null)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-5xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
              >
                {/* Lado Esquerdo: Imagens */}
                <div className="w-full md:w-3/5 bg-muted/50 relative flex items-center justify-center min-h-[300px]">
                  {selectedIndexedModel.photos && selectedIndexedModel.photos.length > 0 ? (
                    <>
                      <img 
                        src={selectedIndexedModel.photos[activePhotoIndex]} 
                        alt={`Foto ${activePhotoIndex + 1}`} 
                        className="max-w-full max-h-[70vh] object-contain"
                      />
                      
                      {selectedIndexedModel.photos.length > 1 && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(prev => prev > 0 ? prev - 1 : selectedIndexedModel.photos.length - 1); }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-all cursor-pointer border border-white/10"
                          >
                            <ArrowRight size={20} className="rotate-180" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(prev => prev < selectedIndexedModel.photos.length - 1 ? prev + 1 : 0); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-all cursor-pointer border border-white/10"
                          >
                            <ArrowRight size={20} />
                          </button>

                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-2 rounded-full bg-black/30 backdrop-blur-md">
                            {selectedIndexedModel.photos.map((_: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(idx); }}
                                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${idx === activePhotoIndex ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                      
                      {/* Botão de excluir foto específica */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if(confirm("Tem certeza que deseja excluir APENAS esta foto do modelo?")) {
                            handleRemovePhoto(selectedIndexedModel.id, activePhotoIndex);
                          }
                        }}
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

                {/* Lado Direito: Infos e Ações */}
                <div className="w-full md:w-2/5 p-6 flex flex-col max-h-[50vh] md:max-h-[90vh] overflow-y-auto">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <h3 className="text-xl font-bold text-foreground">Gerenciar Modelo</h3>
                    <button 
                      onClick={() => setSelectedIndexedModel(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted-foreground/20 text-muted-foreground transition-colors shrink-0"
                    >
                      ✕
                    </button>
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
                          {selectedIndexedModel.file_size_bytes 
                            ? `${(selectedIndexedModel.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB` 
                            : "---"}
                        </p>
                      </div>
                      <div className="space-y-1 bg-muted/30 p-4 rounded-xl border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Origem</p>
                        <p className="text-sm font-medium text-foreground truncate" title={selectedIndexedModel.chat_title}>
                          {selectedIndexedModel.chat_title || "Desconhecida"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-1 bg-muted/30 p-4 rounded-xl border border-border">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Indexado Em</p>
                      <p className="text-sm font-medium text-foreground">{new Date(selectedIndexedModel.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-border flex flex-col gap-3">
                    <button
                      onClick={() => handleMarkAsReviewed(selectedIndexedModel.id)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      Marcar como Revisado (Ocultar)
                    </button>
                    <button
                      onClick={() => handleDeleteModel(selectedIndexedModel.id)}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      Excluir Modelo Inteiro do Acervo
                    </button>
                    <button
                      onClick={() => setSelectedIndexedModel(null)}
                      className="w-full py-2.5 bg-muted hover:bg-border text-foreground text-sm font-bold rounded-xl flex items-center justify-center transition-all cursor-pointer"
                    >
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
      </div>
    </div>
  )
}

// ─── HELPER COMPONENTS ─────────────────────────────────────────────

interface FeatureCostCardProps {
  feature: FeatureCost
  onSave: (key: string, free: number, pro: number, max: number) => void
  isSaving: boolean
  isSuccess: boolean
}

function FeatureCostCard({ feature, onSave, isSaving, isSuccess }: FeatureCostCardProps) {
  const [free, setFree] = useState(feature.cost_free)
  const [pro, setPro] = useState(feature.cost_pro)
  const [max, setMax] = useState(feature.cost_max)

  return (
    <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500/30 transition-all shadow-sm">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
            <Settings size={18} />
          </div>
          <h3 className="font-bold text-base text-foreground">{feature.display_name}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Chave: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{feature.feature_key}</code></p>
        
        {/* Tier Costs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Plano Free</label>
            <div className="relative flex items-center">
              <input 
                type="number" 
                min={0}
                value={free} 
                onChange={(e) => setFree(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-3 text-[10px] text-muted-foreground pointer-events-none">CR</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Plano Pro</label>
            <div className="relative flex items-center">
              <input 
                type="number" 
                min={0}
                value={pro} 
                onChange={(e) => setPro(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-3 text-[10px] text-muted-foreground pointer-events-none">CR</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Plano Max</label>
            <div className="relative flex items-center">
              <input 
                type="number" 
                min={0}
                value={max} 
                onChange={(e) => setMax(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-3 text-[10px] text-muted-foreground pointer-events-none">CR</span>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => onSave(feature.feature_key, free, pro, max)}
        disabled={isSaving}
        className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer
          ${isSuccess 
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
            : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          }`}
      >
        {isSaving ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isSuccess ? (
          <Check size={14} />
        ) : (
          <Save size={14} />
        )}
        {isSaving ? "Salvando..." : isSuccess ? "Preços Salvos!" : "Salvar Preços"}
      </button>
    </div>
  )
}

interface ModelPriceCardProps {
  model: CatalogItem
  onSave: (id: string, free: number, pro: number, max: number) => void
  isSaving: boolean
  isSuccess: boolean
}

function ModelPriceCard({ model, onSave, isSaving, isSuccess }: ModelPriceCardProps) {
  const [free, setFree] = useState(model.price_free)
  const [pro, setPro] = useState(model.price_pro)
  const [max, setMax] = useState(model.price_max)

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/30 transition-all shadow-sm">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
            <Package size={18} />
          </div>
          <h3 className="font-bold text-sm text-foreground truncate">{model.title}</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4 capitalize">Tipo: {model.type.replace('_', ' ')}</p>
        
        {/* Tier Costs */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase">Free</label>
            <div className="relative flex items-center">
              <input 
                type="number" 
                min={0}
                value={free} 
                onChange={(e) => setFree(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase">Pro</label>
            <div className="relative flex items-center">
              <input 
                type="number" 
                min={0}
                value={pro} 
                onChange={(e) => setPro(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase">Max</label>
            <div className="relative flex items-center">
              <input 
                type="number" 
                min={0}
                value={max} 
                onChange={(e) => setMax(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => onSave(model.id, free, pro, max)}
        disabled={isSaving}
        className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer
          ${isSuccess 
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
            : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          }`}
      >
        {isSaving ? (
          <Loader2 size={12} className="animate-spin" />
        ) : isSuccess ? (
          <Check size={12} />
        ) : (
          <Save size={12} />
        )}
        {isSaving ? "Salvando..." : isSuccess ? "Salvo!" : "Salvar Custo"}
      </button>
    </div>
  )
}

interface UserRowProps {
  user: Profile
  onSave: (id: string, plan: "free" | "pro" | "max", credits: number) => void
  isSaving: boolean
  isSuccess: boolean
  onOpenModal: (user: Profile) => void
}

function UserRow({ user, onSave, isSaving, isSuccess, onOpenModal }: UserRowProps) {
  const [plan, setPlan] = useState<"free" | "pro" | "max">(user.plan as any || "free")
  const [credits, setCredits] = useState(user.credits)

  const isDirty = plan !== user.plan || credits !== user.credits

  return (
    <tr className="hover:bg-muted/10 transition-colors">
      <td className="px-6 py-4 font-medium text-foreground">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
             <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || user.email)}&background=random`} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold">{user.full_name || user.email.split('@')[0]}</span>
              {user.role === "sysadmin" && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-px uppercase">
                  Sysadmin
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value as any)}
          className="bg-muted border border-border rounded-lg text-xs px-2.5 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-primary capitalize cursor-pointer"
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="max">Max</option>
        </select>
      </td>
      <td className="px-6 py-4">
        <input 
          type="number"
          value={credits}
          onChange={(e) => setCredits(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-20 bg-muted border border-border rounded-lg text-xs px-2.5 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-primary"
        />
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onOpenModal(user)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title="Ver detalhes do usuário"
          >
            <Activity size={16} />
          </button>
          <button
            onClick={() => onSave(user.id, plan, credits)}
            disabled={!isDirty || isSaving}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer
              ${isSuccess 
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                : isDirty 
                  ? "bg-primary text-primary-foreground hover:opacity-90" 
                  : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
              }`}
          >
            {isSaving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : isSuccess ? (
              <UserCheck size={12} />
            ) : (
              <Save size={12} />
            )}
            {isSaving ? "Aplicando..." : isSuccess ? "Aplicado!" : "Aplicar"}
          </button>
        </div>
      </td>
    </tr>
  )
}
