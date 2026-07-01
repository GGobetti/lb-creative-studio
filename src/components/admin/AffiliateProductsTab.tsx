'use client';

import { useEffect, useState } from 'react';
import { fetchAffiliateProducts, AffiliateProduct } from '@/lib/api/affiliate';
import { getSupabaseBrowser } from '@/lib/supabase';
import { AffiliateProductForm } from './AffiliateProductForm';
import { AffiliateProductsList } from './AffiliateProductsList';
import { MercadoLivreImportForm } from './MercadoLivreImportForm';
import { useTranslation } from '@/lib/translations';

type Marketplace = 'mercado_livre' | 'aliexpress' | 'shopee' | 'amazon';

export function AffiliateProductsTab() {
  const { t } = useTranslation();
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
  };

  const handleMLAuth = async () => {
    try {
      const supabase = getSupabaseBrowser();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        alert(t('adminAffiliateTab.mustBeAuthenticated', 'Você precisa estar autenticado'));
        return;
      }

      // Redirect to ML authorization
      const response = await fetch(
        `/api/auth/mercado-livre-url?user_id=${userId}`
      );
      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert(t('adminAffiliateTab.authUrlError', 'Erro ao gerar URL de autorização'));
      }
    } catch (err) {
      alert(t('adminAffiliateTab.connectError', 'Erro ao conectar'));
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* ML Connection Status */}
      <div className="glass-panel p-6 rounded-lg bg-amber-900/20 border border-amber-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-amber-300 mb-1">
              ⚠️ {t('adminAffiliateTab.connectToML', 'Conectar ao Mercado Livre')}
            </h3>
            <p className="text-sm text-amber-100">
              {t('adminAffiliateTab.connectMLDescription', 'Para importar produtos, você precisa conectar sua conta do Mercado Livre. Clique abaixo para autorizar.')}
            </p>
          </div>
          <button
            onClick={handleMLAuth}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium whitespace-nowrap ml-4"
          >
            {t('adminAffiliateTab.connectToMLButton', 'Conectar ao ML')}
          </button>
        </div>
      </div>

      {/* Marketplace Selector Modal */}
      {showMarketplaceSelector && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">{t('adminAffiliateTab.importProduct', 'Importar Produto')}</h3>
            <p className="text-sm text-slate-400 mb-4">{t('adminAffiliateTab.mlOnlyNotice', 'Atualmente, apenas Mercado Livre permite importação via API. Outros marketplaces podem ser adicionados no futuro.')}</p>
            <button
              onClick={() => handleMarketplaceSelect('mercado_livre')}
              className="w-full text-left px-4 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 rounded transition border border-cyan-500/50"
            >
              <div className="font-medium text-cyan-300">🇧🇷 {t('adminAffiliateTab.mercadoLivre', 'Mercado Livre')}</div>
              <div className="text-xs text-slate-400">{t('adminAffiliateTab.pasteLinkHint', 'Cole o link do produto para importar dados automaticamente')}</div>
            </button>
            <button
              onClick={() => setShowMarketplaceSelector(false)}
              className="w-full mt-4 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition"
            >
              {t('adminAffiliateTab.cancel', 'Cancelar')}
            </button>
          </div>
        </div>
      )}

      {/* Mercado Livre Import Form */}
      {selectedMarketplace === 'mercado_livre' && (
        <div className="glass-panel p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">{t('adminAffiliateTab.importFromML', 'Importar do Mercado Livre')}</h3>
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
            {t('adminAffiliateTab.back', '← Voltar')}
          </button>
        </div>
      )}

      {/* Edit Form */}
      {editingProduct && showForm && (
        <div className="glass-panel p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">{t('adminAffiliateTab.editProduct', 'Editar Produto')}</h3>
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
          <h3 className="text-lg font-semibold">{t('adminAffiliateTab.affiliateProducts', 'Produtos Afiliados')}</h3>
          {!showForm && !showMarketplaceSelector && selectedMarketplace === null && (
            <button
              onClick={() => setShowMarketplaceSelector(true)}
              className="px-4 py-2 bg-cyan-500 text-white rounded font-medium hover:bg-cyan-600"
            >
              {t('adminAffiliateTab.newProduct', '+ Novo Produto')}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-slate-400">
            {t('adminAffiliateTab.loadingProducts', 'Carregando produtos...')}
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
