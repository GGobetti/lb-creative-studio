'use client';

import { useState } from 'react';
import { AffiliateProduct, createProduct, updateProduct } from '@/lib/api/affiliate';
import { getSupabaseBrowser } from '@/lib/supabase';

interface AffiliateProductFormProps {
  product?: AffiliateProduct;
  onSuccess: () => void;
  onCancel: () => void;
}

const marketplaces = ['aliexpress', 'shopee', 'mercado_livre', 'amazon'] as const;

export function AffiliateProductForm({
  product,
  onSuccess,
  onCancel,
}: AffiliateProductFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price?.toString() || '',
    image_url: product?.image_url || '',
    affiliate_link: product?.affiliate_link || '',
    marketplace: (product?.marketplace || 'aliexpress') as typeof marketplaces[number],
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
            ...formData,
            price: parseFloat(formData.price),
          },
          token
        );
      } else {
        await createProduct(
          {
            ...formData,
            price: parseFloat(formData.price),
          } as any,
          token
        );
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-900/30 text-red-300 rounded">{error}</div>}

      <div>
        <label className="block text-sm font-medium mb-1">Nome *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
          placeholder="Ex: Impressora 3D Creality Ender 3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Descrição</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
          placeholder="Ex: Impressora com cama aquecida, suporta PLA/ABS..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Preço (R$) *</label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            required
            step="0.01"
            min="0"
            className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
            placeholder="999.99"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Marketplace *</label>
          <select
            name="marketplace"
            value={formData.marketplace}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 outline-none"
          >
            {marketplaces.map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">URL da Imagem *</label>
        <input
          type="url"
          name="image_url"
          value={formData.image_url}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Link de Afiliado *</label>
        <input
          type="url"
          name="affiliate_link"
          value={formData.affiliate_link}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
          placeholder="https://aliexpress.com/..."
        />
      </div>

      <div className="flex items-center gap-2">
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

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-cyan-500 text-white rounded font-medium hover:bg-cyan-600 disabled:opacity-50"
        >
          {isLoading ? 'Salvando...' : product ? 'Atualizar' : 'Criar'}
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
