'use client'

import React, { useState, useEffect } from 'react'
import { useConfiguratorStore, Printer, Marketplace, Material } from '@/store/store'
import { Settings, Printer as PrinterIcon, Store, Box, Trash2, Plus, Zap, Percent, Clock } from 'lucide-react'

export function SettingsManager() {
  const { pricingSettings, setPricingSettings } = useConfiguratorStore()
  const [settings, setSettings] = useState(pricingSettings)

  useEffect(() => {
    setSettings(pricingSettings)
  }, [pricingSettings])

  const handleSettingChange = (key: keyof typeof pricingSettings, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    setPricingSettings({ [key]: value })
  }

  // Helper to safely parse numbers
  const parseNumeric = (val: any): number => {
    if (val === undefined || val === null) return 0
    if (typeof val === 'string') return parseFloat(val) || 0
    return Number(val) || 0
  }

  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  // ── Printers ──
  const [newPrinter, setNewPrinter] = useState({ name: '', powerW: 300, price: 2000, lifeHours: 5000 })
  const handleAddPrinter = () => {
    if (!newPrinter.name.trim()) return
    const printerToAdd: Printer = {
      id: `printer-${Date.now()}`,
      name: newPrinter.name,
      powerW: parseNumeric(newPrinter.powerW),
      price: parseNumeric(newPrinter.price),
      lifeHours: parseNumeric(newPrinter.lifeHours)
    }
    const updated = [...(settings.printers || []), printerToAdd]
    handleSettingChange('printers', updated)
    if (!settings.selectedPrinterId) handleSettingChange('selectedPrinterId', printerToAdd.id)
    setNewPrinter({ name: '', powerW: 300, price: 2000, lifeHours: 5000 })
  }
  const handleRemovePrinter = (id: string) => {
    const updated = (settings.printers || []).filter(p => p.id !== id)
    handleSettingChange('printers', updated)
    if (settings.selectedPrinterId === id && updated.length > 0) {
      handleSettingChange('selectedPrinterId', updated[0].id)
    }
  }

  // ── Marketplaces ──
  const [newMarketplace, setNewMarketplace] = useState({ name: '', feePercent: 10 })
  const handleAddMarketplace = () => {
    if (!newMarketplace.name.trim()) return
    const mktToAdd: Marketplace = {
      id: `mkt-${Date.now()}`,
      name: newMarketplace.name,
      feePercent: parseNumeric(newMarketplace.feePercent)
    }
    const updated = [...(settings.marketplaces || []), mktToAdd]
    handleSettingChange('marketplaces', updated)
    if (!settings.selectedMarketplaceId) handleSettingChange('selectedMarketplaceId', mktToAdd.id)
    setNewMarketplace({ name: '', feePercent: 10 })
  }
  const handleRemoveMarketplace = (id: string) => {
    const updated = (settings.marketplaces || []).filter(m => m.id !== id)
    handleSettingChange('marketplaces', updated)
    if (settings.selectedMarketplaceId === id && updated.length > 0) {
      handleSettingChange('selectedMarketplaceId', updated[0].id)
    }
  }

  // ── Materials ──
  const [newMaterial, setNewMaterial] = useState({ name: '', price: 130, weight: 1000 })
  const handleAddMaterial = () => {
    if (!newMaterial.name.trim()) return
    const matToAdd: Material = {
      id: `mat-${Date.now()}`,
      name: newMaterial.name,
      price: parseNumeric(newMaterial.price),
      weight: parseNumeric(newMaterial.weight)
    }
    const updated = [...(settings.materials || []), matToAdd]
    handleSettingChange('materials', updated)
    if (!settings.selectedMaterialId) handleSettingChange('selectedMaterialId', matToAdd.id)
    setNewMaterial({ name: '', price: 130, weight: 1000 })
  }
  const handleRemoveMaterial = (id: string) => {
    const updated = (settings.materials || []).filter(m => m.id !== id)
    handleSettingChange('materials', updated)
    if (settings.selectedMaterialId === id && updated.length > 0) {
      handleSettingChange('selectedMaterialId', updated[0].id)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Col 1 */}
      <div className="space-y-8">
        
        {/* Printers */}
        <div className="bg-card rounded-2xl shadow-xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="bg-blue-500/20 p-2 rounded-lg text-blue-500">
              <PrinterIcon size={20} />
            </div>
            <h2 className="font-bold text-lg">Impressoras</h2>
          </div>
          
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {(settings.printers || []).map((p) => (
              <div key={p.id} className="flex justify-between items-center bg-muted/50 p-3 rounded-xl border border-border text-sm">
                <div>
                  <div className="font-bold text-foreground flex items-center gap-2">
                    {p.name}
                    {settings.selectedPrinterId === p.id && (
                      <span className="text-[9px] uppercase font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">Padrão</span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs mt-1">
                    {p.powerW}W · {formatBRL(p.price)} · {p.lifeHours}h úteis
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePrinter(p.id)}
                  disabled={settings.printers.length <= 1}
                  className="text-red-500 hover:bg-red-500/10 disabled:opacity-50 p-2 rounded-md transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-muted/30 p-4 rounded-xl border border-border/80 space-y-3">
            <h4 className="text-xs font-bold text-foreground">Nova Impressora</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="text" placeholder="Nome" value={newPrinter.name} onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
              <input type="number" placeholder="Consumo (W)" value={newPrinter.powerW || ''} onChange={(e) => setNewPrinter({ ...newPrinter, powerW: parseInt(e.target.value) || 0 })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
              <input type="number" placeholder="Valor (R$)" value={newPrinter.price || ''} onChange={(e) => setNewPrinter({ ...newPrinter, price: parseFloat(e.target.value) || 0 })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
              <div className="flex gap-2">
                <input type="number" placeholder="Vida útil (h)" value={newPrinter.lifeHours || ''} onChange={(e) => setNewPrinter({ ...newPrinter, lifeHours: parseInt(e.target.value) || 0 })} className="w-full flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
                <button onClick={handleAddPrinter} className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 rounded-lg text-sm font-bold flex items-center justify-center shrink-0">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="bg-card rounded-2xl shadow-xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="bg-orange-500/20 p-2 rounded-lg text-orange-500">
              <Box size={20} />
            </div>
            <h2 className="font-bold text-lg">Filamentos / Materiais</h2>
          </div>
          
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {(settings.materials || []).map((m) => (
              <div key={m.id} className="flex justify-between items-center bg-muted/50 p-3 rounded-xl border border-border text-sm">
                <div>
                  <div className="font-bold text-foreground flex items-center gap-2">
                    {m.name}
                    {settings.selectedMaterialId === m.id && (
                      <span className="text-[9px] uppercase font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">Padrão</span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs mt-1">
                    {formatBRL(m.price)} por {m.weight}g
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMaterial(m.id)}
                  disabled={settings.materials.length <= 1}
                  className="text-red-500 hover:bg-red-500/10 disabled:opacity-50 p-2 rounded-md transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-muted/30 p-4 rounded-xl border border-border/80 space-y-3">
            <h4 className="text-xs font-bold text-foreground">Novo Material</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="text" placeholder="Nome do Material" value={newMaterial.name} onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })} className="w-full md:col-span-2 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
              <input type="number" placeholder="Valor do Rolo (R$)" value={newMaterial.price || ''} onChange={(e) => setNewMaterial({ ...newMaterial, price: parseFloat(e.target.value) || 0 })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
              <div className="flex gap-2">
                <input type="number" placeholder="Peso (g)" value={newMaterial.weight || ''} onChange={(e) => setNewMaterial({ ...newMaterial, weight: parseInt(e.target.value) || 0 })} className="w-full flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
                <button onClick={handleAddMaterial} className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 rounded-lg text-sm font-bold flex items-center justify-center shrink-0">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Col 2 */}
      <div className="space-y-8">

        {/* Marketplaces */}
        <div className="bg-card rounded-2xl shadow-xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="bg-purple-500/20 p-2 rounded-lg text-purple-500">
              <Store size={20} />
            </div>
            <h2 className="font-bold text-lg">Canais de Venda</h2>
          </div>
          
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {(settings.marketplaces || []).map((m) => (
              <div key={m.id} className="flex justify-between items-center bg-muted/50 p-3 rounded-xl border border-border text-sm">
                <div>
                  <div className="font-bold text-foreground flex items-center gap-2">
                    {m.name}
                    {settings.selectedMarketplaceId === m.id && (
                      <span className="text-[9px] uppercase font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">Padrão</span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs mt-1">
                    Taxa: {m.feePercent}%
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMarketplace(m.id)}
                  disabled={settings.marketplaces.length <= 1}
                  className="text-red-500 hover:bg-red-500/10 disabled:opacity-50 p-2 rounded-md transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-muted/30 p-4 rounded-xl border border-border/80 flex gap-2">
            <input type="text" placeholder="Nome do Canal" value={newMarketplace.name} onChange={(e) => setNewMarketplace({ ...newMarketplace, name: e.target.value })} className="w-full flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
            <input type="number" placeholder="Taxa (%)" value={newMarketplace.feePercent || ''} onChange={(e) => setNewMarketplace({ ...newMarketplace, feePercent: parseFloat(e.target.value) || 0 })} className="w-24 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" />
            <button onClick={handleAddMarketplace} className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 rounded-lg text-sm font-bold flex items-center justify-center shrink-0">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Global Costs and Margins */}
        <div className="bg-card rounded-2xl shadow-xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-500">
              <Settings size={20} />
            </div>
            <h2 className="font-bold text-lg">Custos & Margens Padrão</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Zap size={14} className="text-yellow-500"/> Energia (R$/kWh)
                </label>
                <input type="number" step="0.01" value={settings.energyCostPerKwh} onChange={(e) => handleSettingChange('energyCostPerKwh', parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-500"/> Valor Mão de Obra (R$/h)
                </label>
                <input type="number" value={settings.prepRate} onChange={(e) => handleSettingChange('prepRate', parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Tempo Padrão de Preparo (h)
                </label>
                <input type="number" step="0.1" value={settings.prepTimeHours} onChange={(e) => handleSettingChange('prepTimeHours', parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Percent size={14} className="text-green-500"/> Margem de Lucro (%)
                </label>
                <input type="number" value={settings.profitMarginPercent} onChange={(e) => handleSettingChange('profitMarginPercent', parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Margem de Falha (%)
                </label>
                <input type="number" value={settings.failureMargin} onChange={(e) => handleSettingChange('failureMargin', parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Impostos de Venda (%)
                </label>
                <input type="number" value={settings.taxes} onChange={(e) => handleSettingChange('taxes', parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
