'use client';

import { useState } from 'react';
import { AffiliateProduct, deleteProduct, updateProduct } from '@/lib/api/affiliate';
import { getSupabaseBrowser } from '@/lib/supabase';
import { Trash2, Edit2 } from 'lucide-react';
import { useTranslation } from '@/lib/translations';

interface AffiliateProductsListProps {
  products: AffiliateProduct[];
  onEdit: (product: AffiliateProduct) => void;
  onProductsChange: () => void;
}

export function AffiliateProductsList({
  products,
  onEdit,
  onProductsChange,
}: AffiliateProductsListProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<string | null>(null);

  const getToken = async (): Promise<string> => {
    const supabase = getSupabaseBrowser();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('No session');
    return token;
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('adminAffiliateList.confirmDelete', 'Deletar este produto?'))) return;

    setIsDeleting(id);
    try {
      const token = await getToken();
      await deleteProduct(id, token);
      onProductsChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('adminAffiliateList.deleteError', 'Erro ao deletar'));
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggleActive = async (product: AffiliateProduct) => {
    setIsToggling(product.id);
    try {
      const token = await getToken();
      await updateProduct(
        product.id,
        { is_active: !product.is_active },
        token
      );
      onProductsChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('adminAffiliateList.updateError', 'Erro ao atualizar'));
    } finally {
      setIsToggling(null);
    }
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        {t('adminAffiliateList.noProductsYet', 'Nenhum produto ainda. Crie o primeiro!')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-700">
          <tr>
            <th className="text-left py-3 px-4">{t('adminAffiliateList.name', 'Nome')}</th>
            <th className="text-left py-3 px-4">{t('adminAffiliateList.price', 'Preço')}</th>
            <th className="text-left py-3 px-4">{t('adminAffiliateList.marketplace', 'Marketplace')}</th>
            <th className="text-center py-3 px-4">{t('adminAffiliateList.status', 'Status')}</th>
            <th className="text-right py-3 px-4">{t('adminAffiliateList.actions', 'Ações')}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product.id}
              className="border-b border-slate-700/50 hover:bg-slate-800/30"
            >
              <td className="py-3 px-4">
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-slate-500 truncate max-w-xs">
                    {product.details?.description || t('adminAffiliateList.noDescription', 'Sem descrição')}
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">R$ {product.details?.price ? product.details.price.toFixed(2) : '0.00'}</td>
              <td className="py-3 px-4 text-xs">
                {product.marketplace.replace('_', ' ').toUpperCase()}
              </td>
              <td className="py-3 px-4 text-center">
                <button
                  onClick={() => handleToggleActive(product)}
                  disabled={isToggling === product.id}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    product.is_active
                      ? 'bg-green-900/30 text-green-300'
                      : 'bg-slate-700/30 text-slate-400'
                  } disabled:opacity-50`}
                >
                  {product.is_active ? t('adminAffiliateList.activeStatus', 'Ativo') : t('adminAffiliateList.inactiveStatus', 'Inativo')}
                </button>
              </td>
              <td className="py-3 px-4 text-right flex gap-2 justify-end">
                <button
                  onClick={() => onEdit(product)}
                  className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                  title={t('adminAffiliateList.editTitle', 'Editar')}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  disabled={isDeleting === product.id}
                  className="p-1.5 rounded bg-slate-700 hover:bg-red-900/30 text-slate-300 hover:text-red-400 disabled:opacity-50"
                  title={t('adminAffiliateList.deleteTitle', 'Deletar')}
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
