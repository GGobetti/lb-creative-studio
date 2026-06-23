"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useAppStore } from "@/store/store"
import { useShallow } from "zustand/react/shallow"
import {
  RefreshCw, Loader2, Trash2, Check, ScanSearch, X,
  ImageOff, AlertTriangle, Search as SearchIcon,
  Hand, ArrowDownToLine, Combine, CheckSquare, Square,
} from "lucide-react"

interface StlRow {
  id: string
  title: string | null
  file_name: string
  photos: string[] | null
  telegram_group_name: string | null
  created_at: string | null
}

type FilterMode = "all" | "suspicious" | "no_photo" | "unreviewed" | "reviewed"

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

function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
}

// Diferença de tempo legível entre dois ISOs (ex.: "+30s", "-2min", "+1h")
function relTime(fromIso: string | null, toIso: string | null): string {
  if (!fromIso || !toIso) return ""
  const diff = (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000
  const sign = diff >= 0 ? "+" : "−"
  const abs = Math.abs(diff)
  if (abs < 60) return `${sign}${Math.round(abs)}s`
  if (abs < 3600) return `${sign}${Math.round(abs / 60)}min`
  if (abs < 86400) return `${sign}${Math.round(abs / 3600)}h`
  return `${sign}${Math.round(abs / 86400)}d`
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

  // "Segurar foto": pega uma foto, busca o destino, solta — funciona entre
  // buscas/páginas (origem e destino não precisam estar visíveis juntos).
  const [held, setHeld] = useState<{ stlId: string; url: string } | null>(null)

  // Merge: seleção de arquivos + escolha do principal
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mergePrimary, setMergePrimary] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)

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
        .select("id, title, file_name, photos, telegram_group_name, created_at")
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
      if (filter === "reviewed" && !reviewed.has(r.id)) return false
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

  /* ---------- sugestões de destino (vizinhos temporais da foto segurada) ----------
   * Uma foto mal-associada quase sempre pertence a um arquivo indexado no mesmo
   * "burst" do scraping. Então, dado o arquivo de origem da foto segurada,
   * sugerimos os arquivos com created_at mais próximo (excluindo a própria origem). */
  const suggestions = useMemo(() => {
    if (!held) return []
    const source = rows.find((r) => r.id === held.stlId)
    if (!source?.created_at) return []
    const t0 = new Date(source.created_at).getTime()
    return rows
      .filter((r) => r.id !== held.stlId && r.created_at)
      .map((r) => ({ row: r, diff: Math.abs(new Date(r.created_at!).getTime() - t0) }))
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 4)
      .map((x) => x.row)
  }, [held, rows])

  const heldSource = useMemo(
    () => (held ? rows.find((r) => r.id === held.stlId) || null : null),
    [held, rows]
  )

  /* ---------- mover foto (compartilhado por drag&drop e "soltar aqui") ---------- */
  const movePhoto = useCallback(async (fromStlId: string, toStlId: string, url: string) => {
    if (fromStlId === toStlId) return
    const fromRow = rows.find((r) => r.id === fromStlId)
    const toRow = rows.find((r) => r.id === toStlId)
    if (!fromRow || !toRow) return

    // otimista
    const fromPhotos = (fromRow.photos || []).filter((p) => p !== url)
    const toPhotos = toRow.photos?.includes(url)
      ? [...(toRow.photos || [])]
      : [...(toRow.photos || []), url]
    patchRowPhotos(fromStlId, fromPhotos)
    patchRowPhotos(toStlId, toPhotos)

    try {
      await callApi({ action: "move_photo", from_stl_id: fromStlId, to_stl_id: toStlId, photo_url: url })
    } catch (e: any) {
      console.error("Falha ao mover foto:", e)
      // rollback
      patchRowPhotos(fromStlId, fromRow.photos || [])
      patchRowPhotos(toStlId, toRow.photos || [])
      alert(`Erro ao mover foto: ${e.message}`)
    }
  }, [rows, patchRowPhotos, callApi])

  /* ---------- drag & drop ---------- */
  const onDragStart = (stlId: string, url: string) => {
    dragData.current = { stlId, url }
  }
  const onDrop = async (targetStlId: string) => {
    const drag = dragData.current
    dragData.current = null
    setDropTarget(null)
    if (!drag) return
    await movePhoto(drag.stlId, targetStlId, drag.url)
  }

  /* ---------- "soltar aqui" (foto segurada) ---------- */
  const dropHeldOn = async (targetStlId: string) => {
    if (!held) return
    const h = held
    setHeld(null)
    await movePhoto(h.stlId, targetStlId, h.url)
  }

  /* ---------- seleção p/ merge ---------- */
  const toggleSelected = (stlId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(stlId)) {
        next.delete(stlId)
        if (mergePrimary === stlId) setMergePrimary(null)
      } else {
        next.add(stlId)
      }
      return next
    })
  }
  const clearSelection = () => { setSelected(new Set()); setMergePrimary(null) }

  const doMerge = async () => {
    if (!mergePrimary || selected.size < 2) return
    const mergedIds = [...selected].filter((id) => id !== mergePrimary)
    const primaryRow = rows.find((r) => r.id === mergePrimary)
    if (!primaryRow) return
    if (!confirm(
      `Mesclar ${mergedIds.length} arquivo(s) em "${primaryRow.title || primaryRow.file_name}"?\n` +
      `As fotos vão todas para o principal. Os outros viram ocultos (soft-delete) — o R2 não é afetado.`
    )) return

    setMerging(true)
    // otimista: une fotos no principal e remove os mesclados da lista
    const union = new Set<string>(primaryRow.photos || [])
    for (const id of mergedIds) {
      const r = rows.find((x) => x.id === id)
      for (const p of (r?.photos || [])) union.add(p)
    }
    const snapshot = rows
    setRows((prev) =>
      prev
        .filter((r) => !mergedIds.includes(r.id))
        .map((r) => (r.id === mergePrimary ? { ...r, photos: [...union] } : r))
    )
    try {
      await callApi({ action: "merge_stls", primary_id: mergePrimary, merged_ids: mergedIds })
      clearSelection()
    } catch (e: any) {
      setRows(snapshot) // rollback
      alert(`Erro ao mesclar: ${e.message}`)
    } finally {
      setMerging(false)
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

  // valida/invalida em massa os selecionados
  const bulkSetReviewed = (value: boolean) => {
    const next = new Set(reviewed)
    for (const id of selected) {
      if (value) next.add(id)
      else next.delete(id)
    }
    persistReviewed(next)
    clearSelection()
  }

  // seleciona/limpa todos os filtrados (não só a página atual)
  const selectAllFiltered = () => {
    setSelected(new Set(filtered.map((r) => r.id)))
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
          ["reviewed", `✅ Revisados (${counts.total - counts.unreviewed})`],
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

      {/* Barra de ações em massa (sticky — acompanha o scroll) */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-30 mb-4 rounded-xl border border-primary/40 bg-background/95 backdrop-blur shadow-lg p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Combine className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{selected.size} selecionado(s)</span>

            <button
              onClick={() => bulkSetReviewed(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs border border-success/40 bg-success/10 text-success hover:bg-success/20"
            >
              <Check className="w-3 h-3" /> Validar selecionados
            </button>
            <button
              onClick={() => bulkSetReviewed(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs border border-border hover:bg-muted"
            >
              <X className="w-3 h-3" /> Remover validação
            </button>
            <button
              onClick={selectAllFiltered}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs border border-border hover:bg-muted"
            >
              <CheckSquare className="w-3 h-3" /> Selecionar todos ({filtered.length})
            </button>

            {selected.size >= 2 && (
              <span className="text-xs text-muted-foreground">· escolha o principal p/ mesclar:</span>
            )}
            <button
              onClick={clearSelection}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-muted"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          </div>

          {selected.size > 8 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Merge fica disponível com até 8 selecionados. Para validar em massa, use o botão acima.
            </p>
          )}

          {selected.size >= 2 && selected.size <= 8 && (
            <div className="mt-3 space-y-1.5 max-h-[40vh] overflow-y-auto">
              {[...selected].map((id) => {
                const r = rows.find((x) => x.id === id)
                if (!r) return null
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${
                      mergePrimary === id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="merge-primary"
                      checked={mergePrimary === id}
                      onChange={() => setMergePrimary(id)}
                      className="accent-primary"
                    />
                    <span className="font-medium truncate flex-1" title={r.file_name}>
                      {r.title || r.file_name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(r.photos || []).length} foto(s) · {r.telegram_group_name || "—"} · {formatDateTime(r.created_at)}
                    </span>
                    {mergePrimary === id && <span className="text-xs text-primary font-medium shrink-0">principal</span>}
                  </label>
                )
              })}
              <button
                onClick={doMerge}
                disabled={!mergePrimary || merging}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Combine className="w-4 h-4" />}
                Mesclar no principal
              </button>
            </div>
          )}
        </div>
      )}

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
                  dropTarget === row.id
                    ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                    : isReviewed
                      ? "border-success/40 bg-success/5"
                      : "border-border"
                } ${isReviewed && filter !== "reviewed" ? "opacity-70" : ""}`}
              >
                {/* Coluna: índice + nome + ações */}
                <div className="w-64 shrink-0">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => toggleSelected(row.id)}
                      className="text-muted-foreground hover:text-primary transition"
                      title="Selecionar para mesclar"
                    >
                      {selected.has(row.id)
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4" />}
                    </button>
                    <span className="text-xs text-muted-foreground tabular-nums">#{globalIdx}</span>
                    {isSuspicious && (
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    )}
                  </div>
                  <p className="text-sm font-medium break-words leading-tight" title={row.file_name}>
                    {row.title || row.file_name}
                  </p>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <p>{photos.length} foto(s)</p>
                    {row.telegram_group_name && (
                      <p className="truncate" title={row.telegram_group_name}>
                        📡 {row.telegram_group_name}
                      </p>
                    )}
                    <p title={row.created_at || ""}>🕒 {formatDateTime(row.created_at)}</p>
                    {/* proximidade em relação à foto segurada */}
                    {held && heldSource && held.stlId !== row.id && (
                      <p className="text-primary/80">
                        ⏱ {relTime(heldSource.created_at, row.created_at)} da origem
                      </p>
                    )}
                  </div>

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
                    {held && held.stlId !== row.id && (
                      <button
                        onClick={() => dropHeldOn(row.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-primary bg-primary/10 text-primary hover:bg-primary/20 animate-pulse"
                      >
                        <ArrowDownToLine className="w-3 h-3" /> Soltar aqui
                      </button>
                    )}
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
                <div className="flex-1 flex flex-wrap gap-3 min-h-[128px]">
                  {photos.length === 0 ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm self-center">
                      <ImageOff className="w-4 h-4" /> Sem fotos — arraste ou solte uma aqui
                    </div>
                  ) : (
                    photos.map((url) => {
                      const marked = marks?.has(url)
                      const isHeld = held?.stlId === row.id && held?.url === url
                      return (
                        <div
                          key={url}
                          draggable
                          onDragStart={() => onDragStart(row.id, url)}
                          onClick={() => marks && toggleMark(row.id, url)}
                          className={`relative w-32 h-32 rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing group ${
                            marked
                              ? "border-destructive ring-2 ring-destructive/50"
                              : isHeld
                                ? "border-primary ring-2 ring-primary/60 opacity-60"
                                : "border-transparent"
                          }`}
                          title={marks ? "Clique para des/marcar" : "Arraste para outro arquivo, ou use ✋ para segurar"}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                          {/* Segurar foto (move entre buscas/páginas) */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setHeld({ stlId: row.id, url }) }}
                            className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-primary"
                            title="Segurar foto p/ mover (busque o destino e clique 'Soltar aqui')"
                          >
                            <Hand className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSinglePhoto(row.id, url) }}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-destructive"
                            title="Excluir foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Bandeja flutuante: foto segurada aguardando destino */}
      {held && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] flex flex-col gap-2 px-4 py-3 rounded-2xl border border-primary bg-background/95 backdrop-blur shadow-2xl">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={held.url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" />
            <div className="text-sm min-w-0">
              <p className="font-medium flex items-center gap-1.5">
                <Hand className="w-4 h-4 text-primary" /> Foto segurada
              </p>
              <p className="text-xs text-muted-foreground">
                Clique numa sugestão abaixo, ou busque o destino e clique <span className="text-primary font-medium">“Soltar aqui”</span>
              </p>
            </div>
            <button
              onClick={() => setHeld(null)}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-sm shrink-0"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
          </div>

          {/* Sugestões por proximidade temporal */}
          {suggestions.length > 0 && (
            <div className="border-t border-border pt-2">
              <p className="text-[11px] text-muted-foreground mb-1.5">
                Sugestões (indexados em horário próximo):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => dropHeldOn(s.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/15 text-xs max-w-[260px]"
                    title={s.file_name}
                  >
                    <ArrowDownToLine className="w-3 h-3 text-primary shrink-0" />
                    <span className="truncate">{s.title || s.file_name}</span>
                    <span className="text-primary/70 tabular-nums shrink-0">
                      {relTime(heldSource?.created_at || null, s.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
