'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';

interface ImportFormProps {
  onSuccess: () => void;
}

export function MercadoLivreImportForm({
  onSuccess,
}: ImportFormProps) {
  const [affiliateLink, setAffiliateLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (!affiliateLink.trim()) {
        setError('Por favor, cole um link de afiliado do Mercado Livre');
        return;
      }

      const supabase = getSupabaseBrowser();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setError('Você precisa estar autenticado');
        return;
      }

      const response = await fetch('/api/affiliate/import-mercado-livre', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          affiliateLink: affiliateLink.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao importar produto');
        return;
      }

      setSuccess(
        `Produto "${data.product.name}" importado com sucesso!`
      );
      setAffiliateLink('');
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao importar produto'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold mb-4">Importar Produto do Mercado Livre</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-900/30 text-red-300 rounded text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-900/30 text-green-300 rounded text-sm">
            {success}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">
            Link de Afiliado do Mercado Livre *
          </label>
          <input
            type="url"
            value={affiliateLink}
            onChange={(e) => setAffiliateLink(e.target.value)}
            placeholder="https://meli.la/2Y6zGMW ou https://www.mercadolivre.com.br/..."
            className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
            disabled={isLoading}
          />
          <p className="text-xs text-slate-400 mt-1">
            Cole o link de afiliado. O sistema irá buscar automaticamente os dados do produto (nome, preço, imagem, descrição).
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || !affiliateLink.trim()}
          className="px-4 py-2 bg-cyan-500 text-white rounded font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Importando...' : 'Importar Produto'}
        </button>
      </form>
    </div>
  );
}
