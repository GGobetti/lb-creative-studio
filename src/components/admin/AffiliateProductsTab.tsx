'use client';

import { useEffect, useState } from 'react';
import { fetchAffiliateProducts, AffiliateProduct } from '@/lib/api/affiliate';
import { AffiliateProductForm } from './AffiliateProductForm';
import { AffiliateProductsList } from './AffiliateProductsList';
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
    setShowMarketplaceSelector(false);
    // Only Mercado Livre import is supported via API
    // Other marketplaces can be created via ML API in the future
  };

  return (
    <div className="space-y-6">
      {/* Marketplace Selector Modal */}
      {showMarketplaceSelector && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Importar Produto</h3>
            <p className="text-sm text-slate-400 mb-4">Atualmente, apenas Mercado Livre permite importação via API. Outros marketplaces podem ser adicionados no futuro.</p>
            <button
              onClick={() => handleMarketplaceSelect('mercado_livre')}
              className="w-full text-left px-4 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 rounded transition border border-cyan-500/50"
            >
              <div className="font-medium text-cyan-300">🇧🇷 Mercado Livre</div>
              <div className="text-xs text-slate-400">Cole o link do produto para importar dados automaticamente</div>
            </button>
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
      {selectedMarketplace === 'mercado_livre' && (
        <div className="glass-panel p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Importar do Mercado Livre</h3>
          <MercadoLivreImportForm
            onSuccess={() => {
              setSelectedMarketplace(null);
              loadProducts();
            }}
          />
          <button
            onClick={() => setSelectedMarketplace(null)}
            className="mt-4 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
          >
            ← Voltar
          </button>
        </div>
      )}

      {/* Edit Form */}
      {editingProduct && showForm && (
        <div className="glass-panel p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Editar Produto</h3>
          <AffiliateProductForm
            product={editingProduct}
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
