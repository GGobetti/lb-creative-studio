"use client"

import { useAppStore } from "@/store/store"
import { User, Mail, MapPin, Camera, Save, Loader2, Globe, Zap, ArrowUpRight, ArrowDownLeft, Receipt, Phone, Send, ShieldCheck, AlertTriangle, Trash2, Clock } from "lucide-react"
import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useToast } from "@/components/ui/Toast"
import { useTranslation } from "@/lib/translations"
import { XpTab } from "@/components/profile/XpTab"
import { useLogout } from "@/hooks/useLogout"

interface Transaction {
  id: string
  credits_added: number
  description: string | null
  created_at: string
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileContent />
    </Suspense>
  )
}

function ProfileContent() {
  const { profile, setProfile, setLanguage, setCreditModalOpen } = useAppStore()
  const { toast } = useToast()
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const handleLogout = useLogout()
  const activeTab = (searchParams.get('tab') || 'profile') as 'profile' | 'xp'

  // Local state for inputs
  const [fullName, setFullName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [telegramUsername, setTelegramUsername] = useState("")
  const [langPref, setLangPref] = useState<'pt' | 'en' | 'es'>("pt")
  const [marketingConsent, setMarketingConsent] = useState(true)

  // Loading states
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txLoading, setTxLoading] = useState(true)

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  // Initialize states from profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "")
      setAddress(profile.address || "")
      setPhone(profile.phone || "")
      setTelegramUsername(profile.telegram_username || "")
      setLangPref((profile.language as 'pt' | 'en' | 'es') || "pt")
      setMarketingConsent(profile.marketing_consent ?? true)
    }
  }, [profile])

  useEffect(() => {
    if (!profile?.id) return
    getSupabaseBrowser()
      .from("transactions")
      .select("id, credits_added, description, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then((res: { data: Transaction[] | null }) => {
        setTransactions(res.data || [])
        setTxLoading(false)
      })
  }, [profile?.id])

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setIsSaving(true)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          address: address.trim(),
          phone: phone.trim() || null,
          telegram_username: telegramUsername.trim() || null,
          marketing_consent: marketingConsent,
          language: langPref,
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id)

      if (error) throw error

      // Update global store
      setLanguage(langPref)
      setProfile({
        ...profile,
        full_name: fullName.trim(),
        address: address.trim(),
        phone: phone.trim() || null,
        telegram_username: telegramUsername.trim() || null,
        marketing_consent: marketingConsent,
        language: langPref
      })

      toast(t("profile.toastSuccess", "Perfil atualizado com sucesso!"), "success")
    } catch (err: any) {
      console.error("Erro ao salvar perfil:", err)
      toast(t("profile.toastError", "Falha ao atualizar perfil: ") + (err.message || err), "error")
    } finally {
      setIsSaving(false)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    // Validate size (limit to 3MB)
    if (file.size > 3 * 1024 * 1024) {
      toast("A imagem deve ter no máximo 3MB.", "error")
      return
    }

    setIsUploading(true)
    try {
      const supabase = getSupabaseBrowser()
      const fileExt = file.name.split('.').pop()
      const filePath = `${profile.id}/avatar-${Date.now()}.${fileExt}`

      // Upload file to the public 'avatars' storage bucket
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Retrieve public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath)

      // Update profiles database table
      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id)

      if (dbError) throw dbError

      // Update global store
      setProfile({
        ...profile,
        avatar_url: publicUrl
      })

      toast(t("profile.toastUploadSuccess", "Foto de perfil atualizada!"), "success")
    } catch (err: any) {
      console.error("Erro ao fazer upload da foto:", err)
      toast(t("profile.toastUploadError", "Erro ao carregar foto: ") + (err.message || err), "error")
    } finally {
      setIsUploading(false)
    }
  }

  const deleteConfirmWord = t("profile.deleteAccountConfirmPlaceholder", "EXCLUIR")

  const handleDeleteAccount = async () => {
    if (!profile || deleteConfirmText.trim().toUpperCase() !== deleteConfirmWord) return

    setIsDeletingAccount(true)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("profiles")
        .update({ deletion_requested_at: new Date().toISOString() })
        .eq("id", profile.id)

      if (error) throw error

      toast(t("profile.deleteAccountRequested", "Solicitação de exclusão registrada. Você será desconectado."), "success")
      setShowDeleteModal(false)
      await handleLogout()
    } catch (err: any) {
      console.error("Erro ao solicitar exclusão da conta:", err)
      toast(t("profile.deleteAccountError", "Erro ao solicitar exclusão da conta."), "error")
      setIsDeletingAccount(false)
    }
  }

  const emailInitial = profile?.email ? profile.email[0].toUpperCase() : "U"

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("profile.title", "Meu Perfil")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("profile.subtitle", "Gerencie suas informações pessoais e de contato.")}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted border border-border mb-6">
        {(['profile', 'xp'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => router.push(`/dashboard/profile?tab=${tab}`)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'profile' ? t('profile.tab', 'Perfil') : `⭐ ${t('profile.xpTab', 'XP & Badges')}`}
          </button>
        ))}
      </div>

      {activeTab === 'xp' && <XpTab />}

      {activeTab === 'profile' && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Avatar Sidebar */}
        <div className="col-span-1">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center text-center shadow-sm">
            <div 
              onClick={triggerFileInput}
              className="relative group cursor-pointer mb-4 select-none"
            >
              <div className="w-32 h-32 rounded-full bg-primary/10 border-4 border-card flex items-center justify-center overflow-hidden shadow-inner transition-transform group-hover:scale-[1.02]">
                {isUploading ? (
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                ) : profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={profile.avatar_url} 
                    alt="Avatar" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <span className="text-4xl font-bold text-primary">{emailInitial}</span>
                )}
              </div>
              
              {!isUploading && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="text-white w-5 h-5 mb-1" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">{t("profile.changePhoto", "Alterar Foto")}</span>
                </div>
              )}
            </div>

            <h3 className="font-bold text-foreground truncate max-w-full">
              {profile?.full_name || profile?.email.split('@')[0]}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("profile.memberSince", "Membro desde")} 2026
            </p>
            
            <button 
              type="button"
              onClick={triggerFileInput}
              disabled={isUploading}
              className="w-full mt-6 py-2 px-4 rounded-xl border border-border bg-muted/20 text-foreground hover:bg-muted transition-colors text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <Camera className="w-4 h-4 text-primary" />
              )}
              {t("profile.uploadPhoto", "Fazer Upload de Foto")}
            </button>

            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handlePhotoUpload} 
              accept="image/*"
              className="hidden" 
            />

            {/* Plan / Credits Info Card */}
            <div className="w-full mt-6 bg-muted/40 border border-border/60 rounded-xl p-4 text-left space-y-3">
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Plano Atual</p>
                <p className="text-sm font-black text-foreground capitalize">
                  {t(`common.${profile?.plan}`, profile?.plan)}
                </p>
              </div>
              <div className="pt-2 border-t border-border/40">
                <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Saldo de Créditos</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xl font-black text-foreground">{profile?.credits ?? 0} crd</span>
                  <button
                    type="button"
                    onClick={() => setCreditModalOpen(true)}
                    className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg bg-primary text-primary-foreground font-black text-xs hover:opacity-95 shadow-md shadow-primary/15 transition-all cursor-pointer"
                  >
                    <Zap size={12} className="fill-current" />
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Area */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          {/* Transactions */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Receipt size={18} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">Histórico de Créditos</h2>
            </div>

            {txLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma transação encontrada.</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {transactions.map((tx) => {
                  const isPositive = tx.credits_added > 0
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPositive ? 'bg-success/10' : 'bg-destructive/10'}`}>
                        {isPositive
                          ? <ArrowDownLeft size={15} className="text-success" />
                          : <ArrowUpRight size={15} className="text-destructive" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {tx.description || (isPositive ? 'Créditos adicionados' : 'Créditos utilizados')}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {isPositive ? '+' : ''}{tx.credits_added} crd
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-6">{t("profile.personalInfo", "Informações Pessoais")}</h2>
            
            <form onSubmit={handleSaveChanges} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">{t("profile.fullName", "Nome Completo")}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User size={16} className="text-muted-foreground" />
                    </div>
                    <input 
                      type="text" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow text-foreground" 
                      placeholder={t("profile.fullNamePlaceholder", "Seu nome")} 
                    />
                  </div>
                </div>

                {/* Email (Disabled) */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">{t("profile.email", "Email")}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail size={16} className="text-muted-foreground" />
                    </div>
                    <input 
                      type="email" 
                      disabled 
                      value={profile?.email || ""} 
                      className="w-full pl-10 pr-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed" 
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5 pt-2">
                <label className="text-sm font-semibold text-foreground">{t("profile.address", "Endereço Básico (Para Orçamentos)")}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin size={16} className="text-muted-foreground" />
                  </div>
                  <input 
                    type="text" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow text-foreground" 
                    placeholder={t("profile.addressPlaceholder", "Cidade - Estado")} 
                  />
                </div>
              </div>

              {/* Phone & Telegram */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">{t("profile.phone", "Telefone / WhatsApp")}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone size={16} className="text-muted-foreground" />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow text-foreground"
                      placeholder={t("profile.phonePlaceholder", "(11) 99999-9999")}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">{t("profile.telegram", "Usuário do Telegram")}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Send size={16} className="text-muted-foreground" />
                    </div>
                    <input
                      type="text"
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow text-foreground"
                      placeholder={t("profile.telegramPlaceholder", "@seu_usuario")}
                    />
                  </div>
                </div>
              </div>

              {/* Language Selection */}
              <div className="space-y-1.5 pt-2">
                <label className="text-sm font-semibold text-foreground">{t("profile.language", "Idioma de Preferência")}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe size={16} className="text-muted-foreground" />
                  </div>
                  <select
                    value={langPref}
                    onChange={(e) => setLangPref(e.target.value as 'pt' | 'en' | 'es')}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="pt">🇧🇷 Português (Brasil)</option>
                    <option value="en">🇺🇸 English (United States)</option>
                    <option value="es">🇪🇸 Español</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity font-bold text-sm cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {isSaving ? t("common.saving", "Salvando...") : t("profile.saveChanges", "Salvar Alterações")}
                </button>
              </div>
            </form>
          </div>

          {/* Privacy & Communication */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={18} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">{t("profile.privacySection", "Privacidade e Comunicação")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">{t("profile.privacySectionDesc", "Controle como usamos seus dados, conforme a LGPD.")}</p>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/20 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary cursor-pointer shrink-0"
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-foreground">{t("profile.marketingConsent", "Receber ofertas e novidades por e-mail")}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{t("profile.marketingConsentDesc", "Você pode desativar a qualquer momento. Não afeta e-mails transacionais (pedidos, faturas, suporte).")}</span>
              </span>
            </label>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity font-bold text-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? t("common.saving", "Salvando...") : t("profile.saveChanges", "Salvar Alterações")}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={18} className="text-destructive" />
              <h2 className="text-xl font-bold text-destructive">{t("profile.dangerZone", "Zona de Risco")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">{t("profile.dangerZoneDesc", "Ações permanentes relacionadas à sua conta.")}</p>

            {profile?.deletion_requested_at ? (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10">
                <Clock size={18} className="text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    {t("profile.deletionPending", "Exclusão de conta solicitada em")} {new Date(profile.deletion_requested_at).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("profile.deletionPendingDesc", "Sua conta está na fila para exclusão definitiva. Entre em contato com o suporte caso queira cancelar esse pedido.")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-card">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("profile.deleteAccount", "Excluir Minha Conta")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{t("profile.deleteAccountDesc", "Solicite a exclusão definitiva da sua conta e dos seus dados pessoais, conforme seus direitos previstos na LGPD (Art. 18).")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 font-bold text-xs shrink-0 cursor-pointer transition-all"
                >
                  <Trash2 size={14} />
                  {t("profile.deleteAccount", "Excluir Minha Conta")}
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => !isDeletingAccount && setShowDeleteModal(false)}
          />
          <div className="relative w-full max-w-md bg-card dark:bg-[#0c0c18] border border-destructive/30 rounded-2xl shadow-2xl shadow-black/70 backdrop-blur-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-destructive" />
              <h3 className="text-lg font-black text-foreground">{t("profile.deleteAccountModalTitle", "Excluir conta permanentemente?")}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("profile.deleteAccountModalBody", "Esta ação solicitará a exclusão da sua conta. Você será desconectado imediatamente e não poderá mais acessar seus créditos, portfólio ou histórico. Dados com obrigação legal de retenção (ex: notas e transações financeiras) podem ser mantidos de forma anonimizada pelo prazo exigido por lei. A exclusão definitiva dos demais dados será concluída em até 15 dias.")}
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t("profile.deleteAccountConfirmLabel", "Digite EXCLUIR para confirmar")}
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteConfirmWord}
                className="w-full px-3 py-2 bg-background border border-destructive/30 rounded-lg text-sm focus:outline-none focus:border-destructive focus:ring-1 focus:ring-destructive text-foreground"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText("") }}
                disabled={isDeletingAccount}
                className="px-4 py-2 rounded-xl border border-border text-muted-foreground hover:bg-muted text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
              >
                {t("profile.deleteAccountCancel", "Cancelar")}
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || deleteConfirmText.trim().toUpperCase() !== deleteConfirmWord}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive hover:opacity-90 disabled:opacity-40 text-destructive-foreground text-xs font-black cursor-pointer transition-all"
              >
                {isDeletingAccount ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {t("profile.deleteAccountConfirm", "Confirmar Exclusão")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
