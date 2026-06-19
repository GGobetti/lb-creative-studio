"use client"

import { useState } from "react"
import { Loader2, AlertTriangle, RefreshCw, Download } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/lib/translations"

interface DownloadRecord {
  id: string
  downloaded_at: string
  user_email: string
  file_name: string
  chat_title: string
  title: string
}

interface TimePoint {
  key: string
  label: string
  count: number
}

interface ChannelStat {
  name: string
  count: number
}

interface AnalyticsTabProps {
  downloadHistory: DownloadRecord[]
  isLoading: boolean
  error: string | null
  onRefresh: () => void
  downloadsOverTime: TimePoint[]
  downloadsByChannel: ChannelStat[]
}

export function AnalyticsTab({
  downloadHistory,
  isLoading,
  error,
  onRefresh,
  downloadsOverTime,
  downloadsByChannel,
}: AnalyticsTabProps) {
  const { t } = useTranslation()
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; count: number; label: string } | null>(null)

  const uniqueUsers = new Set(downloadHistory.map((h) => h.user_email)).size
  const uniqueChannels = new Set(downloadHistory.map((h) => h.chat_title)).size
  const recentDownloads = downloadHistory.filter((h) => {
    const diffDays = (Date.now() - new Date(h.downloaded_at).getTime()) / (1000 * 60 * 60 * 24)
    return diffDays <= 7
  }).length

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-bold text-yellow-500 flex items-center gap-2">
              <AlertTriangle size={18} className="shrink-0" />
              Banco de Dados desatualizado ou Erro de Conexão
            </h4>
            <p className="text-xs text-muted-foreground max-w-2xl mt-1">
              Não foi possível carregar o histórico de downloads. A tabela{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-yellow-400 font-mono">telegram_downloads_history</code>{" "}
              pode não ter sido criada ainda.
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">Erro: {error}</p>
          </div>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-xs font-bold rounded-lg border border-yellow-500/25 transition-all whitespace-nowrap cursor-pointer shrink-0"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: t("admin.totalDownloads", "Total de Downloads"), value: downloadHistory.length, unit: "arquivos" },
          { title: t("admin.uniqueUsers", "Usuários Únicos"), value: uniqueUsers, unit: "usuários" },
          { title: t("admin.activeChannels", "Canais Ativos"), value: uniqueChannels, unit: "grupos" },
          { title: t("admin.downloadsPeriod", "Downloads no Período"), value: recentDownloads, unit: "últimos 7 dias" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -4, scale: 1.02 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all duration-300"
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
        {/* Downloads Over Time */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 relative">
          <h3 className="font-bold text-base text-foreground">
            {t("admin.downloadsOverTime", "Downloads ao Longo do Tempo (Últimos 7 dias)")}
          </h3>
          <div className="h-64 relative pt-4 pb-2 px-2">
            {(() => {
              const maxCount = Math.max(...downloadsOverTime.map((x) => x.count), 1)
              const svgPoints = downloadsOverTime.map((d, i) => ({
                x: (i / 6) * 440 + 30,
                y: 170 - (d.count / maxCount) * 130,
                label: d.label,
                count: d.count,
                key: d.key,
              }))

              return (
                <div className="w-full h-full relative">
                  <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <line x1="30" y1="40" x2="470" y2="40" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                    <line x1="30" y1="105" x2="470" y2="105" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                    <line x1="30" y1="170" x2="470" y2="170" stroke="var(--border)" strokeWidth="1.5" opacity="0.5" />
                    {svgPoints.length > 0 && (
                      <motion.path
                        d={`M ${svgPoints[0].x} 170 L ${svgPoints.map((p) => `${p.x} ${p.y}`).join(" L ")} L ${svgPoints[svgPoints.length - 1].x} 170 Z`}
                        fill="url(#areaGradient)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                      />
                    )}
                    {svgPoints.length > 0 && (
                      <motion.path
                        d={`M ${svgPoints.map((p) => `${p.x} ${p.y}`).join(" L ")}`}
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
                    {svgPoints.map((p) => (
                      <g key={p.key} className="group cursor-pointer" onMouseEnter={() => setHoveredPoint(p)} onMouseLeave={() => setHoveredPoint(null)}>
                        <circle cx={p.x} cy={p.y} r="4" className="fill-card stroke-indigo-500 transition-all duration-200" strokeWidth="3.5" />
                        <circle cx={p.x} cy={p.y} r="16" className="fill-transparent" />
                        <text x={p.x} y="192" textAnchor="middle" className="text-[10px] fill-muted-foreground font-mono font-bold">{p.label}</text>
                      </g>
                    ))}
                  </svg>
                  <AnimatePresence>
                    {hoveredPoint && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bg-slate-900 border border-slate-700 text-slate-100 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap z-20 flex flex-col items-center gap-0.5"
                        style={{ left: `${(hoveredPoint.x / 500) * 100}%`, top: `${(hoveredPoint.y / 200) * 100}%`, transform: "translate(-50%, -125%)" }}
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

        {/* Downloads By Channel */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-foreground">
            {t("admin.downloadsByChannel", "Downloads por Canal de Origem")}
          </h3>
          <div className="space-y-4 pt-2">
            {downloadsByChannel.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">Nenhum dado disponível</div>
            ) : (
              downloadsByChannel.map((ch, idx) => {
                const maxDownloads = Math.max(...downloadsByChannel.map((x) => x.count), 1)
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
            <h3 className="font-bold text-base text-foreground">
              {t("admin.historyTableTitle", "Histórico Detalhado de Utilização")}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("admin.historyTableSubtitle", "Lista completa de arquivos baixados por usuários.")}
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/25 transition-all cursor-pointer"
          >
            <RefreshCw size={14} />
            Atualizar Relatório
          </button>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
              {t("admin.loadingStats", "Carregando estatísticas...")}
            </div>
          ) : downloadHistory.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {t("admin.noRecords", "Nenhum registro de download encontrado no banco de dados.")}
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/10 text-muted-foreground font-semibold">
                  <th className="px-6 py-4">{t("admin.colUser", "Usuário")}</th>
                  <th className="px-6 py-4">{t("admin.colFile", "Arquivo")}</th>
                  <th className="px-6 py-4">{t("admin.colChannel", "Canal")}</th>
                  <th className="px-6 py-4">{t("admin.colDate", "Data do Download")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {downloadHistory.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{log.user_email}</td>
                    <td className="px-6 py-4 font-medium text-foreground/90 max-w-[250px] truncate" title={log.file_name}>
                      {log.file_name}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{log.chat_title}</td>
                    <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                      {new Date(log.downloaded_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </motion.div>
  )
}
