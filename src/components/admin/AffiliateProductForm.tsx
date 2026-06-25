'use client';

import { useState } from 'react';
import { AffiliateProduct, createProduct, updateProduct } from '@/lib/api/affiliate';
import { getSupabaseBrowser } from '@/lib/supabase';

interface AffiliateProductFormProps {
  product?: AffiliateProduct;
  marketplace?: 'mercado_livre' | 'aliexpress' | 'shopee' | 'amazon';
  onSuccess: () => void;
  onCancel: () => void;
}

const marketplaces = ['aliexpress', 'shopee', 'mercado_livre', 'amazon'] as const;

export function AffiliateProductForm({
  product,
  marketplace,
  onSuccess,
  onCancel,
}: AffiliateProductFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.details?.description || '',
    price: product?.details?.price?.toString() || '',
    image_url: product?.photos?.[0]?.image_url || '',
    affiliate_link: product?.affiliate_link || '',
    marketplace: (marketplace || product?.marketplace || 'aliexpress') as typeof marketplaces[number],
    is_active: product?.is_active ?? true,
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const supabase = getSupabaseBrowser();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No session');

      if (product?.id) {
        await updateProduct(
          product.id,
          {
            name: formData.name,
            is_active: formData.is_active,
          },
          token
        );
        onSuccess();
      } else {
        setError('Criação de produtos deve ser feita via importação de API (Mercado Livre)');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsLoading(false);
    }
  };

  if (!product) {
    return (
      <div className="p-4 bg-slate-800/50 rounded text-slate-300">
        <p>Produtos devem ser criados via importação de API (Mercado Livre).</p>
        <p className="text-sm text-slate-400 mt-2">Clique "+ Novo Produto" e selecione Mercado Livre para importar.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-900/30 text-red-300 rounded">{error}</div>}

      <div>
        <label className="block text-sm font-medium mb-1">Nome</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
          placeholder="Nome do produto"
        />
      </div>

      <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded">
        <input
          type="checkbox"
          id="is_active"
          name="is_active"
          checked={formData.is_active}
          onChange={handleChange}
          className="rounded"
        />
        <label htmlFor="is_active" className="text-sm">
          Ativo (visível aos usuários)
        </label>
      </div>

      <div className="space-y-2 p-3 bg-slate-800/50 rounded text-sm text-slate-400">
        <div>
          <span className="font-medium">Preço:</span> R$ {formData.price}
        </div>
        <div>
          <span className="font-medium">Marketplace:</span> {formData.marketplace.replace('_', ' ').toUpperCase()}
        </div>
        <div>
          <span className="font-medium">Link:</span>{' '}
          <a href={formData.affiliate_link} target="_blank" rel="noopener" className="text-cyan-400 hover:underline">
            Abrir
          </a>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-cyan-500 text-white rounded font-medium hover:bg-cyan-600 disabled:opacity-50"
        >
          {isLoading ? 'Salvando...' : 'Atualizar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-700 text-white rounded font-medium hover:bg-slate-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
