"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useAppStore } from "@/store/store"
import { useShallow } from "zustand/react/shallow"
import {
  RefreshCw, Loader2, Trash2, Check, ScanSearch, X,
  ImageOff, AlertTriangle, Search as SearchIcon,
} from "lucide-react"

interface StlRow {
  id: string
  title: string | null
  file_name: string
  photos: string[] | null
}

type FilterMode = "all" | "suspicious" | "no_photo" | "unreviewed"

const PAGE_SIZE = 40
const SUSPICIOUS_THRESHOLD = 4 // 4+ fotos = provável contaminação
const DHASH_DUPE_DISTANCE = 6  // distância de Hamming <= 6 => visualmente iguais
const REVIEWED_KEY = "photoCuratorReviewed"

/* ---------- dHash client-side (canvas, sem dependências) ---------- */
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function computeDHash(url: string): Promise<string | null> {
  try {
    const img = await loadImage(url)
    const canvas = document.createElement("canvas")
    canvas.width = 9
    canvas.height = 8
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, 9, 8)
    const { data } = ctx.getImageData(0, 0, 9, 8)
    // luminância por pixel
    const grays: number[] = []
    for (let i = 0; i < data.length; i += 4) {
      grays.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    }
    let hash = ""
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = y * 9 + x
        hash += grays[left] > grays[left + 1] ? "1" : "0"
      }
    }
    return hash
  } catch {
    return null // CORS ou erro de carga: ignora
  }
}

function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 999
  let d = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++
  return d
}

export function PhotoCurator() {
  const { profile } = useAppStore(useShallow((s) => ({ profile: s.profile })))
  const [rows, setRows] = useState<StlRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterMode>("all")
  const [page, setPage] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())

  // Detecção de duplicatas: stl_id -> set de URLs marcadas (borda vermelha)
  const [dupeMarks, setDupeMarks] = useState<Record<string, Set<string>>>({})
  const [scanningId, setScanningId] = useState<string | null>(null)

  // Drag state
  const dragData = useRef<{ stlId: string; url: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  /* ---------- carregar reviewed do localStorage ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem(REVIEWED_KEY)
    if (saved) {
      try { setReviewed(new Set(JSON.parse(saved))) } catch {}
    }
  }, [])

  const persistReviewed = useCallback((next: Set<string>) => {
    setReviewed(next)
    if (typeof window !== "undefined") {
      localStorage.setItem(REVIEWED_KEY, JSON.stringify([...next]))
    }
  }, [])

  /* ---------- carregar STLs ---------- */
  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from("telegram_indexed_stls")
        .select("id, title, file_name, photos")
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(2000)
      if (error) throw error
      setRows(data || [])
    } catch (err) {
      console.error("Erro ao carregar STLs:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

  /* ---------- token helper p/ chamadas admin ---------- */
  const getToken = useCallback(async () => {
    const supabase = getSupabaseBrowser()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }, [])

  const callApi = useCallback(async (payload: any) => {
    const token = await getToken()
    const res = await fetch("/api/admin/photo-curator", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error || `HTTP ${res.status}`)
    }
    return res.json()
  }, [getToken])

  /* ---------- filtros + busca ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const n = (r.photos || []).length
      if (filter === "suspicious" && n < SUSPICIOUS_THRESHOLD) return false
      if (filter === "no_photo" && n > 0) return false
      if (filter === "unreviewed" && reviewed.has(r.id)) return false
      if (q) {
        const hay = `${r.file_name} ${r.title || ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, search, filter, reviewed])

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  )
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  useEffect(() => { setPage(0) }, [search, filter])

  /* ---------- contadores ---------- */
  const counts = useMemo(() => {
    let suspicious = 0, noPhoto = 0, unreviewed = 0
    for (const r of rows) {
      const n = (r.photos || []).length
      if (n >= SUSPICIOUS_THRESHOLD) suspicious++
      if (n === 0) noPhoto++
      if (!reviewed.has(r.id)) unreviewed++
    }
    return { total: rows.length, suspicious, noPhoto, unreviewed }
  }, [rows, reviewed])

  /* ---------- mutação local otimista ---------- */
  const patchRowPhotos = useCallback((id: string, photos: string[]) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, photos } : r)))
  }, [])

  /* ---------- drag & drop ---------- */
  const onDragStart = (stlId: string, url: string) => {
    dragData.current = { stlId, url }
  }
  const onDrop = async (targetStlId: string) => {
    const drag = dragData.current
    dragData.current = null
    setDropTarget(null)
    if (!drag || drag.stlId === targetStlId) return

    const fromRow = rows.find((r) => r.id === drag.stlId)
    const toRow = rows.find((r) => r.id === targetStlId)
    if (!fromRow || !toRow) return

    // otimista
    const fromPhotos = (fromRow.photos || []).filter((p) => p !== drag.url)
    const toPhotos = toRow.photos?.includes(drag.url)
      ? [...(toRow.photos || [])]
      : [...(toRow.photos || []), drag.url]
    patchRowPhotos(drag.stlId, fromPhotos)
    patchRowPhotos(targetStlId, toPhotos)

    try {
      await callApi({ action: "move_photo", from_stl_id: drag.stlId, to_stl_id: targetStlId, photo_url: drag.url })
    } catch (e: any) {
      console.error("Falha ao mover foto:", e)
      // rollback
      patchRowPhotos(drag.stlId, fromRow.photos || [])
      patchRowPhotos(targetStlId, toRow.photos || [])
      alert(`Erro ao mover foto: ${e.message}`)
    }
  }

  /* ---------- excluir foto única ---------- */
  const deleteSinglePhoto = async (stlId: string, url: string) => {
    const row = rows.find((r) => r.id === stlId)
    if (!row) return
    if (!confirm("Excluir esta foto? O arquivo será apagado do Storage permanentemente.")) return
    setBusyId(stlId)
    const optimistic = (row.photos || []).filter((p) => p !== url)
    patchRowPhotos(stlId, optimistic)
    try {
      await callApi({ action: "delete_photos", stl_id: stlId, photo_urls: [url] })
    } catch (e: any) {
      patchRowPhotos(stlId, row.photos || [])
      alert(`Erro ao excluir: ${e.message}`)
    } finally {
      setBusyId(null)
    }
  }

  /* ---------- detectar duplicatas (client-side) ---------- */
  const detectDupes = async (stlId: string) => {
    const row = rows.find((r) => r.id === stlId)
    if (!row || !row.photos || row.photos.length < 2) return
    setScanningId(stlId)
    try {
      const marks = new Set<string>()

      // 1) URLs exatas repetidas
      const seenUrl = new Set<string>()
      for (const u of row.photos) {
        if (seenUrl.has(u)) marks.add(u)
        else seenUrl.add(u)
      }

      // 2) hash perceptual: agrupa visualmente iguais, marca todas menos a 1ª
      const hashes: { url: string; hash: string | null }[] = []
      for (const u of row.photos) {
        hashes.push({ url: u, hash: await computeDHash(u) })
      }
      for (let i = 0; i < hashes.length; i++) {
        if (!hashes[i].hash) continue
        for (let j = 0; j < i; j++) {
          if (!hashes[j].hash) continue
          if (hamming(hashes[i].hash!, hashes[j].hash!) <= DHASH_DUPE_DISTANCE) {
            marks.add(hashes[i].url) // mantém a primeira ocorrência, marca a posterior
            break
          }
        }
      }

      setDupeMarks((prev) => ({ ...prev, [stlId]: marks }))
      if (marks.size === 0) {
        // feedback rápido: nada encontrado
        setTimeout(() => alert("Nenhuma duplicata visual encontrada neste arquivo."), 0)
      }
    } finally {
      setScanningId(null)
    }
  }

  // alterna marca de uma foto (usuário pode des/marcar antes de confirmar)
  const toggleMark = (stlId: string, url: string) => {
    setDupeMarks((prev) => {
      const cur = new Set(prev[stlId] || [])
      if (cur.has(url)) cur.delete(url)
      else cur.add(url)
      return { ...prev, [stlId]: cur }
    })
  }

  const confirmDeleteMarked = async (stlId: string) => {
    const marks = dupeMarks[stlId]
    if (!marks || marks.size === 0) return
    const urls = [...marks]
    if (!confirm(`Excluir ${urls.length} foto(s) marcada(s)? Os arquivos serão apagados do Storage.`)) return
    const row = rows.find((r) => r.id === stlId)
    if (!row) return
    setBusyId(stlId)
    const optimistic = (row.photos || []).filter((p) => !marks.has(p))
    patchRowPhotos(stlId, optimistic)
    try {
      await callApi({ action: "delete_photos", stl_id: stlId, photo_urls: urls })
      setDupeMarks((prev) => { const n = { ...prev }; delete n[stlId]; return n })
    } catch (e: any) {
      patchRowPhotos(stlId, row.photos || [])
      alert(`Erro ao excluir: ${e.message}`)
    } finally {
      setBusyId(null)
    }
  }

  const clearMarks = (stlId: string) => {
    setDupeMarks((prev) => { const n = { ...prev }; delete n[stlId]; return n })
  }

  /* ---------- validar (marcar revisado) ---------- */
  const toggleReviewed = (stlId: string) => {
    const next = new Set(reviewed)
    if (next.has(stlId)) next.delete(stlId)
    else next.add(stlId)
    persistReviewed(next)
  }

  if (profile && profile.role !== "sysadmin") {
    return <div className="p-8 text-center text-muted-foreground">Acesso restrito a administradores.</div>
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanSearch className="w-6 h-6 text-primary" />
            Curadoria de Fotos
          </h1>
          <p className="text-sm text-muted-foreground">
            Arraste fotos entre arquivos, exclua erradas e detecte duplicatas. (R2 não é afetado.)
          </p>
        </div>
        <button
          onClick={fetchRows}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Recarregar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {([
          ["all", `Todos (${counts.total})`],
          ["suspicious", `⚠️ Suspeitos 4+ (${counts.suspicious})`],
          ["no_photo", `Sem foto (${counts.noPhoto})`],
          ["unreviewed", `Não revisados (${counts.unreviewed})`],
        ] as [FilterMode, string][]).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              filter === mode
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="relative ml-auto">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar arquivo..."
            className="pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm w-56"
          />
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando…
        </div>
      ) : paged.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">Nenhum arquivo encontrado.</div>
      ) : (
        <div className="space-y-2">
          {paged.map((row, idx) => {
            const photos = row.photos || []
            const isSuspicious = photos.length >= SUSPICIOUS_THRESHOLD
            const marks = dupeMarks[row.id]
            const isReviewed = reviewed.has(row.id)
            const globalIdx = page * PAGE_SIZE + idx + 1
            return (
              <div
                key={row.id}
                onDragOver={(e) => { e.preventDefault(); setDropTarget(row.id) }}
                onDragLeave={() => setDropTarget((t) => (t === row.id ? null : t))}
                onDrop={() => onDrop(row.id)}
                className={`rounded-xl border p-3 flex gap-3 items-start transition ${
                  dropTarget === row.id ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border"
                } ${isReviewed ? "opacity-70" : ""}`}
              >
                {/* Coluna: índice + nome + ações */}
                <div className="w-64 shrink-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground tabular-nums">#{globalIdx}</span>
                    {isSuspicious && (
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    )}
                  </div>
                  <p className="text-sm font-medium break-words leading-tight" title={row.file_name}>
                    {row.title || row.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{photos.length} foto(s)</p>

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <button
                      onClick={() => toggleReviewed(row.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${
                        isReviewed
                          ? "bg-success/15 border-success/40 text-success"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <Check className="w-3 h-3" /> {isReviewed ? "Revisado" : "Validar"}
                    </button>
                    <button
                      onClick={() => detectDupes(row.id)}
                      disabled={photos.length < 2 || scanningId === row.id}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-muted disabled:opacity-40"
                    >
                      {scanningId === row.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <ScanSearch className="w-3 h-3" />} Duplicatas
                    </button>
                  </div>

                  {/* Barra de confirmação de duplicatas */}
                  {marks && marks.size > 0 && (
                    <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30">
                      <p className="text-xs text-destructive mb-1.5">
                        {marks.size} marcada(s) p/ exclusão
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => confirmDeleteMarked(row.id)}
                          disabled={busyId === row.id}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                        >
                          {busyId === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Excluir
                        </button>
                        <button
                          onClick={() => clearMarks(row.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-muted"
                        >
                          <X className="w-3 h-3" /> Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna: fotos */}
                <div className="flex-1 flex flex-wrap gap-2 min-h-[80px]">
                  {photos.length === 0 ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm self-center">
                      <ImageOff className="w-4 h-4" /> Sem fotos — arraste uma para cá
                    </div>
                  ) : (
                    photos.map((url) => {
                      const marked = marks?.has(url)
                      return (
                        <div
                          key={url}
                          draggable
                          onDragStart={() => onDragStart(row.id, url)}
                          onClick={() => marks && toggleMark(row.id, url)}
                          className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing group ${
                            marked ? "border-destructive ring-2 ring-destructive/50" : "border-transparent"
                          }`}
                          title={marks ? "Clique para des/marcar" : "Arraste para outro arquivo"}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSinglePhoto(row.id, url) }}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                            title="Excluir foto"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-sm disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
