'use client'

import React, { useState, useEffect } from 'react'
import { useAppStore, Printer, Marketplace, Material } from '@/store/store'
import { Settings, Printer as PrinterIcon, Store, Box, Trash2, Plus, Zap, Percent, Clock, Pencil, Check } from 'lucide-react'
import { useTranslation } from '@/lib/translations'
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="bg-card rounded-2xl shadow-xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="bg-orange-500/20 p-2 rounded-lg text-orange-500">
              <Box size={20} />
            </div>
            <h2 className="font-bold text-lg">{t('settingsManager.filamentsMaterials', 'Filamentos / Materiais')}</h2>
          </div>
          
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {(settings.materials || []).map((m) => (
              <div key={m.id} className="flex justify-between items-center bg-muted/50 p-3 rounded-xl border border-border text-sm">
                <div>
                  <div className="font-bold text-foreground flex items-center gap-2">
                    {m.name}
                    {settings.selectedMaterialId === m.id && (
                      <span className="text-[9px] uppercase font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{t('settingsManager.default', 'Padrão')}</span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs mt-1">
                    {formatBRL(m.price)} {t('settingsManager.per', 'por')} {m.weight}g
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => handleEditMaterial(m)} className="text-blue-500 hover:bg-blue-500/10 p-2 rounded-md transition-colors"><Pencil size={14} /></button>
                  <button type="button" onClick={() => handleRemoveMaterial(m.id)} disabled={settings.materials.length <= 1} className="text-red-500 hover:bg-red-500/10 disabled:opacity-50 p-2 rounded-md transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-muted/30 p-4 rounded-xl border border-border/80 space-y-3">
            <h4 className="text-xs font-bold text-foreground">{editingMaterialId ? t('settingsManager.editMaterial', 'Editar Material') : t('settingsManager.newMaterial', 'Novo Material')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2"><label className="text-xs text-muted-foreground">{t('settingsManager.materialName', 'Nome do Material')}</label><input type="text" placeholder={t('settingsManager.materialNamePlaceholder', 'Ex: PLA+ Azul')} value={newMaterial.name} onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" /></div>
              <div className="space-y-1"><label className="text-xs text-muted-foreground">{t('settingsManager.spoolPrice', 'Valor do Rolo (R$)')}</label><input type="number" placeholder={t('settingsManager.spoolPricePlaceholder', 'Ex: 130')} value={newMaterial.price || ''} onChange={(e) => setNewMaterial({ ...newMaterial, price: parseFloat(e.target.value) || 0 })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" /></div>
              <div className="space-y-1"><label className="text-xs text-muted-foreground">{t('settingsManager.spoolWeight', 'Peso do Rolo (g)')}</label><div className="flex gap-2"><input type="number" placeholder={t('settingsManager.spoolWeightPlaceholder', 'Ex: 1000')} value={newMaterial.weight || ''} onChange={(e) => setNewMaterial({ ...newMaterial, weight: parseInt(e.target.value) || 0 })} className="w-full flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" /><button onClick={handleAddMaterial} className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 rounded-lg text-sm font-bold flex items-center justify-center shrink-0">{editingMaterialId ? <Check size={16} /> : <Plus size={16} />}</button></div></div>
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
            <h2 className="font-bold text-lg">{t('settingsManager.salesChannels', 'Canais de Venda')}</h2>
          </div>
          
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {(settings.marketplaces || []).map((m) => (
              <div key={m.id} className="flex justify-between items-center bg-muted/50 p-3 rounded-xl border border-border text-sm">
                <div>
                  <div className="font-bold text-foreground flex items-center gap-2">
                    {m.name}
                    {settings.selectedMarketplaceId === m.id && (
                      <span className="text-[9px] uppercase font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{t('settingsManager.default', 'Padrão')}</span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs mt-1">
                    {t('settingsManager.fee', 'Taxa')}: {m.feePercent}%
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => handleEditMarketplace(m)} className="text-blue-500 hover:bg-blue-500/10 p-2 rounded-md transition-colors"><Pencil size={14} /></button>
                  <button type="button" onClick={() => handleRemoveMarketplace(m.id)} disabled={settings.marketplaces.length <= 1} className="text-red-500 hover:bg-red-500/10 disabled:opacity-50 p-2 rounded-md transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-muted/30 p-4 rounded-xl border border-border/80 space-y-3">
            <h4 className="text-xs font-bold text-foreground">{editingMarketplaceId ? t('settingsManager.editChannel', 'Editar Canal') : t('settingsManager.newChannel', 'Novo Canal de Venda')}</h4>
            <div className="flex gap-2">
              <div className="space-y-1 flex-1"><label className="text-xs text-muted-foreground">{t('settingsManager.channelName', 'Nome do Canal')}</label><input type="text" placeholder={t('settingsManager.channelNamePlaceholder', 'Ex: Cults3D')} value={newMarketplace.name} onChange={(e) => setNewMarketplace({ ...newMarketplace, name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" /></div>
              <div className="space-y-1"><label className="text-xs text-muted-foreground">{t('settingsManager.feePercent', 'Taxa (%)')}</label><div className="flex gap-2"><input type="number" placeholder={t('settingsManager.feePercentPlaceholder', 'Ex: 10')} value={newMarketplace.feePercent || ''} onChange={(e) => setNewMarketplace({ ...newMarketplace, feePercent: parseFloat(e.target.value) || 0 })} className="w-24 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" /><button onClick={handleAddMarketplace} className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 rounded-lg text-sm font-bold flex items-center justify-center shrink-0 mt-auto">{editingMarketplaceId ? <Check size={16} /> : <Plus size={16} />}</button></div></div>
            </div>
          </div>
        </div>

        {/* Global Costs and Margins */}
        <div className="bg-card rounded-2xl shadow-xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-500">
              <Settings size={20} />
            </div>
            <h2 className="font-bold text-lg">{t('settingsManager.defaultCostsMargins', 'Custos & Margens Padrão')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Zap size={14} className="text-yellow-500"/> {t('settingsManager.energyCost', 'Energia (R$/kWh)')}
                </label>
                <input type="number" step="0.01" value={settings.energyCostPerKwh} onChange={(e) => handleSettingChange('energyCostPerKwh', parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-500"/> {t('settingsManager.laborRate', 'Valor Mão de Obra (R$/h)')}
                </label>
                <input type="number" value={settings.prepRate} onChange={(e) => handleSettingChange('prepRate', parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {t('settingsManager.defaultPrepTime', 'Tempo Padrão de Preparo (h)')}
                </label>
                <input type="number" step="0.1" value={settings.prepTimeHours} onChange={(e) => handleSettingChange('prepTimeHours', parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Percent size={14} className="text-green-500"/> {t('settingsManager.profitMargin', 'Margem de Lucro (%)')}
                </label>
                <input type="number" value={settings.profitMarginPercent} onChange={(e) => handleSettingChange('profitMarginPercent', parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {t('settingsManager.failureMargin', 'Margem de Falha (%)')}
                </label>
                <input type="number" value={settings.failureMargin} onChange={(e) => handleSettingChange('failureMargin', parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {t('settingsManager.salesTax', 'Impostos de Venda (%)')}
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
