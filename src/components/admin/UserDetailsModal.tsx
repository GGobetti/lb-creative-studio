import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getSupabaseBrowser, Profile } from "@/lib/supabase"
import { X, User, Clock, CreditCard, Activity, Calendar, ShieldAlert, LifeBuoy, ArrowRight, ArrowLeft } from "lucide-react"

interface UserDetailsModalProps {
  user: Profile | null
  onClose: () => void
}

export function UserDetailsModal({ user, onClose }: UserDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "tickets">("overview")
  const [transactions, setTransactions] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchUserData()
    }
  }, [user])

  const fetchUserData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const supabase = getSupabaseBrowser()
      
      // Fetch transactions
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      
      setTransactions(txData || [])

      // Fetch tickets
      const { data: tData } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      
      setTickets(tData || [])
    } catch (err) {
      console.error("Failed to fetch user detailed data", err)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  // Fallback for avatar
  const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || user.email)}&background=random`

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-end bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 cursor-pointer"
        />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full max-w-2xl h-full bg-card border-l border-border shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-muted/10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 shadow-sm bg-muted flex items-center justify-center">
                <img src={avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground">
                  {user.full_name || "Usuário Sem Nome"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">{user.email}</span>
                  {user.role === "sysadmin" && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Sysadmin
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted/50 text-muted-foreground transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex px-6 border-b border-border bg-card">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-4 px-4 text-sm font-bold border-b-2 transition-colors ${
                activeTab === "overview" 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`py-4 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "transactions" 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Financeiro
              <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] leading-none">
                {transactions.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("tickets")}
              className={`py-4 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "tickets" 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Chamados
              <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] leading-none">
                {tickets.length}
              </span>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">
                Carregando dados...
              </div>
            ) : (
              <>
                {/* OVERVIEW TAB */}
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col gap-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                          <Activity size={14} />
                          Plano Atual
                        </span>
                        <span className="text-2xl font-black capitalize text-foreground">
                          {user.plan}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl border border-border bg-emerald-500/5 flex flex-col gap-1">
                        <span className="text-xs font-bold text-emerald-600/70 uppercase flex items-center gap-1.5">
                          <CreditCard size={14} />
                          Saldo de Créditos
                        </span>
                        <span className="text-2xl font-black text-emerald-500">
                          {user.credits.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Info */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="px-4 py-3 bg-muted/30 border-b border-border font-bold text-sm">
                        Informações Cadastrais
                      </div>
                      <div className="divide-y divide-border/60 text-sm">
                        <div className="flex items-center justify-between p-4">
                          <span className="text-muted-foreground">ID do Usuário</span>
                          <span className="font-mono text-xs">{user.id}</span>
                        </div>
                        <div className="flex items-center justify-between p-4">
                          <span className="text-muted-foreground">Data de Cadastro</span>
                          <span className="font-medium flex items-center gap-1.5">
                            <Calendar size={14} className="text-muted-foreground" />
                            {new Date(user.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-4">
                          <span className="text-muted-foreground">Última Atualização</span>
                          <span className="font-medium flex items-center gap-1.5">
                            <Clock size={14} className="text-muted-foreground" />
                            {new Date(user.updated_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TRANSACTIONS TAB */}
                {activeTab === "transactions" && (
                  <div className="space-y-4">
                    {transactions.length === 0 ? (
                      <div className="text-center p-8 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                        Nenhuma transação financeira registrada.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {transactions.map((tx) => {
                          const isCredit = tx.credits_added > 0;
                          return (
                            <div key={tx.id} className="p-4 rounded-xl border border-border bg-card flex items-start gap-4">
                              <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border ${
                                isCredit 
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                              }`}>
                                {isCredit ? <ArrowLeft size={16} className="rotate-45" /> : <ArrowRight size={16} className="-rotate-45" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                  <p className="text-sm font-bold text-foreground">
                                    {tx.description || "Transação sem descrição"}
                                  </p>
                                  <span className={`text-sm font-black whitespace-nowrap ml-4 ${isCredit ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {isCredit ? '+' : ''}{tx.credits_added}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(tx.created_at).toLocaleString("pt-BR")}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TICKETS TAB */}
                {activeTab === "tickets" && (
                  <div className="space-y-4">
                    {tickets.length === 0 ? (
                      <div className="text-center p-8 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                        Nenhum chamado aberto por este usuário.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tickets.map((ticket) => (
                          <div key={ticket.id} className="p-4 rounded-xl border border-border bg-card flex items-start gap-4">
                            <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center border bg-blue-500/10 text-blue-500 border-blue-500/20">
                              <LifeBuoy size={16} />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-sm font-bold text-foreground line-clamp-1">
                                  {ticket.title}
                                </p>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground ml-4">
                                  {ticket.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                                <span>Categoria: {ticket.category}</span>
                                <span>•</span>
                                <span>{new Date(ticket.created_at).toLocaleDateString("pt-BR")}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
