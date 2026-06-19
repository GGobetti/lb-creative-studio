"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useConfiguratorStore } from "@/store/store"
import { getSupabaseBrowser, SupportTicket, TicketMessage } from "@/lib/supabase"
import { 
  LifeBuoy, 
  Search, 
  Filter, 
  Loader2, 
  Paperclip, 
  Send, 
  Calendar, 
  MessageSquare,
  AlertCircle,
  Check,
  User,
  Clock,
  ExternalLink
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/lib/translations"

export function TicketsTab() {
  const { profile } = useConfiguratorStore()
  const { t } = useTranslation()

  // State
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  
  // Selected ticket chat state
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          *,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .order("updated_at", { ascending: false })

      if (error) throw error
      
      const mapped = (data || []).map((t: any) => ({
        ...t,
        user_email: t.profiles?.email || "usuario@lb.com",
        user_name: t.profiles?.full_name || "Membro LB"
      }))

      setTickets(mapped)
      
      // Keep selected ticket in sync if open
      if (selectedTicket) {
        const updatedSelected = mapped.find((tk: any) => tk.id === selectedTicket.id)
        if (updatedSelected) {
          setSelectedTicket(updatedSelected)
        }
      }
    } catch (err) {
      console.error("Erro ao buscar chamados (admin):", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()

    const supabase = getSupabaseBrowser()
    const channel = supabase
      .channel('admin-support-tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        () => {
          fetchTickets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Keep selected ticket in sync if it changes
  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find(t => t.id === selectedTicket.id)
      if (updated && updated.status !== selectedTicket.status) {
        setSelectedTicket(updated)
      }
    }
  }, [tickets, selectedTicket])

  useEffect(() => {
    if (!selectedTicket) return

    fetchMessages(selectedTicket.id)

    const supabase = getSupabaseBrowser()
    const channel = supabase
      .channel(`admin-ticket-messages-${selectedTicket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        () => {
          fetchMessages(selectedTicket.id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedTicket?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true)
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from("ticket_messages")
        .select(`
          id,
          ticket_id,
          sender_id,
          message,
          created_at,
          profiles:sender_id (
            email,
            role
          )
        `)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true })

      if (error) throw error

      const mapped = (data || []).map((m: any) => ({
        id: m.id,
        ticket_id: m.ticket_id,
        sender_id: m.sender_id,
        message: m.message,
        created_at: m.created_at,
        sender_email: m.profiles?.email || "usuario@lb.com",
        sender_role: m.profiles?.role || "user"
      }))

      setMessages(mapped)
    } catch (err) {
      console.error("Erro ao buscar mensagens do ticket:", err)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicket || !replyText.trim() || sendingReply) return

    setSendingReply(true)
    try {
      const supabase = getSupabaseBrowser()
      
      // Auto-transition to 'in_progress' if currently 'open'
      let updatedStatus = selectedTicket.status
      if (selectedTicket.status === "open") {
        updatedStatus = "in_progress"
        await supabase
          .from("support_tickets")
          .update({ 
            status: "in_progress",
            updated_at: new Date().toISOString()
          })
          .eq("id", selectedTicket.id)
      } else {
        await supabase
          .from("support_tickets")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", selectedTicket.id)
      }

      // Add message
      const { error: msgError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: profile?.id,
          message: replyText.trim()
        })

      if (msgError) throw msgError

      setReplyText("")
      await fetchMessages(selectedTicket.id)
      await fetchTickets()
    } catch (err) {
      console.error("Erro ao enviar resposta do admin:", err)
      alert("Erro ao enviar resposta.")
    } finally {
      setSendingReply(false)
    }
  }

  const handleUpdateStatus = async (status: 'open' | 'in_progress' | 'resolved' | 'closed') => {
    if (!selectedTicket || updatingStatus) return

    setUpdatingStatus(status)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("support_tickets")
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedTicket.id)

      if (error) throw error

      // Post status update system message
      const statusLabels = {
        open: "Aberto",
        in_progress: "Em Atendimento",
        resolved: "Resolvido",
        closed: "Fechado"
      }
      
      await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: profile?.id,
          message: `[Status] Chamado alterado para '${statusLabels[status]}' por ${profile?.email}.`
        })

      await fetchMessages(selectedTicket.id)
      await fetchTickets()
    } catch (err) {
      console.error("Erro ao atualizar status:", err)
      alert("Erro ao atualizar status do chamado.")
    } finally {
      setUpdatingStatus(null)
    }
  }

  // Filter logic
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (t.user_email && t.user_email.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesStatus = statusFilter === "all" || t.status === statusFilter
      const matchesCategory = categoryFilter === "all" || t.category === categoryFilter
      
      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [tickets, searchQuery, statusFilter, categoryFilter])

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
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden h-[70vh] flex flex-col md:flex-row">
      {/* Left Pane: Ticket List */}
      <div className="w-full md:w-96 border-b md:border-b-0 md:border-r border-border flex flex-col bg-muted/10">
        {/* Pane Header / Filters */}
        <div className="p-4 border-b border-border bg-card space-y-3 shrink-0">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <LifeBuoy size={16} className="text-primary" />
            Central de Atendimento
          </h3>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por e-mail ou assunto..."
              className="w-full pl-9 pr-3 py-1.5 bg-muted border border-border rounded-lg text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Double Select Filters */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-muted border border-border rounded-lg px-2 py-1 text-[10px] text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos os Status</option>
              <option value="open">Abertos</option>
              <option value="in_progress">Em Atendimento</option>
              <option value="resolved">Resolvidos</option>
              <option value="closed">Fechados</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-muted border border-border rounded-lg px-2 py-1 text-[10px] text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todas Categorias</option>
              <option value="request_stl">Solicitar STL</option>
              <option value="stl_adjustment">Ajuste de STL</option>
              <option value="other">Outros</option>
            </select>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-primary" size={16} />
              <span>Carregando chamados...</span>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              Nenhum chamado pendente encontrado.
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const isSelected = selectedTicket?.id === ticket.id
              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`p-4 text-left cursor-pointer transition-all hover:bg-muted/40 space-y-2
                    ${isSelected ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${getStatusColor(ticket.status)}`}>
                      {t(`tickets.status_${ticket.status}`, ticket.status)}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {new Date(ticket.updated_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-foreground truncate">{ticket.title}</h4>
                    <p className="text-[10px] text-muted-foreground truncate font-medium">{ticket.user_email}</p>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span>{getCategoryLabel(ticket.category)}</span>
                    <span className="capitalize text-[8px] px-1.5 py-0.5 rounded bg-muted">
                      {ticket.category.replace("_", " ")}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right Pane: Selected ticket messages & resolution */}
      <div className="flex-1 flex flex-col bg-card overflow-hidden">
        {selectedTicket ? (
          <>
            {/* Active Ticket Header */}
            <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm text-foreground">{selectedTicket.title}</h3>
                  <span className="text-[10px] text-muted-foreground font-mono">({selectedTicket.user_email})</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span className="font-medium">Categoria: {getCategoryLabel(selectedTicket.category)}</span>
                  <span>|</span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    Criado: {new Date(selectedTicket.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>

              {/* Status control */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Status:</span>
                <select
                  value={selectedTicket.status}
                  onChange={(e: any) => handleUpdateStatus(e.target.value)}
                  disabled={updatingStatus !== null}
                  className="bg-muted border border-border rounded-lg px-2.5 py-1 text-[11px] font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="open">Aberto</option>
                  <option value="in_progress">Em Atendimento</option>
                  <option value="resolved">Resolvido</option>
                  <option value="closed">Fechado</option>
                </select>
              </div>
            </div>

            {/* Split Details and Conversation */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5">
                  {/* First system details */}
                  <div className="p-4 rounded-xl bg-card border border-border text-xs text-foreground space-y-2">
                    <div className="font-bold flex items-center gap-1 text-primary">
                      <AlertCircle size={13} />
                      Mensagem de abertura do usuário:
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{selectedTicket.description}</p>
                    {selectedTicket.attachment_url && (
                      <div className="pt-2 border-t border-border/60">
                        <a
                          href={selectedTicket.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-violet-400 font-bold hover:underline"
                        >
                          <Paperclip size={11} />
                          Visualizar arquivo anexo do chamado
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>

                  {loadingMessages ? (
                    <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
                      <Loader2 className="animate-spin text-primary" size={14} />
                      <span>Carregando histórico...</span>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isSystem = msg.message.startsWith("[Status]");
                      const isOwnMessage = msg.sender_id === profile?.id;
                      const isSupportReply = !isOwnMessage && msg.sender_role === "sysadmin";

                      if (isSystem) {
                        return (
                          <div key={msg.id} className="flex justify-center my-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-muted border border-border text-[9px] text-muted-foreground font-mono">
                              {msg.message.replace("[Status]", "").trim()}
                            </span>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[80%] space-y-1 ${
                            isOwnMessage ? "ml-auto items-end" : "mr-auto items-start"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {isOwnMessage ? "Você" : isSupportReply ? "Suporte" : msg.sender_email}
                            </span>
                            <span className="text-[8px] text-muted-foreground/60">
                              {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div
                            className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                              isOwnMessage
                                ? "bg-primary text-primary-foreground rounded-tr-none shadow-sm"
                                : "bg-muted border border-border rounded-tl-none text-foreground"
                            }`}
                          >
                            {msg.message}
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Form */}
                <div className="p-3 border-t border-border bg-muted/10 shrink-0">
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      disabled={sendingReply}
                      className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Escrever resposta como administrador..."
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim() || sendingReply}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-sm"
                    >
                      {sendingReply ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <MessageSquare size={48} className="stroke-1 mb-2 text-muted-foreground/30 animate-pulse" />
            <h4 className="font-bold text-sm text-foreground">Nenhum Chamado Selecionado</h4>
            <p className="text-xs max-w-xs mt-1">
              Selecione um chamado na lista lateral para visualizar as mensagens e iniciar o atendimento.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
