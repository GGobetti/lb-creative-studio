"use client"

import React, { useState, useEffect } from "react"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useAppStore } from "@/store/store"
import { 
  FileText, 
  Printer, 
  Send, 
  Mail, 
  ChevronLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  FileCheck,
  AlertCircle
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Props {
  params: Promise<{ id: string }>
}

interface QuotationItem {
  name: string
  weight_g: number
  print_time_hours: number
  calculated_price: number
  quantity: number
}

interface Quotation {
  id: string
  title: string
  items: QuotationItem[]
  discount: number
  total_value: number
  status: 'draft' | 'sent' | 'approved' | 'rejected'
  notes: string | null
  created_at: string
  customer_id: string | null
  customers: {
    name: string
    email: string | null
    phone: string | null
    telegram: string | null
  } | null
}

export default function QuotationDetailPage({ params }: Props) {
  const { id } = React.use(params)
  const { profile } = useAppStore()
  const router = useRouter()
  
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const fetchQuotation = async () => {
    setLoading(true)
    setError("")
    try {
      const supabase = getSupabaseBrowser()
      const { data, error: fetchErr } = await supabase
        .from("quotations")
        .select("*, customers(name, email, phone, telegram)")
        .eq("id", id)
        .single()

      if (fetchErr) throw fetchErr
      setQuotation(data as Quotation)
    } catch (err: any) {
      console.error("[QuotationDetail] Fetch error:", err)
      setError("Não foi possível carregar os detalhes da cotação.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotation()
  }, [id])

  const handleUpdateStatus = async (newStatus: Quotation['status']) => {
    if (!quotation) return
    setIsUpdatingStatus(true)
    try {
      const supabase = getSupabaseBrowser()
      const { error: updateErr } = await supabase
        .from("quotations")
        .update({ status: newStatus })
        .eq("id", quotation.id)

      if (updateErr) throw updateErr
      setQuotation(prev => prev ? { ...prev, status: newStatus } : null)
    } catch (err) {
      console.error("[QuotationStatus] Error:", err)
      alert("Erro ao atualizar status.")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const handlePrint = () => {
    window.print()
  }

  // Envio WhatsApp
  const handleShareWhatsApp = () => {
    if (!quotation) return
    
    const clientName = quotation.customers?.name || "Cliente"
    const phone = quotation.customers?.phone?.replace(/\D/g, "") || ""
    const appUrl = window.location.origin
    
    const itemNames = quotation.items.map(i => `${i.name} (${i.weight_g}g)`).join(", ")
    
    const message = `Olá, ${clientName}! Segue o orçamento da sua peça 3D:\n\n` +
      `*Proposta:* ${quotation.title}\n` +
      `*Item(ns):* ${itemNames}\n` +
      `*Total:* ${formatBRL(quotation.total_value)}\n` +
      (quotation.notes ? `*Observações:* ${quotation.notes}\n` : "") +
      `*Visualizar proposta completa:* ${appUrl}/dashboard/quotations/${quotation.id}\n\n` +
      `Fico à disposição!`;

    const encoded = encodeURIComponent(message)
    const url = phone ? `https://wa.me/55${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`
    window.open(url, "_blank")
  }

  // Envio Telegram
  const handleShareTelegram = () => {
    if (!quotation) return
    const appUrl = window.location.origin
    const text = `Seguem os detalhes do orçamento *${quotation.title}* no valor de ${formatBRL(quotation.total_value)}: ${appUrl}/dashboard/quotations/${quotation.id}`
    const encoded = encodeURIComponent(text)
    const phone = quotation.customers?.phone?.replace(/\D/g, "") || ""
    const telegram = (quotation.customers as any)?.telegram || ""
    if (telegram) {
      const tgUser = telegram.replace(/^@/, "")
      window.open(`https://t.me/${tgUser}?text=${encoded}`, "_blank")
    } else if (phone) {
      window.open(`https://t.me/+55${phone}?text=${encoded}`, "_blank")
    } else {
      window.open(`https://t.me/share/url?url=${appUrl}/dashboard/quotations/${quotation.id}&text=${encoded}`, "_blank")
    }
  }

  // Envio E-mail
  const handleShareEmail = () => {
    if (!quotation) return
    const clientName = quotation.customers?.name || "Cliente"
    const email = quotation.customers?.email || ""
    const subject = encodeURIComponent(`Orçamento LB Creative Studio — ${quotation.title}`)
    const appUrl = window.location.origin
    
    const body = encodeURIComponent(
      `Olá, ${clientName}!\n\n` +
      `Espero que esteja bem.\n\n` +
      `Elaboramos o orçamento referente ao seu pedido de impressão 3D:\n` +
      `- Proposta: ${quotation.title}\n` +
      `- Valor Total: ${formatBRL(quotation.total_value)}\n\n` +
      `Você pode conferir todos os detalhes e breakdown de custos acessando o link:\n` +
      `${appUrl}/dashboard/quotations/${quotation.id}\n\n` +
      `Qualquer dúvida, estamos à disposição.\n\n` +
      `Atenciosamente,\n` +
      `${profile?.email || "Maker"}`
    )
    
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank")
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-muted-foreground">
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin mb-3" />
        <span className="text-sm">Carregando detalhes...</span>
      </div>
    )
  }

  if (error || !quotation) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-red-500 space-y-4">
        <AlertCircle size={40} />
        <p className="text-sm">{error || "Cotação não encontrada."}</p>
        <Link href="/dashboard/quotations" className="text-xs text-primary hover:underline font-bold">
          Voltar para Cotações
        </Link>
      </div>
    )
  }

  const subtotal = quotation.items.reduce((s, i) => s + Number(i.calculated_price || 0) * (i.quantity || 1), 0)

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 print:space-y-0 print:pb-0">
      
      {/* Top action header (Hidden in Print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 print:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/quotations"
            className="p-2 bg-muted hover:bg-muted/80 border border-border rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-foreground">Orçamento Detalhado</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cotação emitida em {new Date(quotation.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Action button bar */}
        <div className="flex flex-wrap gap-2">
          {/* Status buttons */}
          <div className="flex border border-border bg-muted/30 p-1 rounded-xl shrink-0">
            <button
              onClick={() => handleUpdateStatus('draft')}
              disabled={isUpdatingStatus}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                quotation.status === 'draft' ? "bg-white/5 border border-white/10 text-white/80" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rascunho
            </button>
            <button
              onClick={() => handleUpdateStatus('sent')}
              disabled={isUpdatingStatus}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                quotation.status === 'sent' ? "bg-blue-500/15 text-blue-500 font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Enviada
            </button>
            <button
              onClick={() => handleUpdateStatus('approved')}
              disabled={isUpdatingStatus}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                quotation.status === 'approved' ? "bg-emerald-500/15 text-emerald-500 font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Aprovada
            </button>
            <button
              onClick={() => handleUpdateStatus('rejected')}
              disabled={isUpdatingStatus}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                quotation.status === 'rejected' ? "bg-red-500/15 text-red-500 font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Recusada
            </button>
          </div>

          {/* Export / Share buttons */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-xs font-bold transition"
          >
            <Printer size={14} />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Main Grid: left invoice, right sharing (Hidden on Print) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Invoice Page Sheet (Full width on print) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm print:border-0 print:p-0 print:shadow-none print:w-full print:bg-white print:text-black">
          
          {/* Header invoice */}
          <div className="flex justify-between items-start border-b border-border/60 pb-6 print:border-black/20">
            <div>
              {/* Studio Logo */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center print:bg-black print:text-white">
                  <span className="text-primary-foreground font-black text-sm print:text-white">LB</span>
                </div>
                <span className="font-bold text-foreground text-sm tracking-tight print:text-black">
                  Creative <span className="text-primary print:text-black">Studio</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground print:text-black/60">
                Orçamento de Serviços FDM / Impressão 3D
              </p>
            </div>
            
            <div className="text-right">
              <h2 className="text-lg font-black text-foreground print:text-black uppercase">Fatura Orçamento</h2>
              <p className="text-xs text-muted-foreground print:text-black/60 mt-1">Nº {quotation.id.substring(0,8).toUpperCase()}</p>
              <p className="text-xs text-muted-foreground print:text-black/60 mt-0.5">Emissão: {new Date(quotation.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>

          {/* Customer / Maker Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm pb-6 border-b border-border/60 print:border-black/20 print:text-black">
            <div>
              <h4 className="font-bold text-muted-foreground print:text-black/60 text-xs uppercase mb-2">Prestador (Maker)</h4>
              <p className="font-bold text-foreground print:text-black">{profile?.email.split('@')[0].toUpperCase() || "MAKER"}</p>
              <p className="text-xs text-muted-foreground print:text-black/60 mt-1">{profile?.email}</p>
            </div>
            {quotation.customers ? (
              <div className="sm:text-right">
                <h4 className="font-bold text-muted-foreground print:text-black/60 text-xs uppercase mb-2">Destinatário (Cliente)</h4>
                <p className="font-bold text-foreground print:text-black">{quotation.customers.name}</p>
                {quotation.customers.phone && <p className="text-xs text-muted-foreground print:text-black/60 mt-1">{quotation.customers.phone}</p>}
                {quotation.customers.email && <p className="text-xs text-muted-foreground print:text-black/60 mt-0.5">{quotation.customers.email}</p>}
              </div>
            ) : (
              <div className="sm:text-right text-muted-foreground italic text-xs">
                Nenhum cliente associado a esta proposta.
              </div>
            )}
          </div>

          {/* Breakdown Items Table */}
          <div className="space-y-3 print:text-black">
            <h4 className="font-bold text-muted-foreground print:text-black/60 text-xs uppercase">Breakdown de Itens da Cotação</h4>
            <div className="border border-border/60 rounded-xl overflow-hidden print:border-black/20">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] text-muted-foreground uppercase bg-muted/30 border-b border-border/60 print:border-black/20 print:text-black/60">
                  <tr>
                    <th className="px-4 py-3 font-bold">Descrição da Peça</th>
                    <th className="px-4 py-3 font-bold text-center">Peso</th>
                    <th className="px-4 py-3 font-bold text-center">Tempo</th>
                    <th className="px-4 py-3 font-bold text-right">Preço Unitário</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item, index) => (
                    <tr key={index} className="border-b border-border/40 last:border-0 print:border-black/10">
                      <td className="px-4 py-3.5 font-bold text-foreground print:text-black">
                        {item.name}
                      </td>
                      <td className="px-4 py-3.5 text-center text-muted-foreground print:text-black/80 tabular-nums">
                        {item.weight_g}g
                      </td>
                      <td className="px-4 py-3.5 text-center text-muted-foreground print:text-black/80 tabular-nums">
                        {Math.floor(item.print_time_hours)}h {Math.round((item.print_time_hours % 1) * 60)}m
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-foreground print:text-black tabular-nums">
                        {formatBRL(item.calculated_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes and Total Section */}
          <div className="flex flex-col sm:flex-row gap-6 justify-between pt-4 border-t border-border/60 print:border-black/20 print:text-black">
            {/* Notes */}
            <div className="flex-1 space-y-1.5 max-w-sm">
              <h5 className="text-xs font-bold text-muted-foreground print:text-black/60 uppercase">Notas & Observações</h5>
              <p className="text-xs text-muted-foreground print:text-black/80 leading-relaxed">
                {quotation.notes || "Nenhuma nota inserida. Cotação sujeita a reavaliação física e técnica baseada na complexidade de fatiamento do arquivo."}
              </p>
            </div>

            {/* Calculations Summary */}
            <div className="w-full sm:w-60 text-xs space-y-2.5 bg-muted/10 border border-border/60 p-4 rounded-xl print:border-black/20 print:p-0 print:bg-transparent print:w-48 shrink-0">
              <div className="flex justify-between items-center text-muted-foreground print:text-black/80">
                <span>Subtotal</span>
                <span className="font-semibold text-foreground print:text-black tabular-nums">{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-red-400 print:text-black/80">
                <span>Desconto</span>
                <span className="font-semibold tabular-nums">-{formatBRL(quotation.discount)}</span>
              </div>
              
              <div className="pt-2.5 mt-1 border-t border-border flex justify-between items-center text-sm font-black text-foreground print:text-black print:border-black/20">
                <span>Valor Final</span>
                <span className="text-base text-primary print:text-black tabular-nums">{formatBRL(quotation.total_value)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Channels / Sharing Sidebar (Hidden on Print) */}
        <div className="bg-card border border-border rounded-2xl p-6 h-fit space-y-5 shadow-sm print:hidden">
          <div className="border-b border-border pb-3">
            <h3 className="font-bold text-sm text-foreground">Enviar Proposta Comercial</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Selecione o canal para compartilhar este link.</p>
          </div>

          {/* Social actions */}
          <div className="space-y-2">
            <button
              onClick={handleShareWhatsApp}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-500 hover:text-emerald-400 font-bold text-sm text-left transition-colors"
            >
              <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                <MessageSquare size={16} />
              </div>
              <div>
                <p className="leading-tight">WhatsApp Link</p>
                <p className="text-[10px] opacity-70 mt-0.5 font-normal">Mensagem de texto pré-pronta</p>
              </div>
            </button>

            <button
              onClick={handleShareTelegram}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-500 hover:text-blue-400 font-bold text-sm text-left transition-colors"
            >
              <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                <Send size={16} />
              </div>
              <div>
                <p className="leading-tight">Telegram Group / Chat</p>
                <p className="text-[10px] opacity-70 mt-0.5 font-normal">Enviar link da cotação no Telegram</p>
              </div>
            </button>

            <button
              onClick={handleShareEmail}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary hover:text-primary/90 font-bold text-sm text-left transition-colors"
            >
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <Mail size={16} />
              </div>
              <div>
                <p className="leading-tight">Enviar via E-mail</p>
                <p className="text-[10px] opacity-70 mt-0.5 font-normal">mailto link com corpo do e-mail</p>
              </div>
            </button>
          </div>

          {/* Status summary info */}
          <div className="bg-muted/20 border border-border/80 p-4 rounded-xl text-xs space-y-2 text-muted-foreground">
            <div className="flex justify-between">
              <span>Status Atual:</span>
              <span className="font-bold uppercase text-foreground">{quotation.status}</span>
            </div>
            <div className="flex justify-between">
              <span>Última Alteração:</span>
              <span>{new Date(quotation.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
