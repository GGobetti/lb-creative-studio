'use client'

import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Calculator as CalculatorIcon, 
  Box, 
  Search, 
  Upload, 
  Edit, 
  Trash2, 
  Heart, 
  Download as DownloadIcon, 
  Bookmark, 
  Globe, 
  User, 
  Loader2, 
  ExternalLink,
  Tag,
  Clock,
  Scale,
  DollarSign,
  FileText,
  ShieldCheck,
  X,
  FileBox,
  CloudDownload,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { PortfolioItem, getSupabaseBrowser } from '@/lib/supabase'
import { MakerWorldImportModal } from '@/components/dashboard/MakerWorldImportModal'
import { PricingCalculator } from '@/components/dashboard/PricingCalculator'
import * as Dialog from '@radix-ui/react-dialog'
import { useAppStore } from '@/store/store'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/lib/translations'

export function PortfolioClient() {
  const { profile } = useAppStore()
  const { t, language } = useTranslation()
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR'
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null)
  const [viewingItem, setViewingItem] = useState<PortfolioItem | null>(null)
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null)
  const [isStandaloneCalcOpen, setIsStandaloneCalcOpen] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [portfolioTab, setPortfolioTab] = useState<'models' | 'history'>('models')

  interface Transaction {
    id: string
    credits_added: number
    description: string | null
    item_id: string | null
    created_at: string
  }
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(true)
  const [transactionsSearchQuery, setTransactionsSearchQuery] = useState('')
  const [transactionsError, setTransactionsError] = useState('')

  useEffect(() => {
    if (portfolioTab !== 'history') return
    const fetchHistory = async () => {
      setLoadingTransactions(true)
      setTransactionsError('')
      try {
        const supabase = getSupabaseBrowser()
        const { data, error: fetchErr } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100)

        if (fetchErr) throw fetchErr
        setTransactions((data as Transaction[]) ?? [])
      } catch (err: any) {
        console.error("[History] Failed to fetch:", err)
        setTransactionsError(t('portfolio.historyLoadError', "Não foi possível carregar o histórico. Tente novamente."))
      } finally {
        setLoadingTransactions(false)
      }
    }
    fetchHistory()
  }, [portfolioTab, profile])

  // UI state for viewing gallery
  const [activeImgIndex, setActiveImgIndex] = useState(0)

  // Form states
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formWeight, setFormWeight] = useState('0')
  const [formPrintTime, setFormPrintTime] = useState('0')
  const [formExternalUrl, setFormExternalUrl] = useState('')
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('')
  const [formTags, setFormTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchItems = async () => {
    const supabase = getSupabaseBrowser()
    let session = null
    try {
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
      const res = await Promise.race([sessionPromise, timeoutPromise]) as any
      session = res?.data?.session
    } catch (e) {
      console.warn('getSession timed out or failed in PortfolioClient, trying localStorage fallback...', e)
      if (typeof window !== 'undefined') {
        try {
          const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
          const match = projectUrl.match(/https:\/\/(.*?)\.supabase\.co/)
          const projectRef = match ? match[1] : ''
          const key = `sb-${projectRef}-auth-token`
          const localData = localStorage.getItem(key)
          if (localData) {
            session = JSON.parse(localData)
          }
        } catch (err) {
          console.error('Failed to parse fallback session from localStorage in PortfolioClient', err)
        }
      }
    }
    
    const userId = session?.user?.id
    const accessToken = session?.access_token
    
    if (!userId || !accessToken) return

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) return

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/portfolio_items?user_id=eq.${userId}&order=created_at.desc`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${accessToken}`,
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setItems(data)
      } else {
        console.error('Error fetching items:', await response.text())
      }
    } catch (err) {
      console.error('Fetch exception:', err)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const filteredItems = items.filter(item => {
    if (sourceFilter !== 'all' && item.source_type !== sourceFilter) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      item.title.toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q)
    )
  })

  const handleImportSuccess = () => {
    fetchItems()
  }

  const handleSavePrice = async (price: number) => {
    if (!selectedItem) return
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from('portfolio_items')
        .update({ calculated_price: price })
        .eq('id', selectedItem.id)
      
      if (!error) {
        setItems(prev => prev.map(item => item.id === selectedItem.id ? { ...item, calculated_price: price } : item))
        if (viewingItem?.id === selectedItem.id) {
          setViewingItem(prev => prev ? { ...prev, calculated_price: price } : null)
        }
      }
    } catch (e) {
      console.error(e)
    }
    setSelectedItem(null)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm(t('portfolio.confirmDelete', 'Deseja realmente excluir este item do seu portfólio?'))) return
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from('portfolio_items')
        .delete()
        .eq('id', itemId)

      if (!error) {
        setItems(prev => prev.filter(item => item.id !== itemId))
        setViewingItem(null)
      } else {
        alert(t('portfolio.deleteError', 'Erro ao excluir item: ') + error.message)
      }
    } catch (e: any) {
      console.error(e)
      alert(t('portfolio.unexpectedError', 'Erro inesperado: ') + e.message)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error(t('portfolio.notAuthenticated', 'Usuário não autenticado.'))

      // Verificar se a pasta do usuário está configurada no storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        // Se der erro de bucket inexistente, avisa o usuário sobre a migração
        if (uploadError.message?.includes('bucket') || uploadError.message?.includes('does not exist')) {
          throw new Error(t('portfolio.bucketNotConfigured', 'Bucket "portfolio" não configurado no Supabase. Certifique-se de executar as migrações SQL no painel do Supabase.'))
        }
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('portfolio')
        .getPublicUrl(fileName)

      setFormThumbnailUrl(publicUrl)
    } catch (err: any) {
      console.error('Error uploading image:', err)
      alert(err.message || t('portfolio.uploadImageError', 'Erro ao fazer upload da imagem.'))
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setFormTitle('')
    setFormDescription('')
    setFormWeight('0')
    setFormPrintTime('0')
    setFormExternalUrl('')
    setFormThumbnailUrl('')
    setFormTags('')
  }

  const handleCreateManualItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      alert(t('portfolio.titleRequired', 'O título é obrigatório.'))
      return
    }

    setSaving(true)
    try {
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error(t('portfolio.notAuthenticated', 'Usuário não autenticado.'))

      const tagsArray = formTags.split(',').map(t => t.trim()).filter(Boolean)

      const newItem = {
        user_id: userId,
        title: formTitle,
        description: formDescription || null,
        thumbnail_url: formThumbnailUrl || null,
        source_type: 'manual',
        external_url: formExternalUrl || null,
        weight_g: Number(formWeight) || 0,
        print_time_hours: Number(formPrintTime) || 0,
        calculated_price: 0,
        metadata: {
          tags: tagsArray,
          pictures: formThumbnailUrl ? [formThumbnailUrl] : []
        }
      }

      const { error } = await supabase
        .from('portfolio_items')
        .insert([newItem])

      if (error) throw error

      fetchItems()
      setIsCreateModalOpen(false)
      resetForm()
    } catch (err: any) {
      console.error(err)
      alert(t('portfolio.saveError', 'Erro ao salvar item: ') + err.message)
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (item: PortfolioItem) => {
    setEditingItem(item)
    setFormTitle(item.title)
    setFormDescription(item.description || '')
    setFormWeight(String(item.weight_g))
    setFormPrintTime(String(item.print_time_hours))
    setFormExternalUrl(item.external_url || '')
    setFormThumbnailUrl(item.thumbnail_url || '')
    setFormTags(item.metadata?.tags?.join(', ') || '')
  }

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    if (!formTitle.trim()) {
      alert(t('portfolio.titleRequired', 'O título é obrigatório.'))
      return
    }

    setSaving(true)
    try {
      const supabase = getSupabaseBrowser()
      const tagsArray = formTags.split(',').map(t => t.trim()).filter(Boolean)

      const existingMetadata = editingItem.metadata || {}
      const updatedMetadata = {
        ...existingMetadata,
        tags: tagsArray,
        pictures: formThumbnailUrl 
          ? Array.from(new Set([formThumbnailUrl, ...(existingMetadata.pictures || [])])) 
          : (existingMetadata.pictures || [])
      }

      const updatedFields = {
        title: formTitle,
        description: formDescription || null,
        thumbnail_url: formThumbnailUrl || null,
        external_url: formExternalUrl || null,
        weight_g: Number(formWeight) || 0,
        print_time_hours: Number(formPrintTime) || 0,
        metadata: updatedMetadata
      }

      const { error } = await supabase
        .from('portfolio_items')
        .update(updatedFields)
        .eq('id', editingItem.id)

      if (error) throw error

      fetchItems()
      setEditingItem(null)
      if (viewingItem?.id === editingItem.id) {
        setViewingItem(prev => prev ? { ...prev, ...updatedFields } : null)
      }
      resetForm()
    } catch (err: any) {
      console.error(err)
      alert(t('portfolio.updateError', 'Erro ao atualizar item: ') + err.message)
    } finally {
      setSaving(false)
    }
  }

  const getItemPictures = (item: PortfolioItem): string[] => {
    const pics: string[] = []
    if (item.thumbnail_url) pics.push(item.thumbnail_url)
    if (item.metadata?.pictures && Array.isArray(item.metadata.pictures)) {
      item.metadata.pictures.forEach((p: string) => {
        if (p && !pics.includes(p)) pics.push(p)
      })
    }
    return pics
  }

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground">{t('portfolio.title', 'Meu Portfólio')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('portfolio.subtitle', 'Importe do MakerWorld ou cadastre seus próprios modelos para calcular custos com precisão.')}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => setIsStandaloneCalcOpen(true)}
            className="bg-muted text-muted-foreground px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-muted/80 hover:text-foreground transition-colors"
          >
            <CalculatorIcon className="w-4 h-4" />
            {t('portfolio.freeCalculator', 'Calculadora Livre')}
          </button>
          <button
            onClick={() => {
              resetForm()
              setIsCreateModalOpen(true)
            }}
            className="bg-secondary text-secondary-foreground px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-secondary/80 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('portfolio.registerModel', 'Cadastrar Modelo')}
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            {t('portfolio.importMakerWorld', 'Importar MakerWorld')}
          </button>
        </div>
      </div>

      <MakerWorldImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImportSuccess={handleImportSuccess}
      />

      {/* Standalone Calculator Modal */}
      <Dialog.Root open={isStandaloneCalcOpen} onOpenChange={setIsStandaloneCalcOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50 animate-in fade-in" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-5xl translate-x-[-50%] translate-y-[-50%] max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
            <Dialog.Title className="sr-only">{t('portfolio.priceCalculatorTitle', 'Calculadora de Preço')}</Dialog.Title>
            <PricingCalculator isStandalone={true} />
            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 bg-muted hover:bg-muted/80 text-foreground rounded-full p-2 transition-colors z-50">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Selected Item Calculator Modal */}
      <Dialog.Root open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50 animate-in fade-in" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-5xl translate-x-[-50%] translate-y-[-50%] max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
            <Dialog.Title className="sr-only">{t('portfolio.pricingModelTitle', 'Precificar Modelo')}</Dialog.Title>
            {selectedItem && (
              <PricingCalculator
                isStandalone={false}
                initialWeight={selectedItem.weight_g}
                initialTimeHours={selectedItem.print_time_hours}
                onSavePrice={handleSavePrice}
              />
            )}
            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 bg-muted hover:bg-muted/80 text-foreground rounded-full p-2 transition-colors z-50">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Viewing Item Details Modal (REDESIGNED WIDE VIEW) */}
      <Dialog.Root open={!!viewingItem} onOpenChange={(open) => {
        if (!open) {
          setViewingItem(null)
          setActiveImgIndex(0)
        }
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50 animate-in fade-in" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] max-h-[90vh] overflow-hidden rounded-2xl bg-card border border-border shadow-2xl flex flex-col">
            {viewingItem && (() => {
              const pictures = getItemPictures(viewingItem)
              const activeUrl = pictures[activeImgIndex] || viewingItem.thumbnail_url
              return (
                <>
                  <div className="flex items-center justify-between border-b border-border p-5">
                    <div>
                      <Dialog.Title className="text-xl font-black text-foreground flex items-center gap-3">
                        {viewingItem.title}
                      </Dialog.Title>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('portfolio.addedOn', 'Adicionado em')} {new Date(viewingItem.created_at).toLocaleDateString(locale)}
                      </p>
                    </div>
                    <Dialog.Close asChild>
                      <button className="bg-muted hover:bg-muted/80 text-foreground rounded-full p-2 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </Dialog.Close>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                      {/* Left: Picture Gallery (No Stretching) */}
                      <div className="md:col-span-7 flex flex-col gap-4">
                        <div className="aspect-[4/3] w-full rounded-xl bg-black/40 border border-border overflow-hidden flex items-center justify-center relative group select-none">
                          <AnimatePresence mode="wait">
                            {activeUrl ? (
                              <motion.img
                                key={activeImgIndex}
                                src={activeUrl}
                                alt={viewingItem.title}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.22, ease: "easeInOut" }}
                                className="w-full h-full object-contain absolute"
                              />
                            ) : (
                              <Box className="w-16 h-16 opacity-20 text-muted-foreground" />
                            )}
                          </AnimatePresence>

                          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider z-10">
                            {viewingItem.source_type === 'makerworld' ? 'MakerWorld' : viewingItem.source_type === 'manual' ? t('portfolio.sourceManual', 'Manual') : t('portfolio.sourceLbStudio', 'LB Studio')}
                          </div>

                          {/* Left/Right controls (when multiple pictures exist) */}
                          {pictures.length > 1 && (
                            <>
                              <button
                                onClick={() => setActiveImgIndex((prev) => (prev > 0 ? prev - 1 : pictures.length - 1))}
                                className="absolute left-3 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                              >
                                <ChevronLeft size={20} />
                              </button>
                              <button
                                onClick={() => setActiveImgIndex((prev) => (prev < pictures.length - 1 ? prev + 1 : 0))}
                                className="absolute right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                              >
                                <ChevronRight size={20} />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Gallery Thumbnails */}
                        {pictures.length > 1 && (
                          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none justify-center">
                            {pictures.map((pic, idx) => (
                              <button
                                key={idx}
                                onClick={() => setActiveImgIndex(idx)}
                                className={`w-14 h-14 rounded-lg border overflow-hidden shrink-0 transition-all cursor-pointer ${
                                  activeImgIndex === idx 
                                    ? 'border-primary ring-2 ring-primary/40 opacity-100 scale-105 shadow-md' 
                                    : 'border-border opacity-50 hover:opacity-100'
                                }`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={pic} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Technical Stats & Meta details */}
                      <div className="md:col-span-5 flex flex-col gap-5 justify-between">
                        <div className="space-y-5">
                          {/* MakerWorld Rich Details */}
                          {viewingItem.source_type === 'makerworld' && viewingItem.metadata && (
                            <div className="bg-muted/30 border border-border p-4 rounded-xl space-y-3">
                              {viewingItem.metadata.creator && (
                                <div className="flex items-center gap-2.5 border-b border-border/50 pb-2.5">
                                  {viewingItem.metadata.creator.avatar ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img 
                                      src={viewingItem.metadata.creator.avatar} 
                                      alt="" 
                                      className="w-6 h-6 rounded-full object-cover border border-border" 
                                    />
                                  ) : (
                                    <User className="w-6 h-6 rounded-full p-0.5 bg-muted border" />
                                  )}
                                  <div className="text-xs">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('portfolio.author', 'Autor')}</p>
                                    <p className="font-semibold text-foreground">{viewingItem.metadata.creator.name}</p>
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Heart size={14} className="text-red-500 fill-red-500" />
                                  <span>{viewingItem.metadata.likeCount || 0} {t('portfolio.likes', 'Likes')}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <DownloadIcon size={14} className="text-blue-500" />
                                  <span>{viewingItem.metadata.downloadCount || 0} {t('portfolio.downloads', 'Downloads')}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Bookmark size={14} className="text-yellow-500 fill-yellow-500" />
                                  <span>{viewingItem.metadata.collectionCount || 0} {t('portfolio.saved', 'Salvos')}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Box size={14} className="text-green-500" />
                                  <span>{viewingItem.metadata.printCount || 0} {t('portfolio.prints', 'Impressões')}</span>
                                </div>
                              </div>

                              {viewingItem.metadata.license && (
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted border border-border/60 px-2 py-1 rounded w-fit">
                                  <ShieldCheck size={12} className="text-primary" />
                                  <span>{t('portfolio.license', 'Licença')}: {viewingItem.metadata.license}</span>
                                </div>
                              )}

                              {viewingItem.external_url && (
                                <a
                                  href={viewingItem.external_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline"
                                >
                                  <ExternalLink size={12} />
                                  {t('portfolio.viewOriginal', 'Visualizar no MakerWorld original')}
                                </a>
                              )}
                            </div>
                          )}

                          {/* Technical Specifications */}
                          <div className="grid grid-cols-3 gap-3 bg-muted/20 border border-border/50 p-3 rounded-xl text-center">
                            <div className="flex flex-col items-center">
                              <Scale size={14} className="text-muted-foreground mb-1" />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('portfolio.weight', 'Peso')}</span>
                              <span className="text-sm font-semibold">{viewingItem.weight_g}g</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <Clock size={14} className="text-muted-foreground mb-1" />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('portfolio.time', 'Tempo')}</span>
                              <span className="text-sm font-semibold">{viewingItem.print_time_hours}h</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <DollarSign size={14} className="text-primary mb-1" />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('portfolio.price', 'Preço')}</span>
                              <span className="text-sm font-semibold text-primary">
                                {viewingItem.calculated_price > 0 ? `R$ ${viewingItem.calculated_price.toFixed(2)}` : 'R$ 0,00'}
                              </span>
                            </div>
                          </div>

                          {/* Description */}
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                              <FileText size={12} />
                              {t('portfolio.description', 'Descrição')}
                            </span>
                            <p className="text-xs text-muted-foreground max-h-36 overflow-y-auto whitespace-pre-wrap border border-border/40 p-3 rounded-lg bg-muted/10 leading-relaxed scrollbar-thin">
                              {viewingItem.description || t('portfolio.noDescription', 'Nenhuma descrição inserida.')}
                            </p>
                          </div>

                          {/* Tags */}
                          {viewingItem.metadata?.tags && viewingItem.metadata.tags.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5">
                                <Tag size={12} />
                                {t('portfolio.tags', 'Tags')}
                              </span>
                              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto scrollbar-thin">
                                {viewingItem.metadata.tags.map((tag: string, i: number) => (
                                  <span key={i} className="text-[10px] bg-muted border border-border/50 text-muted-foreground px-2 py-0.5 rounded-full">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="flex items-center gap-2 pt-4 border-t border-border mt-4">
                          <button
                            onClick={() => handleDeleteItem(viewingItem.id)}
                            className="bg-destructive/10 text-destructive hover:bg-destructive/20 p-2.5 rounded-lg transition-colors"
                            title={t('portfolio.deleteItemTitle', 'Excluir item')}
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            onClick={() => {
                              startEditing(viewingItem)
                              setViewingItem(null)
                            }}
                            className="bg-muted text-foreground border border-border hover:bg-muted/80 p-2.5 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                          >
                            <Edit size={14} />
                            {t('common.edit', 'Editar')}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItem(viewingItem)
                              setViewingItem(null)
                            }}
                            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-1.5"
                          >
                            <DollarSign size={14} />
                            {t('portfolio.pricingPrint', 'Precificar Impressão')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* CREATE MANUAL ITEM MODAL */}
      <Dialog.Root open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50 animate-in fade-in" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <Dialog.Title className="text-lg font-bold text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                {t('portfolio.registerModelManually', 'Cadastrar Modelo Manualmente')}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="bg-muted hover:bg-muted/80 text-foreground rounded-full p-2 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleCreateManualItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.titleField', 'Título')} *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('portfolio.titlePlaceholder', 'Ex: Chaveiro Logo Personalizado')}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.description', 'Descrição')}</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t('portfolio.descriptionPlaceholder', 'Detalhes ou especificações do modelo')}
                  rows={3}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.estimatedWeight', 'Peso Estimado (g)')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.estimatedTime', 'Tempo Estimado (h)')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formPrintTime}
                    onChange={(e) => setFormPrintTime(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.externalLink', 'Link Externo (Ex: MakerWorld, Thingiverse)')}</label>
                <input
                  type="url"
                  value={formExternalUrl}
                  onChange={(e) => setFormExternalUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.tagsField', 'Tags (Separadas por vírgula)')}</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder={t('portfolio.tagsPlaceholder', 'chaveiro, personalizado, presente')}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">{t('portfolio.photoField', 'Foto / Imagem do Modelo')}</label>
                <div className="grid grid-cols-1 gap-3">
                  {/* File Upload Dropzone */}
                  <div className="border border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center bg-muted/30 hover:bg-muted/50 transition relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploading}
                    />
                    {uploading ? (
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                    )}
                    <span className="text-xs font-bold text-foreground">
                      {uploading ? t('portfolio.uploading', 'Enviando...') : t('portfolio.uploadImage', 'Fazer upload de imagem')}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">JPG, PNG ou WebP</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-px bg-border flex-1"></span>
                    <span>{t('portfolio.orPasteUrl', 'OU COLE A URL')}</span>
                    <span className="h-px bg-border flex-1"></span>
                  </div>

                  <input
                    type="url"
                    value={formThumbnailUrl}
                    onChange={(e) => setFormThumbnailUrl(e.target.value)}
                    placeholder={t('portfolio.pastePublicUrl', 'Cole a URL pública da imagem...')}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />

                  {formThumbnailUrl && (
                    <div className="mt-2 relative w-20 h-20 rounded-lg border border-border overflow-hidden bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={formThumbnailUrl} alt={t('portfolio.previewAlt', 'Preview')} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormThumbnailUrl('')}
                        className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                  >
                    {t('common.cancel', 'Cancelar')}
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-primary/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('portfolio.saveModel', 'Salvar Modelo')}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* EDIT ITEM MODAL */}
      <Dialog.Root open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50 animate-in fade-in" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <Dialog.Title className="text-lg font-bold text-foreground flex items-center gap-2">
                <Edit className="w-5 h-5 text-primary" />
                {t('portfolio.editModel', 'Editar Modelo')}
              </Dialog.Title>
              <button
                onClick={() => setEditingItem(null)}
                className="bg-muted hover:bg-muted/80 text-foreground rounded-full p-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.titleField', 'Título')} *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.description', 'Descrição')}</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.estimatedWeight', 'Peso Estimado (g)')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.estimatedTime', 'Tempo Estimado (h)')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formPrintTime}
                    onChange={(e) => setFormPrintTime(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.externalLinkShort', 'Link Externo')}</label>
                <input
                  type="url"
                  value={formExternalUrl}
                  onChange={(e) => setFormExternalUrl(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">{t('portfolio.tagsField', 'Tags (Separadas por vírgula)')}</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">{t('portfolio.photoField', 'Foto / Imagem do Modelo')}</label>
                <div className="grid grid-cols-1 gap-3">
                  <div className="border border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center bg-muted/30 hover:bg-muted/50 transition relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploading}
                    />
                    {uploading ? (
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                    )}
                    <span className="text-xs font-bold text-foreground">
                      {uploading ? t('portfolio.uploading', 'Enviando...') : t('portfolio.uploadNewImage', 'Fazer upload de nova imagem')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-px bg-border flex-1"></span>
                    <span>{t('portfolio.orUpdateUrl', 'OU ATUALIZE A URL')}</span>
                    <span className="h-px bg-border flex-1"></span>
                  </div>

                  <input
                    type="url"
                    value={formThumbnailUrl}
                    onChange={(e) => setFormThumbnailUrl(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />

                  {formThumbnailUrl && (
                    <div className="mt-2 relative w-20 h-20 rounded-lg border border-border overflow-hidden bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={formThumbnailUrl} alt={t('portfolio.previewAlt', 'Preview')} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormThumbnailUrl('')}
                        className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                >
                  {t('common.cancel', 'Cancelar')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-primary/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('portfolio.updateModel', 'Atualizar Modelo')}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {portfolioTab === 'models' ? (
        <>
          {/* Search and Filters */}
          {items.length > 0 && (
            <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 border border-border rounded-2xl shadow-sm">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('portfolio.searchPlaceholder', 'Buscar no portfólio por título ou descrição...')}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted border border-border text-sm outline-none focus:ring-2 focus:ring-primary/40 transition"
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto overflow-x-auto shrink-0">
                {['all', 'makerworld', 'generated_lb', 'manual'].map((source) => {
                  const label =
                    source === 'all' ? t('portfolio.filterAll', 'Todos') :
                    source === 'makerworld' ? 'MakerWorld' :
                    source === 'generated_lb' ? t('portfolio.sourceLbStudio', 'LB Studio') : t('portfolio.sourceManual', 'Manual')
                  return (
                    <button
                      key={source}
                      onClick={() => setSourceFilter(source)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                        sourceFilter === source
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-2xl bg-muted/20">
              <Box className="w-16 h-16 text-muted-foreground/30 mb-4 animate-pulse" />
              <h3 className="text-xl font-bold text-foreground mb-2">{t('portfolio.emptyTitle', 'Seu portfólio está vazio')}</h3>
              <p className="text-muted-foreground max-w-md text-sm mb-6">
                {t('portfolio.emptySubtitle', 'Comece importando um link do MakerWorld ou cadastre seus próprios modelos 3D manualmente.')}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    resetForm()
                    setIsCreateModalOpen(true)
                  }}
                  className="bg-secondary text-secondary-foreground px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-secondary/80 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t('portfolio.registerManually', 'Cadastrar Manualmente')}
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                  <Plus className="w-4 h-4" />
                  {t('portfolio.importMakerWorld', 'Importar MakerWorld')}
                </button>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
              <Box className="w-12 h-12 opacity-20 mb-3 text-primary animate-bounce" />
              <p className="font-bold text-sm text-foreground">{t('portfolio.noResultsTitle', 'Nenhum item atende aos filtros de busca.')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('portfolio.noResultsSubtitle', 'Tente ajustar a pesquisa textual ou os filtros de origem.')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="group bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-all hover:shadow-lg flex flex-col cursor-pointer"
                  onClick={() => setViewingItem(item)}
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {item.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Box className="w-8 h-8 opacity-20" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                      {item.source_type === 'makerworld' ? 'MakerWorld' : item.source_type === 'manual' ? t('portfolio.sourceManual', 'Manual') : t('portfolio.sourceLbStudio', 'LB Studio')}
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-sm line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-1">
                      {item.description || t('portfolio.noDescriptionShort', 'Sem descrição')}
                    </p>
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <div className="text-xs font-medium text-muted-foreground flex gap-2">
                        <span>⚖️ {item.weight_g}g</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedItem(item)
                        }}
                        className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md text-xs font-bold transition-colors relative z-10"
                      >
                        {t('portfolio.pricingBtn', 'Precificar')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Histórico de Transações */
        <div className="space-y-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={transactionsSearchQuery}
              onChange={(e) => setTransactionsSearchQuery(e.target.value)}
              placeholder={t('portfolio.filterHistoryPlaceholder', 'Filtrar histórico por descrição...')}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loadingTransactions ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                  <Clock size={32} className="opacity-30 animate-pulse" />
                  <span className="text-sm">{t('portfolio.loadingHistory', 'Carregando histórico...')}</span>
                </div>
              </div>
            ) : transactionsError ? (
              <div className="flex items-center justify-center py-20 text-red-500">
                <span className="text-sm">{transactionsError}</span>
              </div>
            ) : transactions.filter(tx => (tx.description ?? '').toLowerCase().includes(transactionsSearchQuery.toLowerCase())).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
                <FileBox size={40} className="opacity-20 mb-3" />
                <p className="font-medium text-sm text-foreground">{t('portfolio.noTransactions', 'Nenhum registro de transação encontrado.')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">{t('portfolio.colDate', 'Data')}</th>
                      <th className="px-6 py-4 font-medium">{t('portfolio.description', 'Descrição')}</th>
                      <th className="px-6 py-4 font-medium text-right">{t('portfolio.colCredits', 'Créditos')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .filter(tx => (tx.description ?? '').toLowerCase().includes(transactionsSearchQuery.toLowerCase()))
                      .map((tx) => (
                        <tr
                          key={tx.id}
                          className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                        >
                          <td className="px-6 py-4 text-muted-foreground whitespace-nowrap text-xs">
                            {new Intl.DateTimeFormat(locale, {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(tx.created_at))}
                          </td>
                          <td className="px-6 py-4 text-foreground font-medium">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${
                                tx.credits_added < 0
                                  ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              }`}>
                                {tx.credits_added < 0 ? t('portfolio.spent', 'Gasto') : t('portfolio.received', 'Recebido')}
                              </span>
                              <span className="truncate max-w-md">
                                {tx.description ?? (tx.credits_added < 0 ? t('portfolio.paidAction', 'Ação paga') : t('portfolio.creditsAdded', 'Créditos adicionados'))}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-bold tabular-nums">
                            <span className={tx.credits_added < 0 ? "text-red-500" : "text-emerald-500"}>
                              {tx.credits_added > 0 ? "+" : ""}{tx.credits_added}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
