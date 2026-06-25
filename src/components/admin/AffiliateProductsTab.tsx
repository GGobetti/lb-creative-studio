'use client';

import { useEffect, useState } from 'react';
import { fetchAffiliateProducts, AffiliateProduct } from '@/lib/api/affiliate';
import { AffiliateProductForm } from './AffiliateProductForm';
import { AffiliateProductsList } from './AffiliateProductsList';
import { MercadoLivreConnect } from './MercadoLivreConnect';
import { MercadoLivreImportForm } from './MercadoLivreImportForm';

type Marketplace = 'mercado_livre' | 'aliexpress' | 'shopee' | 'amazon';

export function AffiliateProductsTab() {
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<AffiliateProduct | null>(
    null
  );
  const [showForm, setShowForm] = useState(false);
  const [showMarketplaceSelector, setShowMarketplaceSelector] = useState(false);
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace | null>(null);
  const [mlConnected, setMlConnected] = useState(false);

  const loadProducts = async () => {
    try {
      const data = await fetchAffiliateProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleFormSuccess = () => {
    setEditingProduct(null);
    setShowForm(false);
    loadProducts();
  };

  const handleFormCancel = () => {
    setEditingProduct(null);
    setShowForm(false);
    setSelectedMarketplace(null);
    setShowMarketplaceSelector(false);
  };

  const handleMarketplaceSelect = (marketplace: Marketplace) => {
    setSelectedMarketplace(marketplace);
    if (marketplace === 'mercado_livre') {
      setShowMarketplaceSelector(false);
      // MercadoLivreImportForm will be shown
    } else {
      setShowForm(true);
      setShowMarketplaceSelector(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mercado Livre Integration */}
      <MercadoLivreConnect />

      {/* Marketplace Selector Modal */}
      {showMarketplaceSelector && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Selecione o Marketplace</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleMarketplaceSelect('mercado_livre')}
                className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded transition"
              >
                <div className="font-medium">🇧🇷 Mercado Livre</div>
                <div className="text-xs text-slate-400">Cole o link do produto</div>
              </button>
              <button
                onClick={() => handleMarketplaceSelect('aliexpress')}
                className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded transition"
              >
                <div className="font-medium">🌐 AliExpress</div>
                <div className="text-xs text-slate-400">Preencher dados manualmente</div>
              </button>
              <button
                onClick={() => handleMarketplaceSelect('shopee')}
                className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded transition"
              >
                <div className="font-medium">🛒 Shopee</div>
                <div className="text-xs text-slate-400">Preencher dados manualmente</div>
              </button>
              <button
                onClick={() => handleMarketplaceSelect('amazon')}
                className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded transition"
              >
                <div className="font-medium">📦 Amazon</div>
                <div className="text-xs text-slate-400">Preencher dados manualmente</div>
              </button>
            </div>
            <button
              onClick={() => setShowMarketplaceSelector(false)}
              className="w-full mt-4 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Mercado Livre Import Form */}
      {selectedMarketplace === 'mercado_livre' && !showForm && (
        <div className="glass-panel p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Importar do Mercado Livre</h3>
          <MercadoLivreImportForm
            isConnected={mlConnected}
            onSuccess={() => {
              setSelectedMarketplace(null);
              loadProducts();
            }}
          />
          <button
            onClick={() => {
              setSelectedMarketplace(null);
              setShowMarketplaceSelector(true);
            }}
            className="mt-4 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
          >
            ← Voltar
          </button>
        </div>
      )}

      {/* Create/Edit Form for Manual Entry */}
      {showForm && (
        <div className="glass-panel p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">
            {editingProduct ? 'Editar Produto' : `Novo Produto - ${selectedMarketplace?.replace('_', ' ').toUpperCase()}`}
          </h3>
          <AffiliateProductForm
            product={editingProduct || undefined}
            marketplace={selectedMarketplace as any}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {/* List */}
      <div className="glass-panel p-6 rounded-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Produtos Afiliados</h3>
          {!showForm && !showMarketplaceSelector && selectedMarketplace === null && (
            <button
              onClick={() => setShowMarketplaceSelector(true)}
              className="px-4 py-2 bg-cyan-500 text-white rounded font-medium hover:bg-cyan-600"
            >
              + Novo Produto
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-slate-400">
            Carregando produtos...
          </div>
        ) : (
          <AffiliateProductsList
            products={products}
            onEdit={(product) => {
              setEditingProduct(product);
              setShowForm(true);
            }}
            onProductsChange={loadProducts}
          />
        )}
      </div>
    </div>
  );
}
