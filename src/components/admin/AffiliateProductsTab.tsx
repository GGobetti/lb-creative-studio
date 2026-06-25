'use client';

import { useEffect, useState } from 'react';
import { fetchAffiliateProducts, AffiliateProduct } from '@/lib/api/affiliate';
import { AffiliateProductForm } from './AffiliateProductForm';
import { AffiliateProductsList } from './AffiliateProductsList';
import { MercadoLivreConnect } from './MercadoLivreConnect';
import { MercadoLivreImportForm } from './MercadoLivreImportForm';

export function AffiliateProductsTab() {
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<AffiliateProduct | null>(
    null
  );
  const [showForm, setShowForm] = useState(false);
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
  };

  return (
    <div className="space-y-6">
      {/* Mercado Livre Integration */}
      <MercadoLivreConnect />
      <MercadoLivreImportForm
        isConnected={mlConnected}
        onSuccess={loadProducts}
      />

      {/* Create Form */}
      {showForm && (
        <div className="glass-panel p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">
            {editingProduct ? 'Editar Produto' : 'Novo Produto'}
          </h3>
          <AffiliateProductForm
            product={editingProduct || undefined}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {/* List */}
      <div className="glass-panel p-6 rounded-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Produtos Afiliados</h3>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
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
