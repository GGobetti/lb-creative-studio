"use client"

import { useState, useEffect, useRef } from "react"
import { useAppStore } from "@/store/store"
import { getSupabaseBrowser, SupportTicket, TicketMessage } from "@/lib/supabase"
import { 
  X, 
  Send, 
  Loader2, 
  Paperclip, 
  MessageSquare, 
  Calendar, 
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FolderOpen
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/lib/translations"

interface TicketDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: SupportTicket | null
  onTicketUpdated: () => void
}

export function TicketDetailsModal({
  open,
  onOpenChange,
  ticket,
  onTicketUpdated
}: TicketDetailsModalProps) {
  const { profile } = useAppStore()
  const { t } = useTranslation()
  
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !ticket) return

    fetchMessages()

    const supabase = getSupabaseBrowser()
    const channel = supabase
      .channel(`ticket-messages-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        () => {
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [open, ticket])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchMessages = async () => {
    if (!ticket) return
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
        .eq("ticket_id", ticket.id)
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
      console.error("Erro ao carregar mensagens:", err)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticket || !replyText.trim() || sendingReply) return

    setSendingReply(true)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticket.id,
          sender_id: profile?.id,
          message: replyText.trim()
        })

      if (error) throw error

      setReplyText("")
      await fetchMessages()
      
      // Update ticket updated_at timestamp in support_tickets table
      await supabase
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ticket.id)
      
      onTicketUpdated()
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err)
      alert(t('tickets.toastReplyError', "Erro ao enviar resposta."))
    } finally {
      setSendingReply(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!ticket || updatingStatus) return
    const newStatus = ticket.status === "closed" ? "open" : "closed"
    
    setUpdatingStatus(true)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("support_tickets")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", ticket.id)

      if (error) throw error

      // Post a system message informing the action
      await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticket.id,
          sender_id: profile?.id,
          message: newStatus === "closed" 
            ? "[Status] Chamado encerrado pelo usuário." 
            : "[Status] Chamado reaberto pelo usuário."
        })

      await fetchMessages()
      onTicketUpdated()
      ticket.status = newStatus // update local reference
    } catch (err) {
      console.error("Erro ao atualizar status:", err)
      alert(t('tickets.toastStatusError', "Erro ao atualizar status."))
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (!open || !ticket) return null

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
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onOpenChange(false)}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl h-[85vh] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10"
        >
          {/* Header */}
          <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${getStatusColor(ticket.status)}`}>
                  {t(`tickets.status_${ticket.status}`, ticket.status)}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {getCategoryLabel(ticket.category)}
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-foreground">{ticket.title}</h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Grid: Info (Left) + Messages (Right) */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left: Ticket Description & Info */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border p-6 space-y-6 overflow-y-auto bg-muted/10 shrink-0">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Descrição Inicial</h3>
                <div className="p-4 rounded-2xl bg-card border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </div>
              </div>

              {ticket.attachment_url && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Anexo do Chamado</h3>
                  <a
                    href={ticket.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-3 rounded-xl border border-violet-500/25 bg-violet-500/5 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/40 text-xs font-bold transition-all"
                  >
                    <Paperclip size={14} />
                    <span className="truncate">Visualizar Arquivo Anexo</span>
                  </a>
                </div>
              )}

              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar size={14} />
                  <span>Aberto em: {new Date(ticket.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw size={14} className="animate-spin-slow" />
                  <span>Atualizado em: {new Date(ticket.updated_at).toLocaleString("pt-BR")}</span>
                </div>
              </div>

              {/* Status Action Button */}
              <div className="pt-4 border-t border-border">
                <button
                  onClick={handleToggleStatus}
                  disabled={updatingStatus}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm
                    ${ticket.status === "closed"
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                      : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                    }`}
                >
                  {updatingStatus ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : ticket.status === "closed" ? (
                    <>
                      <CheckCircle2 size={14} />
                      {t('tickets.reopenTicket', "Reabrir Chamado")}
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} />
                      {t('tickets.closeTicket', "Fechar Chamado")}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Message Stream */}
            <div className="flex-1 flex flex-col overflow-hidden bg-card">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingMessages ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 size={24} className="animate-spin text-primary mb-2" />
                    <span className="text-xs">Carregando histórico do chamado...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <MessageSquare size={32} className="stroke-1 mb-2 text-muted-foreground/50" />
                    <p className="text-xs">Inicie a discussão enviando uma mensagem no campo abaixo.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSystem = msg.message.startsWith("[Status]");
                    const isOwnMessage = msg.sender_id === profile?.id;
                    const isSupportReply = !isOwnMessage && !isSystem;

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <span className="px-3 py-1 rounded-full bg-muted border border-border text-[10px] text-muted-foreground font-mono">
                            {msg.message.replace("[Status]", "").trim()}
                          </span>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[75%] space-y-1 ${
                          isOwnMessage ? "ml-auto items-end" : "mr-auto items-start"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 px-1">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {isOwnMessage ? "Você" : isSupportReply ? "Suporte" : msg.sender_email}
                          </span>
                          <span className="text-[8px] text-muted-foreground/60">
                            {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
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

              {/* Message Input Form */}
              <div className="p-4 border-t border-border bg-muted/10">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={ticket.status === "closed" || sendingReply}
                    className="flex-1 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    placeholder={
                      ticket.status === "closed"
                        ? "Este chamado está fechado. Reabra para enviar mensagens."
                        : t('tickets.replyPlaceholder', "Digite sua resposta...")
                    }
                  />
                  <button
                    type="submit"
                    disabled={ticket.status === "closed" || !replyText.trim() || sendingReply}
                    className="px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md"
                  >
                    {sendingReply ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
