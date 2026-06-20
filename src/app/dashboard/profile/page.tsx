"use client"

import { useAppStore } from "@/store/store"
import { User, Mail, MapPin, Camera, Save, Loader2, Globe, Zap, ArrowUpRight, ArrowDownLeft, Receipt } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useToast } from "@/components/ui/Toast"
import { useTranslation } from "@/lib/translations"
import { XpTab } from "@/components/profile/XpTab"

interface Transaction {
  id: string
  credits_added: number
  description: string | null
  created_at: string
}

export default function ProfilePage() {
  const { profile, setProfile, setLanguage, setCreditModalOpen } = useAppStore()
  const { toast } = useToast()
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = (searchParams.get('tab') || 'profile') as 'profile' | 'xp'

  // Local state for inputs
  const [fullName, setFullName] = useState("")
  const [address, setAddress] = useState("")
  const [langPref, setLangPref] = useState<'pt' | 'en' | 'es'>("pt")
  
  // Loading states
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txLoading, setTxLoading] = useState(true)

  // Initialize states from profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "")
      setAddress(profile.address || "")
      setLangPref((profile.language as 'pt' | 'en' | 'es') || "pt")
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

        </div>

      </div>
      )}
    </div>
  )
}
