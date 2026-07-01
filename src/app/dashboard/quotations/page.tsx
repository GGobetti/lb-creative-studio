"use client"

import React, { useState, useEffect } from "react"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useAppStore } from "@/store/store"
import { FileText, Search, Plus, Trash2, Eye, Clock, FileCheck, CheckCircle2, AlertCircle, XCircle } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "@/lib/translations"

interface Quotation {
  id: string
  title: string
  total_value: number
  status: 'draft' | 'sent' | 'approved' | 'rejected'
  created_at: string
  customers: {
    name: string
    phone: string | null
  } | null
}

function StatusBadge({ status }: { status: Quotation['status'] }) {
  const { t } = useTranslation()
  switch (status) {
    case 'draft':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-white/60">
          <Clock size={11} />
          {t('quotationsPage.statusDraft', "Rascunho")}
        </span>
      )
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-500">
          <AlertCircle size={11} />
          {t('quotationsPage.statusSent', "Enviada")}
        </span>
      )
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
          <CheckCircle2 size={11} />
          {t('quotationsPage.statusApproved', "Aprovada")}
        </span>
      )
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-500">
          <XCircle size={11} />
          {t('quotationsPage.statusRejected', "Recusada")}
        </span>
      )
  }
}

export default function QuotationsPage() {
  const { profile } = useAppStore()
  const { t, language } = useTranslation()
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [error, setError] = useState("")

  const fetchQuotations = async () => {
    if (!profile) return
    setLoading(true)
    setError("")
    try {
      const supabase = getSupabaseBrowser()
      const { data, error: fetchErr } = await supabase
        .from("quotations")
        .select("id, title, total_value, status, created_at, customers(name, phone)")
        .order("created_at", { ascending: false })

      if (fetchErr) throw fetchErr
      setQuotations((data as any[]) ?? [])
    } catch (err: any) {
      console.error("[Quotations] Failed to fetch:", err)
      setError(t('quotationsPage.loadError', "Não foi possível carregar as cotações. Tente novamente."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotations()
  }, [profile])

  const handleDeleteQuotation = async (id: string) => {
    if (!confirm(t('quotationsPage.confirmDelete', "Tem certeza que deseja excluir esta cotação?"))) return
    try {
      const supabase = getSupabaseBrowser()
      const { error: delErr } = await supabase
        .from("quotations")
        .delete()
        .eq("id", id)

      if (delErr) throw delErr
      setQuotations(prev => prev.filter(q => q.id !== id))
    } catch (err: any) {
      console.error("[Quotations] Delete error:", err)
      alert(t('quotationsPage.deleteError', "Erro ao excluir cotação."))
    }
  }

  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const filteredQuotations = quotations.filter(q => {
    // 1. Status Filter
    if (statusFilter !== "all" && q.status !== statusFilter) return false
    
    // 2. Search Query
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      q.title.toLowerCase().includes(query) ||
      (q.customers?.name || "").toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-2">
            {t('quotationsPage.title', "Cotações & Propostas")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('quotationsPage.subtitle', "Gerencie propostas comerciais, exporte em PDF e compartilhe com seus clientes.")}
          </p>
        </div>

        <Link
          href="/dashboard/calculator"
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-sm rounded-xl transition shadow-lg shadow-primary/10 hover:shadow-primary/20 shrink-0 text-center"
        >
          <Plus size={16} />
          {t('quotationsPage.newQuotation', "Nova Cotação (Calculadora)")}
        </Link>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('quotationsPage.searchPlaceholder', "Buscar cotação por título ou cliente...")}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted border border-border text-sm outline-none focus:ring-2 focus:ring-primary/40 transition"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto shrink-0 overflow-x-auto">
          {["all", "draft", "sent", "approved", "rejected"].map((status) => {
            const label =
              status === "all" ? t('quotationsPage.filterAll', "Todas") :
              status === "draft" ? t('quotationsPage.filterDraft', "Rascunho") :
              status === "sent" ? t('quotationsPage.filterSent', "Enviadas") :
              status === "approved" ? t('quotationsPage.filterApproved', "Aprovadas") : t('quotationsPage.filterRejected', "Recusadas")
            
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  statusFilter === status
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table/List card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <Clock size={32} className="opacity-30 animate-pulse text-primary" />
              <span className="text-sm">{t('quotationsPage.loading', "Carregando cotações...")}</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500">
            <span className="text-sm">{error}</span>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
            <FileText size={40} className="opacity-20 mb-3 text-primary" />
            <p className="font-bold text-sm text-foreground">
              {searchQuery || statusFilter !== "all" ? t('quotationsPage.noMatchFilters', "Nenhuma cotação atende aos filtros.") : t('quotationsPage.noneRegistered', "Nenhuma cotação cadastrada.")}
            </p>
            <p className="text-xs mt-1 max-w-xs text-muted-foreground">
              {t('quotationsPage.emptyStateHint', "Abra a Calculadora para precificar uma peça e gerar sua primeira cotação formal para clientes.")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold">{t('quotationsPage.tableQuotation', "Cotação")}</th>
                  <th className="px-6 py-4 font-bold">{t('quotationsPage.tableCustomer', "Cliente")}</th>
                  <th className="px-6 py-4 font-bold">{t('quotationsPage.tableDate', "Data")}</th>
                  <th className="px-6 py-4 font-bold">{t('quotationsPage.tableValue', "Valor")}</th>
                  <th className="px-6 py-4 font-bold">{t('quotationsPage.tableStatus', "Status")}</th>
                  <th className="px-6 py-4 font-bold text-right">{t('quotationsPage.tableActions', "Ações")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#7c3aed]/10 flex items-center justify-center text-[#7c3aed]">
                          <FileText size={18} />
                        </div>
                        <div>
                          <Link href={`/dashboard/quotations/${q.id}`} className="font-bold text-foreground hover:text-primary transition-colors">
                            {q.title}
                          </Link>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            ID: {q.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {q.customers ? (
                        <div>
                          <div className="font-semibold text-foreground">{q.customers.name}</div>
                          {q.customers.phone && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">{q.customers.phone}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">{t('quotationsPage.noCustomer', "Sem cliente")}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {new Date(q.created_at).toLocaleDateString(locale)}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground tabular-nums">
                      {formatBRL(q.total_value)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Link
                          href={`/dashboard/quotations/${q.id}`}
                          className="p-2 text-muted-foreground hover:bg-muted rounded-xl hover:text-foreground transition-colors flex items-center justify-center"
                          title={t('quotationsPage.viewQuotation', "Visualizar Cotação")}
                        >
                          <Eye size={15} />
                        </Link>
                        <button
                          onClick={() => handleDeleteQuotation(q.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                          title={t('quotationsPage.deleteQuotation', "Excluir Cotação")}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredQuotations.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {t('quotationsPage.showingCount', `Exibindo ${filteredQuotations.length} de ${quotations.length} cotações`)}
        </p>
      )}
    </div>
  )
}
