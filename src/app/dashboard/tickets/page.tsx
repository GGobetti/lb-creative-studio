"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useAppStore } from "@/store/store"
import { getSupabaseBrowser, SupportTicket } from "@/lib/supabase"
import { 
  LifeBuoy, 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  Paperclip, 
  Calendar, 
  MessageCircle, 
  ChevronRight,
  HelpCircle,
  FileQuestion,
  AlertCircle
} from "lucide-react"
import { useToast } from "@/components/ui/Toast"
import { useTranslation } from "@/lib/translations"
import { TicketDetailsModal } from "@/components/tickets/TicketDetailsModal"
import { motion, AnimatePresence } from "framer-motion"

export default function TicketsPage() {
  const { profile } = useAppStore()
  const { toast } = useToast()
  const { t } = useTranslation()

  // State
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  
  // New ticket form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newCategory, setNewCategory] = useState<'request_stl' | 'stl_adjustment' | 'other'>("request_stl")
  const [newDescription, setNewDescription] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Details Modal state
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)

  const fetchTickets = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false })

      if (error) throw error
      setTickets(data as SupportTicket[])
    } catch (err: any) {
      console.error("Erro ao buscar chamados:", err)
      toast(t('tickets.toastCreateError', "Erro ao buscar chamados"), "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!profile?.id) return

    fetchTickets()

    const supabase = getSupabaseBrowser()
    const channel = supabase
      .channel(`public:support_tickets:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchTickets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  // Keep selected ticket in sync if it changes
  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find(t => t.id === selectedTicket.id)
      if (updated && updated.status !== selectedTicket.status) {
        setSelectedTicket(updated)
      }
    }
  }, [tickets, selectedTicket])

  // Filters logic
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            ticket.description.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter
      const matchesCategory = categoryFilter === "all" || ticket.category === categoryFilter
      
      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [tickets, searchQuery, statusFilter, categoryFilter])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 15 * 1024 * 1024) {
        toast("O arquivo de anexo deve ter no máximo 15MB.", "error")
        return
      }
      setAttachment(file)
    }
  }

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !newTitle.trim() || !newDescription.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const supabase = getSupabaseBrowser()
      let attachmentUrl: string | null = null

      // If there's an attachment, upload to storage
      if (attachment) {
        const fileExt = attachment.name.split('.').pop()
        const filePath = `${profile.id}/ticket-${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from("ticket-attachments")
          .upload(filePath, attachment)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from("ticket-attachments")
          .getPublicUrl(filePath)

        attachmentUrl = publicUrl
      }

      // Create ticket
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: profile.id,
          title: newTitle.trim(),
          description: newDescription.trim(),
          category: newCategory,
          attachment_url: attachmentUrl,
          status: "open"
        })
        .select()
        .single()

      if (error) throw error

      // Create initial message thread with the ticket description
      await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: data.id,
          sender_id: profile.id,
          message: newDescription.trim()
        })

      toast(t('tickets.toastCreated', "Chamado aberto com sucesso!"), "success")
      
      // Reset form
      setNewTitle("")
      setNewDescription("")
      setNewCategory("request_stl")
      setAttachment(null)
      setShowCreateForm(false)
      
      // Refresh list
      await fetchTickets()
    } catch (err: any) {
      console.error("Erro ao criar chamado:", err)
      toast(t('tickets.toastCreateError', "Erro ao abrir chamado."), "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenTicketDetails = (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    setDetailsModalOpen(true)
  }

  const getCategoryLabel = (cat: string) => {
    return t(`tickets.category_${cat}`, cat)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
      case "in_progress": return "bg-blue-500/10 text-blue-400 border border-blue-500/20"
      case "resolved": return "bg-violet-500/10 text-violet-400 border border-violet-500/20"
      case "closed": return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
      default: return "bg-zinc-500/10 text-zinc-400"
    }
  }

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-300">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 rounded-3xl p-8 border border-indigo-500/20 shadow-xl">
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 text-xs font-semibold border border-violet-500/20">
              <LifeBuoy size={12} />
              {t('tickets.title', "Central de Suporte")}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {t('tickets.title', "Central de Suporte")}
            </h1>
            <p className="text-muted-foreground max-w-lg text-sm">
              {t('tickets.subtitle', "Abra chamados para solicitar modelos STL, solicitar ajustes em arquivos ou tirar dúvidas.")}
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(p => !p)}
            className="px-5 py-3 rounded-2xl bg-primary hover:bg-primary/95 text-primary-foreground font-black text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            {t('tickets.newTicket', "Novo Chamado")}
          </button>
        </div>
        <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form 
              onSubmit={handleCreateTicket}
              className="bg-card border border-border rounded-3xl p-6 space-y-6 shadow-md"
            >
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                <FileQuestion size={18} className="text-primary" />
                {t('tickets.createTitle', "Abrir Novo Chamado de Suporte")}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Subject / Title */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">
                    {t('tickets.subject', "Assunto / Título")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                    placeholder={t('tickets.subjectPlaceholder', "Ex: Solicitação de modelo do Homem de Ferro")}
                  />
                </div>

                {/* Category */}
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">
                    {t('tickets.category', "Categoria")} *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="request_stl">{t('tickets.category_request_stl', "Solicitar STL")}</option>
                    <option value="stl_adjustment">{t('tickets.category_stl_adjustment', "Solicitar Ajuste de STL")}</option>
                    <option value="other">{t('tickets.category_other', "Outros")}</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {t('tickets.desc', "Descrição detalhada")} *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                  placeholder={t('tickets.descPlaceholder', "Explique detalhadamente o que você precisa...")}
                />
              </div>

              {/* Attachment */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {t('tickets.attachment', "Anexo (Opcional)")}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-muted hover:bg-muted/80 border border-border text-muted-foreground hover:text-foreground text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Paperclip size={14} />
                    {attachment ? "Alterar Anexo" : "Selecionar Arquivo"}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.stl,.3mf,.zip"
                  />
                  {attachment && (
                    <span className="text-xs text-emerald-400 font-medium truncate max-w-xs">
                      {attachment.name} ({ (attachment.size / (1024 * 1024)).toFixed(2) } MB)
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 rounded-xl border border-border text-muted-foreground hover:bg-muted text-xs font-bold cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/95 disabled:opacity-50 text-primary-foreground text-xs font-black shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      {t('tickets.uploading', "Enviando chamado...")}
                    </>
                  ) : (
                    t('tickets.createBtn', "Enviar Chamado")
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por chamado..."
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filter controls */}
        <div className="flex gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-muted-foreground">
            <Filter size={14} />
            <span>Filtrar</span>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Todos os Status</option>
            <option value="open">Abertos</option>
            <option value="in_progress">Em Atendimento</option>
            <option value="resolved">Resolvidos</option>
            <option value="closed">Fechados</option>
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Todas Categorias</option>
            <option value="request_stl">Solicitar STL</option>
            <option value="stl_adjustment">Ajuste de STL</option>
            <option value="other">Outros</option>
          </select>
        </div>
      </div>

      {/* Tickets Grid/List */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center bg-card border border-border rounded-3xl">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
          <span className="text-sm text-muted-foreground">Carregando seus chamados...</span>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="p-16 text-center bg-card border border-border rounded-3xl space-y-4">
          <div className="w-16 h-16 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto border border-violet-500/20">
            <LifeBuoy size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-foreground">Nenhum chamado encontrado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Crie um novo chamado caso precise de suporte técnico ou queira solicitar novos modelos 3D STL.
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
          >
            {t('tickets.newTicket', "Novo Chamado")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => handleOpenTicketDetails(ticket)}
              className="group bg-card border border-border rounded-2xl p-5 hover:border-violet-500/30 transition-all flex flex-col justify-between gap-4 cursor-pointer shadow-sm relative overflow-hidden"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${getStatusColor(ticket.status)}`}>
                    {t(`tickets.status_${ticket.status}`, ticket.status)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {getCategoryLabel(ticket.category)}
                  </span>
                </div>
                <h3 className="font-bold text-foreground text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1">
                  {ticket.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {ticket.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/60 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  <span>Atualizado: {new Date(ticket.updated_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-1 text-primary font-bold group-hover:translate-x-0.5 transition-transform">
                  <span>Abrir Conversa</span>
                  <ChevronRight size={12} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      <TicketDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        ticket={selectedTicket}
        onTicketUpdated={fetchTickets}
      />
    </div>
  )
}
