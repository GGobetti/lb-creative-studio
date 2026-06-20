'use client'

import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Link as LinkIcon, Download, Loader2 } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useAppStore } from '@/store/store'
import { DotMatrixLoader } from '@/components/ui/DotMatrixLoader'

interface MakerWorldImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportSuccess?: () => void
}

export function MakerWorldImportModal({ open, onOpenChange, onImportSuccess }: MakerWorldImportModalProps) {
  const { profile, refreshCredits } = useAppStore()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [featureCost, setFeatureCost] = useState<number | null>(null)
  
  // Scraped Data State
  const [scrapedData, setScrapedData] = useState<{
    title: string;
    thumbnail_url: string;
    description: string;
    printProfiles: any[];
  } | null>(null)

  React.useEffect(() => {
    if (!open || !profile) return
    const getCost = async () => {
      try {
        const supabase = getSupabaseBrowser()
        const { data, error } = await supabase
          .from('feature_costs')
          .select('*')
          .eq('feature_key', 'import_makerworld')
          .single()
        if (!error && data) {
          const plan = profile.plan || 'free'
          const cost = plan === 'max' 
            ? data.cost_max 
            : plan === 'pro' 
              ? data.cost_pro 
              : data.cost_free
          setFeatureCost(cost)
        }
      } catch (err) {
        console.error('Error fetching makerworld feature cost:', err)
      }
    }
    getCost()
  }, [open, profile])

  const plan = profile?.plan || 'free'
  const cost = profile?.role === 'sysadmin' 
    ? 0 
    : (featureCost !== null 
      ? featureCost 
      : plan === 'max' 
        ? 0 
        : plan === 'pro' 
          ? 1 
          : 2)

  
  const [selectedProfileIndex, setSelectedProfileIndex] = useState<number | null>(null)

  const handleFetch = async () => {
    if (!url.includes('makerworld.com')) {
      setError('Por favor, insira um link válido do MakerWorld.')
      return
    }
    
    setLoading(true)
    setError('')
    setScrapedData(null)
    setSelectedProfileIndex(null)

    try {
      const res = await fetch('/api/import/makerworld', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao importar')
      }

      setScrapedData(data)
      if (data.printProfiles && data.printProfiles.length > 0) {
        setSelectedProfileIndex(0)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToPortfolio = async () => {
    if (!scrapedData) return

    setLoading(true)
    setError('')
    try {
      if (profile && profile.credits < cost) {
        throw new Error(`Créditos insuficientes. Esta operação custa ${cost} crédito${cost !== 1 ? 's' : ''}. Saldo atual: ${profile.credits}`)
      }
      const supabase = getSupabaseBrowser()
      let session = null
      try {
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
        const res = await Promise.race([sessionPromise, timeoutPromise]) as any
        session = res?.data?.session
      } catch (e) {
        console.warn('getSession timed out or failed in import modal, trying localStorage fallback...', e)
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
            console.error('Failed to parse fallback session from localStorage in import modal', err)
          }
        }
      }
      
      const userId = session?.user?.id
      const accessToken = session?.access_token
      
      if (!userId || !accessToken) {
        throw new Error('Usuário não autenticado no sistema (tente recarregar a página)')
      }

      let weight_g = 0
      let print_time_hours = 0

      if (selectedProfileIndex !== null && scrapedData.printProfiles[selectedProfileIndex]) {
        const profileVal = scrapedData.printProfiles[selectedProfileIndex]
        weight_g = profileVal.weight || 0
        print_time_hours = profileVal.timeHours || 0
      }

      // Deduct credits calling Edge Function
      const deductRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deduct-credits`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ feature_key: 'import_makerworld' }),
        },
      )

      const deductJson = await deductRes.json()

      if (!deductRes.ok) {
        if (deductJson.error === 'INSUFFICIENT_CREDITS') {
          throw new Error('Créditos insuficientes.')
        }
        throw new Error(deductJson.error || 'Erro ao descontar créditos.')
      }

      refreshCredits(deductJson.remaining)

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Erro de configuração do servidor')
      }

      const insertData = {
        user_id: userId,
        title: scrapedData.title,
        description: scrapedData.description,
        thumbnail_url: scrapedData.thumbnail_url,
        source_type: 'makerworld',
        external_url: url,
        weight_g,
        print_time_hours,
        metadata: {
          creator: (scrapedData as any).creator,
          likeCount: (scrapedData as any).likeCount,
          downloadCount: (scrapedData as any).downloadCount,
          collectionCount: (scrapedData as any).collectionCount,
          printCount: (scrapedData as any).printCount,
          license: (scrapedData as any).license,
          tags: (scrapedData as any).tags,
          pictures: (scrapedData as any).pictures,
        }
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/portfolio_items`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(insertData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erro do banco de dados: ${errorText}`)
      }

      onOpenChange(false)
      if (onImportSuccess) onImportSuccess()
      
    } catch (err: any) {
      console.error('Erro ao salvar no portfolio:', err)
      setError(err?.message || err?.error_description || String(err) || 'Erro desconhecido ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-2xl">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <Dialog.Title className="text-lg font-bold">Importar do MakerWorld</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Cole o link do modelo 3D para puxar as fotos e calcular o preço.
            </Dialog.Description>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://makerworld.com/en/models/..."
                className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleFetch}
              disabled={loading || !url}
              className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center min-w-[100px] disabled:opacity-50"
            >
              {loading && !scrapedData ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
            </button>
          </div>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

          {loading && !scrapedData && (
            <div className="py-8 border border-dashed border-border rounded-xl mt-4">
              <DotMatrixLoader text="Conectando à Bambu Lab API e extraindo metadados..." />
            </div>
          )}

          {scrapedData && (
            <div className="mt-4 border border-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              <div className="flex gap-4 p-4 bg-muted/50">
                {scrapedData.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={scrapedData.thumbnail_url}
                    alt={scrapedData.title}
                    className="w-24 h-24 object-cover rounded-lg border border-border"
                  />
                ) : (
                  <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center border border-border">
                    <span className="text-xs text-muted-foreground">Sem Foto</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm truncate">{scrapedData.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-3 mt-1">
                    {scrapedData.description}
                  </p>
                </div>
              </div>

              {/* Profiles Selection Area */}
              <div className="p-4 border-t border-border bg-background">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Perfis de Impressão Encontrados
                </h5>
                {scrapedData.printProfiles.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {scrapedData.printProfiles.map((profile, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedProfileIndex(i)}
                        className={`
                          p-3 rounded-lg border cursor-pointer transition-colors text-sm
                          ${selectedProfileIndex === i ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}
                        `}
                      >
                        <div className="font-medium">{profile.name || `Perfil ${i + 1}`}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                          <span>⚖️ {profile.weight || 0}g</span>
                          <span>⏱️ {profile.timeHours || 0}h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg text-center">
                    Nenhum perfil de impressão extraído automaticamente. Você poderá inserir o peso manualmente.
                  </div>
                )}
              </div>

              <div className="p-4 bg-card border-t border-border flex justify-end">
                <button
                  onClick={handleSaveToPortfolio}
                  disabled={loading}
                  className="bg-foreground text-background px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-foreground/90 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Salvar no Portfólio
                </button>
              </div>
            </div>
          )}

          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
