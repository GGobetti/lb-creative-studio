"use client"

import React, { useState, useEffect } from "react"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useAppStore } from "@/store/store"
import { Users, Search, Plus, Trash2, Edit, X, Phone, Mail, Send, Clock, UserCheck } from "lucide-react"
import { useTranslation } from "@/lib/translations"

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  telegram: string | null
  notes: string | null
  created_at: string
}

export default function CustomersPage() {
  const { profile } = useAppStore()
  const { t, language } = useTranslation()
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState("")
  const [clientLimit, setClientLimit] = useState<number | null>(null)

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    telegram: "",
    notes: ""
  })
  const [isSaving, setIsSaving] = useState(false)

  const fetchCustomers = async () => {
    if (!profile) return
    setLoading(true)
    setError("")
    try {
      const supabase = getSupabaseBrowser()
      const { data, error: fetchErr } = await supabase
        .from("customers")
        .select("*")
        .order("name", { ascending: true })

      if (fetchErr) throw fetchErr
      setCustomers((data as Customer[]) ?? [])

      // Fetch CRM limit
      const { data: limitData, error: limitErr } = await supabase
        .from("feature_costs")
        .select("*")
        .eq("feature_key", "crm_clients_limit")
        .single()
      
      if (!limitErr && limitData) {
        const userPlan = profile.plan || 'free'
        const limit = userPlan === 'max' ? limitData.cost_max : userPlan === 'pro' ? limitData.cost_pro : limitData.cost_free
        setClientLimit(limit)
      }
    } catch (err: any) {
      console.error("[Customers] Failed to fetch:", err)
      setError(t('customersPage.loadError', "Não foi possível carregar os clientes. Tente novamente."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [profile])

  const handleOpenNewModal = () => {
    if (clientLimit !== null && customers.length >= clientLimit) {
      alert(t('customersPage.limitReached', `Seu plano atual permite apenas ${clientLimit} clientes. Faça upgrade para adicionar mais.`))
      return
    }
    setEditingCustomer(null)
    setFormData({ name: "", email: "", phone: "", telegram: "", notes: "" })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      telegram: customer.telegram || "",
      notes: customer.notes || ""
    })
    setIsModalOpen(true)
  }

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !profile) return

    setIsSaving(true)
    try {
      const supabase = getSupabaseBrowser()
      const dataToSave = {
        user_id: profile.id,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        telegram: formData.telegram.trim() || null,
        notes: formData.notes.trim() || null
      }

      let query
      if (editingCustomer) {
        query = supabase
          .from("customers")
          .update(dataToSave)
          .eq("id", editingCustomer.id)
      } else {
        query = supabase
          .from("customers")
          .insert([dataToSave])
      }

      const { error: saveErr } = await query
      if (saveErr) throw saveErr

      setIsModalOpen(false)
      fetchCustomers()
    } catch (err: any) {
      console.error("[Customers] Save error:", err)
      alert(t('customersPage.saveError', "Erro ao salvar cliente."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm(t('customersPage.confirmDelete', "Tem certeza que deseja excluir este cliente? Todas as cotações vinculadas a ele ficarão órfãs."))) return
    try {
      const supabase = getSupabaseBrowser()
      const { error: delErr } = await supabase
        .from("customers")
        .delete()
        .eq("id", id)

      if (delErr) throw delErr
      setCustomers(prev => prev.filter(c => c.id !== id))
    } catch (err: any) {
      console.error("[Customers] Delete error:", err)
      alert(t('customersPage.deleteError', "Erro ao excluir cliente."))
    }
  }

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.telegram || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-2">
            {t('customersPage.title', "CRM de Clientes")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('customersPage.subtitle', "Cadastre seus clientes para associar a cotações e gerenciar contatos de vendas.")}
          </p>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-sm rounded-xl transition shadow-lg shadow-primary/10 hover:shadow-primary/20 shrink-0"
        >
          <Plus size={16} />
          {t('customersPage.newCustomer', "Novo Cliente")}
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('customersPage.searchPlaceholder', "Buscar cliente por nome, e-mail, celular...")}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted border border-border text-sm outline-none focus:ring-2 focus:ring-primary/40 transition"
        />
      </div>

      {/* Table Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <Clock size={32} className="opacity-30 animate-pulse text-primary" />
              <span className="text-sm">{t('customersPage.loading', "Carregando clientes...")}</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500">
            <span className="text-sm">{error}</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
            <Users size={40} className="opacity-20 mb-3 text-primary" />
            <p className="font-bold text-sm text-foreground">
              {searchQuery ? t('customersPage.noMatchFilters', "Nenhum cliente atende aos filtros.") : t('customersPage.noneRegistered', "Nenhum cliente cadastrado.")}
            </p>
            <p className="text-xs mt-1 max-w-xs text-muted-foreground">
              {t('customersPage.emptyStateHint', "Cadastre seu primeiro cliente para vinculá-lo a cotações de forma rápida.")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold">{t('customersPage.tableCustomer', "Cliente")}</th>
                  <th className="px-6 py-4 font-bold">{t('customersPage.tableContact', "Contato")}</th>
                  <th className="px-6 py-4 font-bold">{t('customersPage.tableNotes', "Notas")}</th>
                  <th className="px-6 py-4 font-bold text-right">{t('customersPage.tableActions', "Ações")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase">
                          {c.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{c.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {t('customersPage.registeredOn', "Cadastrado em")} {new Date(c.created_at).toLocaleDateString(locale)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <Phone size={12} className="text-muted-foreground" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <Mail size={12} className="text-muted-foreground" />
                          <span>{c.email}</span>
                        </div>
                      )}
                      {c.telegram && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <Send size={12} className="text-muted-foreground" />
                          <span>@{c.telegram.replace("@", "")}</span>
                        </div>
                      )}
                      {!c.phone && !c.email && !c.telegram && (
                        <span className="text-xs text-muted-foreground italic">{t('customersPage.noContacts', "Sem contatos")}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-muted-foreground line-clamp-2 max-w-xs">
                        {c.notes || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="p-2 text-muted-foreground hover:bg-muted rounded-xl hover:text-foreground transition-colors"
                          title={t('customersPage.edit', "Editar")}
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(c.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                          title={t('customersPage.delete', "Excluir")}
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

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0f0f24] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck size={18} className="text-primary" />
                {editingCustomer ? t('customersPage.editCustomer', "Editar Cliente") : t('customersPage.addCustomer', "Adicionar Cliente")}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-white/60">{t('customersPage.fullName', "Nome Completo")} *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                  placeholder={t('customersPage.customerNamePlaceholder', "Nome do Cliente")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-white/60">{t('customersPage.whatsapp', "WhatsApp / Celular")}</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                    placeholder={t('customersPage.phonePlaceholder', "Ex: (11) 99999-9999")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/60">{t('customersPage.telegramUsername', "Telegram (Username)")}</label>
                  <input
                    type="text"
                    value={formData.telegram}
                    onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                    placeholder={t('customersPage.telegramPlaceholder', "Ex: maker_username")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-white/60">{t('customersPage.email', "E-mail")}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                  placeholder={t('customersPage.emailPlaceholder', "Ex: cliente@email.com")}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-white/60">{t('customersPage.notesPreferences', "Notas / Preferências")}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 resize-none"
                  placeholder={t('customersPage.notesPlaceholder', "Ex: Prefere material PLA, cores escuras...")}
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-white/10"
                >
                  {t('customersPage.cancel', "Cancelar")}
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formData.name.trim()}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/95 text-xs text-primary-foreground font-bold disabled:opacity-50"
                >
                  {isSaving ? t('customersPage.saving', "Gravando...") : t('customersPage.save', "Gravar")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
