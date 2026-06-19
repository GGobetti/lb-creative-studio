'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useConfiguratorStore } from '@/store/store'
import { 
  Calculator, 
  Package, 
  TrendingUp, 
  Printer as PrinterIcon,
  Store,
  Box,
  FileText,
  X,
  UserPlus
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'
import { formatBRL } from '@/lib/format'
import { useTranslation } from '@/lib/translations'

interface PricingCalculatorProps {
  initialWeight?: number
  initialTimeHours?: number
  onSavePrice?: (calculatedPrice: number) => void
  isStandalone?: boolean
}

export function PricingCalculator({
  initialWeight = 0,
  initialTimeHours = 0,
  onSavePrice,
  isStandalone = true,
}: PricingCalculatorProps) {
  const { pricingSettings, setPricingSettings } = useConfiguratorStore()
  const router = useRouter()
  const { t } = useTranslation()

  // Helper to safely parse numbers
  const parseNumeric = (val: any): number => {
    if (val === undefined || val === null) return 0
    if (typeof val === 'string') return parseFloat(val) || 0
    return Number(val) || 0
  }

  // Item Specific Inputs (Local state)
  const [weight, setWeight] = useState(parseNumeric(initialWeight))
  const [hours, setHours] = useState(Math.floor(parseNumeric(initialTimeHours)))
  const [minutes, setMinutes] = useState(Math.round((parseNumeric(initialTimeHours) % 1) * 60))

  // Quotation States
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [quoteTitle, setQuoteTitle] = useState("")
  const [discount, setDiscount] = useState(0)
  const [quoteNotes, setQuoteNotes] = useState("")
  const [isCreatingQuote, setIsCreatingQuote] = useState(false)

  // Quick Customer Creation
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")

  const handleOpenQuoteModal = async () => {
    const supabase = getSupabaseBrowser()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      alert("Faça login para gerar cotações.")
      return
    }
    
    setIsQuoteModalOpen(true)
    setQuoteTitle(isStandalone ? "Cotação de Peças 3D" : "Cotação Personalizada")
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true })
      if (!error && data) {
        setCustomers(data)
        if (data.length > 0) setSelectedCustomerId(data[0].id)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomerName.trim()) return
    const { profile } = useConfiguratorStore.getState()
    if (!profile) return
    
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          user_id: profile.id,
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null
        }])
        .select()
      
      if (!error && data && data.length > 0) {
        setCustomers(prev => [...prev, data[0]].sort((a,b) => a.name.localeCompare(b.name)))
        setSelectedCustomerId(data[0].id)
        setIsNewCustomerModalOpen(false)
        setNewCustomerName("")
        setNewCustomerPhone("")
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveQuote = async () => {
    const { profile } = useConfiguratorStore.getState()
    if (!profile || !selectedCustomerId) return
    
    setIsCreatingQuote(true)
    try {
      const supabase = getSupabaseBrowser()
      const itemTitle = isStandalone ? "Peça Paramétrica" : "Modelo do Portfólio"
      const totalValue = calculations.finalPrice - discount
      
      const { data, error } = await supabase
        .from('quotations')
        .insert([{
          user_id: profile.id,
          customer_id: selectedCustomerId,
          title: quoteTitle.trim() || "Cotação Sem Título",
          items: [{
            name: itemTitle,
            weight_g: weight,
            print_time_hours: hours + minutes / 60,
            calculated_price: calculations.finalPrice,
            quantity: 1
          }],
          discount: discount,
          total_value: totalValue < 0 ? 0 : totalValue,
          status: 'draft',
          notes: quoteNotes.trim() || null
        }])
        .select()
        
      if (error) throw error
      if (data && data.length > 0) {
        router.push(`/dashboard/quotations/${data[0].id}`)
      }
    } catch (err) {
      console.error(err)
      alert("Erro ao criar cotação.")
    } finally {
      setIsCreatingQuote(false)
    }
  }

  // Sync with initial values when they change
  useEffect(() => {
    const w = parseNumeric(initialWeight)
    setWeight(w)
  }, [initialWeight])

  useEffect(() => {
    const t = parseNumeric(initialTimeHours)
    setHours(Math.floor(t))
    setMinutes(Math.round((t % 1) * 60))
  }, [initialTimeHours])

  const handlePrinterSelect = (printerId: string) => {
    setPricingSettings({ selectedPrinterId: printerId })
  }

  const handleMarketplaceSelect = (marketplaceId: string) => {
    setPricingSettings({ selectedMarketplaceId: marketplaceId })
  }

  const handleMaterialSelect = (materialId: string) => {
    setPricingSettings({ selectedMaterialId: materialId })
  }

  // Core Pricing Calculations
  const calculations = useMemo(() => {
    const settings = pricingSettings

    // Find active selections
    const activePrinter = settings.printers?.find(p => p.id === settings.selectedPrinterId) || settings.printers?.[0]
    const activeMaterial = settings.materials?.find(m => m.id === settings.selectedMaterialId) || settings.materials?.[0] || { price: 130, weight: 1000 }
    const activeMarketplace = settings.marketplaces?.find(m => m.id === settings.selectedMarketplaceId) || settings.marketplaces?.[0]

    const machinePrice = activePrinter ? activePrinter.price : settings.machinePrice
    const machineLifeHours = Math.max(1, activePrinter ? activePrinter.lifeHours : settings.machineLifeHours)
    const printerPowerW = activePrinter ? activePrinter.powerW : settings.printerPowerW
    const marketplaceFee = activeMarketplace ? activeMarketplace.feePercent : settings.marketplaceFee

    const safeWeight = Math.max(1, activeMaterial.weight)
    const costPerGram = activeMaterial.price / safeWeight
    const materialCost = costPerGram * weight

    const totalTimeHours = hours + minutes / 60
    const energyConsumedKwh = (printerPowerW * totalTimeHours) / 1000
    const energyCost = energyConsumedKwh * settings.energyCostPerKwh

    const costPerHour = machinePrice / machineLifeHours
    const wearCost = costPerHour * totalTimeHours

    const prepCost = settings.prepTimeHours * settings.prepRate

    const baseCostRaw = materialCost + energyCost + wearCost + prepCost
    const failureCost = baseCostRaw * (settings.failureMargin / 100)
    const totalProductionCost = baseCostRaw + failureCost

    const profitValue = totalProductionCost * (settings.profitMarginPercent / 100)
    const priceWithProfit = totalProductionCost + profitValue

    const feePercentage = (marketplaceFee + settings.taxes) / 100
    const finalPrice = feePercentage >= 1 ? priceWithProfit : priceWithProfit / (1 - feePercentage)

    const feesValue = finalPrice * (marketplaceFee / 100)
    const taxesValue = finalPrice * (settings.taxes / 100)

    return {
      material: materialCost,
      energy: energyCost,
      wear: wearCost,
      prep: prepCost,
      failure: failureCost,
      totalCost: totalProductionCost,
      profit: profitValue,
      fees: feesValue + taxesValue,
      finalPrice: finalPrice
    }
  }, [
    weight, hours, minutes,
    pricingSettings
  ])

  return (
    <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="bg-muted px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-base md:text-lg">
            {isStandalone ? t('calculator.titleStandalone', 'Calculadora Livre de Precificação') : t('calculator.titleLinked', 'Precificar Modelo do Portfólio')}
          </h2>
        </div>
        {!isStandalone && (
          <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary font-bold rounded-full">
            {t('calculator.linkedMode', 'Modo Vinculado')}
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row">
        
        {/* Main Content: Piece Data & Results */}
        <div className="flex-1 p-6 flex flex-col md:flex-row gap-8">
          
          {/* Piece Inputs & Selectors */}
          <div className="flex-1 space-y-6">
            
            {/* Context Selectors */}
            <div className="bg-muted/30 p-5 rounded-xl border border-border/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  {t('calculator.baseConfig', 'Configuração Base')}
                </h3>
                {isStandalone && (
                  <Link href="/dashboard/settings" className="text-xs font-bold text-primary hover:underline">
                    {t('calculator.globalOptions', 'Editar opções globais')}
                  </Link>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <PrinterIcon className="w-3.5 h-3.5 text-blue-500" /> {t('calculator.printer', 'Impressora')}
                  </label>
                  <select
                    value={pricingSettings.selectedPrinterId}
                    onChange={(e) => handlePrinterSelect(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                  >
                    {(pricingSettings.printers || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-orange-500" /> {t('calculator.material', 'Material')}
                  </label>
                  <select
                    value={pricingSettings.selectedMaterialId}
                    onChange={(e) => handleMaterialSelect(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                  >
                    {(pricingSettings.materials || []).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-purple-500" /> {t('calculator.channel', 'Canal')}
                  </label>
                  <select
                    value={pricingSettings.selectedMarketplaceId}
                    onChange={(e) => handleMarketplaceSelect(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                  >
                    {(pricingSettings.marketplaces || []).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 p-5 rounded-xl border border-border/60 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-violet-500" /> {t('calculator.itemSpecs', 'Dados Específicos da Peça')}
              </h3>
              
              <div className="space-y-5">
                {/* Weight */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t('calculator.weight', 'Peso Total (g)')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={weight === 0 ? '' : weight}
                    onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-primary outline-none transition-shadow text-foreground"
                    placeholder={t('calculator.weightPlaceholder', 'Ex: 50')}
                  />
                  <p className="text-[11px] text-muted-foreground">{t('calculator.weightDesc', 'Inclua suportes e purgas no peso total.')}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Time Hours */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">{t('calculator.timeHours', 'Tempo (Horas)')}</label>
                    <input
                      type="number"
                      min="0"
                      value={hours === 0 && minutes !== 0 ? 0 : (hours === 0 ? '' : hours)}
                      onChange={(e) => setHours(parseInt(e.target.value) || 0)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-primary outline-none transition-shadow text-foreground"
                      placeholder={t('calculator.timeHoursPlaceholder', 'Ex: 2')}
                    />
                  </div>

                  {/* Time Minutes */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">{t('calculator.timeMinutes', 'Tempo (Minutos)')}</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={minutes === 0 && hours !== 0 ? 0 : (minutes === 0 ? '' : minutes)}
                      onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-primary outline-none transition-shadow text-foreground"
                      placeholder={t('calculator.timeMinutesPlaceholder', 'Ex: 30')}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {!isStandalone && onSavePrice && (
              <button
                onClick={() => onSavePrice(calculations.finalPrice)}
                className="w-full bg-primary hover:opacity-95 text-primary-foreground font-black py-4 px-4 rounded-xl text-base transition-all shadow-lg shadow-primary/25 cursor-pointer"
              >
                {t('calculator.saveToPortfolio', 'Salvar Preço no Item')}
              </button>
            )}
          </div>

          {/* Results Summary */}
          <div className="w-full md:w-[320px] lg:w-[340px]">
            <div className="bg-card border border-border rounded-xl p-5 md:p-6 sticky top-6 shadow-sm space-y-6">
              <h3 className="text-sm font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
                <TrendingUp className="text-primary w-4.5 h-4.5" /> {t('calculator.costDetail', 'Detalhamento do Custo')}
              </h3>

              {/* Calculations items */}
              <div className="space-y-3 text-xs text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>{t('calculator.costMaterial', 'Material')}</span>
                  <span className="font-semibold text-foreground">{formatBRL(calculations.material)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{t('calculator.costEnergy', 'Energia consumida')}</span>
                  <span className="font-semibold text-foreground">{formatBRL(calculations.energy)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{t('calculator.costWear', 'Depreciação Máquina')}</span>
                  <span className="font-semibold text-foreground">{formatBRL(calculations.wear)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{t('calculator.costLabor', 'Mão de Obra')}</span>
                  <span className="font-semibold text-foreground">{formatBRL(calculations.prep)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{t('calculator.costFailure', 'Falhas Estimadas')}</span>
                  <span className="font-semibold text-foreground">{formatBRL(calculations.failure)}</span>
                </div>
                
                <div className="pt-3 mt-1 border-t border-border flex justify-between items-center text-sm font-bold text-foreground">
                  <span>{t('calculator.productionCost', 'Custo de Produção')}</span>
                  <span>{formatBRL(calculations.totalCost)}</span>
                </div>

                <div className="flex justify-between items-center text-emerald-500 pt-1">
                  <span>{t('calculator.expectedProfit', 'Lucro Líquido Esperado')}</span>
                  <span className="font-semibold">{formatBRL(calculations.profit)}</span>
                </div>
                
                <div className="flex justify-between items-center text-red-400">
                  <span>{t('calculator.feesTaxes', 'Taxas & Impostos')}</span>
                  <span className="font-semibold">{formatBRL(calculations.fees)}</span>
                </div>
              </div>

              {/* Suggested Selling Price Badge */}
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 text-center shadow-inner mt-4">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider block mb-1">
                  {t('calculator.suggestedPrice', 'Preço Sugerido')}
                </span>
                <span className="text-3xl font-black text-foreground block tracking-tight">
                  {formatBRL(calculations.finalPrice)}
                </span>
              </div>

              {/* Gerar Cotação Button */}
              <button
                onClick={handleOpenQuoteModal}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/15 cursor-pointer"
              >
                <FileText size={16} />
                {t('calculator.generateQuote', 'Gerar Cotação')}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Quote Creation Modal */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                {t('calculator.newQuote', 'Criar Nova Cotação')}
              </h3>
              <button
                onClick={() => setIsQuoteModalOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t('calculator.quoteTitle', 'Título da Cotação')}</label>
                <input
                  type="text"
                  value={quoteTitle}
                  onChange={(e) => setQuoteTitle(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                  placeholder={t('calculator.quoteTitlePlaceholder', 'Ex: Cotação Placa Casamento')}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-muted-foreground">{t('calculator.client', 'Cliente *')}</label>
                  <button
                    onClick={() => setIsNewCustomerModalOpen(true)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <UserPlus size={11} />
                    {t('calculator.quickRegister', 'Cadastrar Rápido')}
                  </button>
                </div>
                {customers.length === 0 ? (
                  <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg border border-dashed border-border text-center">
                    {t('calculator.noClients', 'Nenhum cliente cadastrado. Use o botão acima para cadastrar.')}
                  </div>
                ) : (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg pl-3 pr-8 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 cursor-pointer"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-card text-foreground">
                        {c.name} {c.phone ? `(${c.phone})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t('calculator.unitBaseValue', 'Valor Unitário Base')}</label>
                  <div className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground">
                    {formatBRL(calculations.finalPrice)}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t('calculator.commercialDiscount', 'Desconto Comercial (R$)')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount === 0 ? "" : discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    placeholder={t('calculator.discountPlaceholder', 'Ex: 10.00')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t('calculator.notes', 'Notas / Condições de Venda')}</label>
                <textarea
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none"
                  placeholder={t('calculator.notesPlaceholder', 'Ex: Entrega em 5 dias. Válido por 10 dias.')}
                />
              </div>

              <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl flex justify-between items-center text-sm">
                <span className="font-bold text-muted-foreground">{t('calculator.totalNetValue', 'Valor Total Líquido:')}</span>
                <span className="text-xl font-black text-primary">
                  {formatBRL(Math.max(0, calculations.finalPrice - discount))}
                </span>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-muted border border-border text-xs text-muted-foreground hover:bg-accent cursor-pointer"
                >
                  {t('common.cancel', 'Cancelar')}
                </button>
                <button
                  onClick={handleSaveQuote}
                  disabled={isCreatingQuote || !selectedCustomerId || !quoteTitle.trim()}
                  className="px-4 py-2 rounded-lg bg-primary hover:opacity-95 text-xs text-primary-foreground font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingQuote ? t('calculator.generating', 'Gerando...') : t('calculator.generateBtn', 'Confirmar & Visualizar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Customer Creation Modal */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <h4 className="text-md font-bold text-foreground flex items-center gap-1.5">
                <UserPlus size={16} className="text-primary" />
                {t('calculator.newClientTitle', 'Cadastrar Novo Cliente')}
              </h4>
              <button
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateQuickCustomer} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t('calculator.clientName', 'Nome *')}</label>
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                  placeholder="Ex: João Silva"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t('calculator.clientPhone', 'Telefone / WhatsApp')}</label>
                <input
                  type="text"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                  placeholder={t('calculator.clientPhonePlaceholder', 'Ex: (11) 99999-9999')}
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-muted border border-border text-xs text-muted-foreground hover:bg-accent cursor-pointer"
                >
                  {t('common.cancel', 'Cancelar')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary hover:opacity-95 text-xs text-primary-foreground font-bold cursor-pointer"
                >
                  {t('common.save', 'Salvar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
