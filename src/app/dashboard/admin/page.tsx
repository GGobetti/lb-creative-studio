"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useAppStore } from "@/store/store"
import { getSupabaseBrowser, Profile, CatalogItem, FeatureCost } from "@/lib/supabase"
import { 
  ShieldAlert, 
  Settings, 
  Users, 
  Package, 
  Save, 
  Check, 
  Loader2, 
  Lock, 
  Zap, 
  ArrowRight,
  UserCheck,
  Activity,
  RefreshCw,
  Download,
  AlertTriangle,
  LifeBuoy,
  ToggleRight,
  ShoppingCart,
  X
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/lib/translations"
import { TicketsTab } from "@/components/admin/TicketsTab"
import { UserDetailsModal } from "@/components/admin/UserDetailsModal"
import { FlagsTab } from "@/components/admin/FlagsTab"
import { AnalyticsTab } from "@/components/admin/AnalyticsTab"
import { XpConfigPanel } from "@/components/admin/XpConfigPanel"
import { AffiliateProductsTab } from "@/components/admin/AffiliateProductsTab"
// import { GameAdminShortcuts } from "@/components/admin/GameAdminShortcuts"

export default function AdminPage() {
  const { profile } = useAppStore()
  const { t, language } = useTranslation()
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
  const [activeTab, setActiveTab] = useState<"features" | "models" | "users" | "analytics" | "tickets" | "flags" | "xp" | "affiliate">("features")
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null)
  
  // Data State
  const [features, setFeatures] = useState<FeatureCost[]>([])
  const [models, setModels] = useState<CatalogItem[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [selectedUserForModal, setSelectedUserForModal] = useState<Profile | null>(null)
  const [featureFlags, setFeatureFlagsData] = useState<any[]>([])
  const [errorMsg, setErrorMsg] = useState("")



  // Analytics State
  const [downloadHistory, setDownloadHistory] = useState<any[]>([])
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)




  const fetchAnalyticsData = async () => {
    setIsLoadingAnalytics(true)
    setAnalyticsError(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from('telegram_downloads_history')
        .select(`
          id,
          downloaded_at,
          profiles (
            email
          ),
          telegram_indexed_stls (
            file_name,
            telegram_group_name,
            title
          )
        `)
        .order('downloaded_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const mappedHistory = (data || []).map((h: any) => ({
        id: h.id,
        downloaded_at: h.downloaded_at,
        user_email: h.profiles?.email || "desconhecido@lb.com",
        file_name: h.telegram_indexed_stls?.file_name || t('admin.deletedFile', "Arquivo excluído"),
        chat_title: h.telegram_indexed_stls?.telegram_group_name || t('admin.unknownChannel', "Canal desconhecido"),
        title: h.telegram_indexed_stls?.title || t('admin.untitledModel', "Modelo Sem Título")
      }))
      setDownloadHistory(mappedHistory)
    } catch (err: any) {
      console.error("Erro ao carregar histórico de downloads:", {
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code,
        error: err
      })
      setAnalyticsError(err.message || err.details || JSON.stringify(err) || t('admin.dbQueryError', "Erro ao consultar banco de dados"))
    } finally {
      setIsLoadingAnalytics(false)
    }
  }

  // Fetch all admin data
  const fetchData = async () => {
    setLoading(true)
    setErrorMsg("")
    try {
      const supabase = getSupabaseBrowser()
      
      // 1. Fetch feature costs
      const { data: fcData, error: fcError } = await supabase
        .from("feature_costs")
        .select("*")
        .order("feature_key")
      
      if (fcError) throw fcError
      setFeatures(fcData as FeatureCost[])

      // 2. Fetch catalog items
      const { data: catData, error: catError } = await supabase
        .from("catalog_items")
        .select("*")
        .order("title")
      
      if (catError) throw catError
      setModels(catData as CatalogItem[])

      // 3. Fetch users profiles (limit 50 for testing)
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("email")
        .limit(50)
      
      if (profilesError) throw profilesError
      setUsers(profilesData as Profile[])

      // 4. Fetch analytics data
      await fetchAnalyticsData()

      // 5. Fetch feature flags
      const { data: ffData, error: ffError } = await supabase
        .from("feature_flags")
        .select("*")
        .order("display_name")
      
      if (ffError) throw ffError
      setFeatureFlagsData(ffData || [])

    } catch (err: any) {
      console.error("[Admin fetch error]:", err)
      setErrorMsg(err.message || t('admin.loadFailError', "Falha ao carregar dados do painel."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile && profile.role === "sysadmin") {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [profile?.id, profile?.role])

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAnalyticsData()
    }
  }, [activeTab])


  // Process downloads over time (last 7 days)
  const downloadsOverTimeData = useMemo(() => {
    const days: Array<{ label: string; key: string; count: number }> = []
    
    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
      const keyStr = d.toISOString().split('T')[0]
      days.push({ label: dateStr, key: keyStr, count: 0 })
    }

    // Accumulate counts
    downloadHistory.forEach(h => {
      if (!h || !h.downloaded_at) return
      const dateKey = h.downloaded_at.split('T')[0]
      const dayObj = days.find(d => d.key === dateKey)
      if (dayObj) {
        dayObj.count++
      }
    })

    return days
  }, [downloadHistory])

  // Process top downloads by channel
  const downloadsByChannelData = useMemo(() => {
    const counts: Record<string, number> = {}
    downloadHistory.forEach(h => {
      if (!h) return
      const channel = h.chat_title || t('admin.othersChannel', "Outros")
      counts[channel] = (counts[channel] || 0) + 1
    })

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [downloadHistory])

  // Restrict access
  if (!profile || profile.role !== "sysadmin") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 ring-4 ring-red-500/5">
          <Lock size={32} />
        </div>
        <h1 className="text-2xl font-black text-foreground tracking-tight">{t('admin.restrictedAccessTitle', "Acesso Restrito")}</h1>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          {t('admin.restrictedAccessDesc', "Esta área é exclusiva para administradores (sysadmin) do LB Creative Studio. Faça login com um perfil sysadmin.")}
        </p>
      </div>
    )
  }

  // Handle saving generic feature costs
  const handleSaveFeature = async (featureKey: string, costFree: number, costPro: number, costMax: number) => {
    setSavingId(featureKey)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("feature_costs")
        .update({
          cost_free: costFree,
          cost_pro: costPro,
          cost_max: costMax,
          updated_at: new Date().toISOString()
        })
        .eq("feature_key", featureKey)

      if (error) throw error
      
      setSaveSuccessId(featureKey)
      setTimeout(() => setSaveSuccessId(null), 2000)
    } catch (err: any) {
      alert(t('admin.saveFeatureError', "Erro ao salvar: ") + err.message)
    } finally {
      setSavingId(null)
    }
  }

  // Handle saving catalog item costs
  const handleSaveModelPrice = async (itemId: string, priceFree: number, pricePro: number, priceMax: number) => {
    setSavingId(itemId)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("catalog_items")
        .update({
          price_free: priceFree,
          price_pro: pricePro,
          price_max: priceMax,
          updated_at: new Date().toISOString()
        })
        .eq("id", itemId)

      if (error) throw error
      
      setSaveSuccessId(itemId)
      setTimeout(() => setSaveSuccessId(null), 2000)
    } catch (err: any) {
      console.error("Error saving model price:", err)
      alert(t('admin.saveModelPriceError', "Erro ao salvar preços: ") + err.message)
    } finally {
      setSavingId(null)
    }
  }

  // Handle saving profile modifications (plan & credits)
  const handleSaveUser = async (userId: string, plan: "free" | "pro" | "max", credits: number) => {
    setSavingId(userId)
    try {
      const supabase = getSupabaseBrowser()
      
      // Get previous credits to calculate difference
      const user = users.find(u => u.id === userId)
      const diff = user ? credits - user.credits : 0

      const { error } = await supabase
        .from("profiles")
        .update({
          plan,
          credits,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId)

      if (error) throw error

      if (diff !== 0) {
        await supabase.from("transactions").insert({
          user_id: userId,
          credits_added: diff,
          description: diff > 0 ? t('admin.creditsAddedBySysadmin', "Créditos adicionados manualmente pelo sysadmin") : t('admin.creditsRemovedBySysadmin', "Créditos removidos manualmente pelo sysadmin")
        })
      }

      // Refresh local user state list
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan, credits } : u))

      setSaveSuccessId(userId)
      setTimeout(() => setSaveSuccessId(null), 2000)
    } catch (err: any) {
      alert(t('admin.updateUserError', "Erro ao atualizar usuário: ") + err.message)
    } finally {
      setSavingId(null)
    }
  }

  // Handle toggling feature flag states
  const handleToggleFlag = async (key: string, currentVal: boolean) => {
    try {
      const supabase = getSupabaseBrowser()
      const newVal = !currentVal
      
      const { error } = await supabase
        .from("feature_flags")
        .update({
          is_enabled: newVal,
          updated_at: new Date().toISOString()
        })
        .eq("key", key)
      
      if (error) throw error
      
      // Update local state
      setFeatureFlagsData(prev => prev.map(f => f.key === key ? { ...f, is_enabled: newVal } : f))
      
      // Update store state immediately
      const currentFlags = useAppStore.getState().featureFlags
      useAppStore.getState().setFeatureFlags({
        ...currentFlags,
        [key]: newVal
      })
    } catch (err: any) {
      alert(t('admin.toggleFlagError', "Erro ao alterar feature flag: ") + err.message)
    }
  }

  const adminTabs: { key: typeof activeTab; icon: any; label: string; alert?: boolean }[] = [
    { key: "features",  icon: Settings,     label: t('admin.tabFeatures', "Custos por Feature") },
    { key: "models",    icon: Package,      label: t('admin.tabModels', "Preço dos Modelos") },
    { key: "users",     icon: Users,        label: `${t('admin.tabUsers', "Usuários")} (${users.length})` },
    { key: "analytics", icon: Activity,     label: t('admin.tabAnalytics', "Uso da Plataforma") },
    { key: "tickets",   icon: LifeBuoy,     label: t('admin.tabTickets', "Chamados") },
    { key: "flags",     icon: ToggleRight,  label: t('admin.tabFlags', "Feature Flags") },
    { key: "xp",        icon: Zap,          label: t('admin.tabXp', "XP & Badges") },
    { key: "affiliate", icon: ShoppingCart, label: t('admin.tabAffiliate', "Produtos Afiliados") },
  ]

  return (
    <div className="space-y-6 pb-16 fade-in">

      {/* Header Banner with Scraper Health */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0A0E20] via-[#0E1230] to-[#0A0E20] rounded-3xl p-7 border border-primary/15 shadow-overlay">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
              <ShieldAlert size={12} />
              {t('admin.headerBadge', "Painel Administrativo")}
            </div>
            <h1 className="text-display text-2xl text-white">{t('admin.title', "Admin")}</h1>
            <p className="text-white/50 max-w-lg text-sm leading-relaxed">
              {t('admin.subtitle', "Controle de custos, usuários, scraper e features em tempo real.")}
            </p>
          </div>

        </div>
      </div>

      {/* Games Admin Shortcuts */}
      {/* <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gestão de Games</p>
        <GameAdminShortcuts />
      </div> */}

      {/* 1-Column Layout for Admin with Horizontal Menu */}
      <div className="flex flex-col gap-6">
        {/* Admin Horizontal Menu */}
        <div className="w-full bg-card border border-border rounded-2xl p-1.5 shadow-card">
          <div className="flex flex-wrap gap-1">
            {adminTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer
                    ${isActive
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                >
                  <Icon size={15} className={isActive ? "text-primary" : "text-muted-foreground"} />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {tab.alert && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-card" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="w-full">
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center border border-border bg-card/20 rounded-2xl">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
          <span className="text-sm text-muted-foreground">{t('admin.loadingAdminData', "Carregando dados administrativos...")}</span>
        </div>
      ) : errorMsg ? (
        <div className="p-6 border border-red-500/20 bg-red-500/5 rounded-2xl text-center">
          <p className="text-red-400 font-medium">{errorMsg}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-500/10 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
          >
            {t('admin.tryAgain', "Tentar Novamente")}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB 1: FEATURES COSTS */}
          {activeTab === "features" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {features.map((feature) => (
                <FeatureCostCard 
                  key={feature.feature_key} 
                  feature={feature} 
                  onSave={handleSaveFeature}
                  isSaving={savingId === feature.feature_key}
                  isSuccess={saveSuccessId === feature.feature_key}
                />
              ))}
            </motion.div>
          )}

          {/* TAB 2: MODEL PRICES */}
          {activeTab === "models" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {models.map((model) => (
                <ModelPriceCard 
                  key={model.id} 
                  model={model} 
                  onSave={handleSaveModelPrice}
                  isSaving={savingId === model.id}
                  isSuccess={saveSuccessId === model.id}
                />
              ))}
            </motion.div>
          )}

          {/* TAB 3: USER SIMULATOR */}
          {activeTab === "users" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
            >
              <div className="p-6 border-b border-border bg-muted/20">
                <h3 className="font-bold text-base">{t('admin.userPlanManagerTitle', "Gerenciador de Planos de Usuários")}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('admin.userPlanManagerDesc', "Mude o plano de qualquer usuário ou injete créditos para testar as regras de cobrança dinâmica criadas.")}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/10 text-muted-foreground font-semibold">
                      <th className="px-6 py-4">{t('admin.colUserEmail', "Email do Usuário")}</th>
                      <th className="px-6 py-4">{t('admin.colCurrentPlan', "Plano Atual")}</th>
                      <th className="px-6 py-4">{t('admin.colCredits', "Créditos")}</th>
                      <th className="px-6 py-4 text-right">{t('admin.colActions', "Ações")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {users.map((u) => (
                      <UserRow 
                        key={u.id} 
                        user={u} 
                        onSave={handleSaveUser}
                        onOpenModal={setSelectedUserForModal}
                        isSaving={savingId === u.id}
                        isSuccess={saveSuccessId === u.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <UserDetailsModal 
                user={selectedUserForModal} 
                onClose={() => setSelectedUserForModal(null)} 
              />
            </motion.div>
          )}


          {/* TAB 5: PLATFORM ANALYTICS */}
          {activeTab === "analytics" && (
            <AnalyticsTab
              downloadHistory={downloadHistory}
              isLoading={isLoadingAnalytics}
              error={analyticsError}
              onRefresh={fetchAnalyticsData}
              downloadsOverTime={downloadsOverTimeData}
              downloadsByChannel={downloadsByChannelData}
            />
          )}



          {/* TAB 6: TICKETS CENTER */}
          {activeTab === "tickets" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <TicketsTab />
            </motion.div>
          )}

          {/* TAB 7: FEATURE FLAGS */}
          {activeTab === "flags" && (
            <FlagsTab featureFlags={featureFlags} onToggle={handleToggleFlag} />
          )}

          {/* TAB 8: XP & BADGES CONFIG */}
          {activeTab === "xp" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <XpConfigPanel />
            </motion.div>
          )}

          {/* TAB 9: AFFILIATE PRODUCTS */}
          {activeTab === "affiliate" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AffiliateProductsTab />
            </motion.div>
          )}

        </div>
      )}



        </div>
      </div>
    </div>
  )
}

// ─── HELPER COMPONENTS ─────────────────────────────────────────────

interface FeatureCostCardProps {
  feature: FeatureCost
  onSave: (key: string, free: number, pro: number, max: number) => void
  isSaving: boolean
  isSuccess: boolean
}

function FeatureCostCard({ feature, onSave, isSaving, isSuccess }: FeatureCostCardProps) {
  const { t } = useTranslation()
  const [free, setFree] = useState(feature.cost_free)
  const [pro, setPro] = useState(feature.cost_pro)
  const [max, setMax] = useState(feature.cost_max)

  return (
    <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500/30 transition-all shadow-sm">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
            <Settings size={18} />
          </div>
          <h3 className="font-bold text-base text-foreground">{feature.display_name}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-6">{t('admin.keyLabel', "Chave")}: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{feature.feature_key}</code></p>

        {/* Tier Costs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('admin.planFree', "Plano Free")}</label>
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                value={free}
                onChange={(e) => setFree(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-3 text-[10px] text-muted-foreground pointer-events-none">CR</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('admin.planPro', "Plano Pro")}</label>
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                value={pro}
                onChange={(e) => setPro(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-3 text-[10px] text-muted-foreground pointer-events-none">CR</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('admin.planMax', "Plano Max")}</label>
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                value={max}
                onChange={(e) => setMax(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="absolute right-3 text-[10px] text-muted-foreground pointer-events-none">CR</span>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => onSave(feature.feature_key, free, pro, max)}
        disabled={isSaving}
        className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer
          ${isSuccess
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          }`}
      >
        {isSaving ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isSuccess ? (
          <Check size={14} />
        ) : (
          <Save size={14} />
        )}
        {isSaving ? t('admin.savingBtn', "Salvando...") : isSuccess ? t('admin.pricesSavedBtn', "Preços Salvos!") : t('admin.savePricesBtn', "Salvar Preços")}
      </button>
    </div>
  )
}

interface ModelPriceCardProps {
  model: CatalogItem
  onSave: (id: string, free: number, pro: number, max: number) => void
  isSaving: boolean
  isSuccess: boolean
}

function ModelPriceCard({ model, onSave, isSaving, isSuccess }: ModelPriceCardProps) {
  const { t } = useTranslation()
  const [free, setFree] = useState(model.price_free)
  const [pro, setPro] = useState(model.price_pro)
  const [max, setMax] = useState(model.price_max)

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/30 transition-all shadow-sm">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
            <Package size={18} />
          </div>
          <h3 className="font-bold text-sm text-foreground truncate">{model.title}</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4 capitalize">{t('admin.typeLabel', "Tipo")}: {model.type.replace('_', ' ')}</p>

        {/* Tier Costs */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase">{t('admin.tierFree', "Free")}</label>
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                value={free}
                onChange={(e) => setFree(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase">{t('admin.tierPro', "Pro")}</label>
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                value={pro}
                onChange={(e) => setPro(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase">{t('admin.tierMax', "Max")}</label>
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                value={max}
                onChange={(e) => setMax(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => onSave(model.id, free, pro, max)}
        disabled={isSaving}
        className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer
          ${isSuccess
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          }`}
      >
        {isSaving ? (
          <Loader2 size={12} className="animate-spin" />
        ) : isSuccess ? (
          <Check size={12} />
        ) : (
          <Save size={12} />
        )}
        {isSaving ? t('admin.savingBtn', "Salvando...") : isSuccess ? t('admin.savedBtn', "Salvo!") : t('admin.saveCostBtn', "Salvar Custo")}
      </button>
    </div>
  )
}

interface UserRowProps {
  user: Profile
  onSave: (id: string, plan: "free" | "pro" | "max", credits: number) => void
  isSaving: boolean
  isSuccess: boolean
  onOpenModal: (user: Profile) => void
}

function UserRow({ user, onSave, isSaving, isSuccess, onOpenModal }: UserRowProps) {
  const { t } = useTranslation()
  const [plan, setPlan] = useState<"free" | "pro" | "max">(user.plan as any || "free")
  const [credits, setCredits] = useState(user.credits)

  const isDirty = plan !== user.plan || credits !== user.credits

  return (
    <tr className="hover:bg-muted/10 transition-colors">
      <td className="px-6 py-4 font-medium text-foreground">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
             <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || user.email)}&background=random`} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold">{user.full_name || user.email.split('@')[0]}</span>
              {user.role === "sysadmin" && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-px uppercase">
                  {t('admin.sysadminBadge', "Sysadmin")}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value as any)}
          className="bg-muted border border-border rounded-lg text-xs px-2.5 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-primary capitalize cursor-pointer"
        >
          <option value="free">{t('admin.tierFree', "Free")}</option>
          <option value="pro">{t('admin.tierPro', "Pro")}</option>
          <option value="max">{t('admin.tierMax', "Max")}</option>
        </select>
      </td>
      <td className="px-6 py-4">
        <input 
          type="number"
          value={credits}
          onChange={(e) => setCredits(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-20 bg-muted border border-border rounded-lg text-xs px-2.5 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-primary"
        />
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onOpenModal(user)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title={t('admin.viewUserDetails', "Ver detalhes do usuário")}
          >
            <Activity size={16} />
          </button>
          <button
            onClick={() => onSave(user.id, plan, credits)}
            disabled={!isDirty || isSaving}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer
              ${isSuccess 
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                : isDirty 
                  ? "bg-primary text-primary-foreground hover:opacity-90" 
                  : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
              }`}
          >
            {isSaving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : isSuccess ? (
              <UserCheck size={12} />
            ) : (
              <Save size={12} />
            )}
            {isSaving ? t('admin.applyingBtn', "Aplicando...") : isSuccess ? t('admin.appliedBtn', "Aplicado!") : t('admin.applyBtn', "Aplicar")}
          </button>
        </div>
      </td>
    </tr>
  )
}
