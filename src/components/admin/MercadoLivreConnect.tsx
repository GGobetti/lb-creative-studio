'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useTranslation } from '@/lib/translations';

export function MercadoLivreConnect() {
  const { t } = useTranslation();
  const [isConnected, isSetConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();

    // Check for OAuth success params in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'mercado_livre_connected') {
      isSetConnected(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (params.get('error')) {
      setError(`${t('adminMercadoLivre.error', 'Erro')}: ${params.get('error')}`);
    }
  }, []);

  const checkConnection = async () => {
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      // Check if already connected
      const { data, error: queryError } = await supabase
        .from('marketplace_credentials')
        .select('id')
        .eq('admin_id', session.user.id)
        .eq('marketplace', 'mercado_livre')
        .maybeSingle();

      if (queryError && queryError.code !== 'PGRST116') {
        throw queryError;
      }

      isSetConnected(!!data);
    } catch (err) {
      // Not connected
      isSetConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const supabase = getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setError(t('adminMercadoLivre.notAuthenticated', 'Usuário não autenticado'));
        return;
      }

      const response = await fetch(
        `/api/auth/mercado-livre-url?user_id=${encodeURIComponent(session.user.id)}`
      );
      const data = await response.json();

      if (!response.ok || !data.authUrl) {
        setError(t('adminMercadoLivre.authUrlError', 'Erro ao gerar URL de autorização'));
        return;
      }

      window.location.href = data.authUrl;
    } catch (err) {
      setError(t('adminMercadoLivre.connectError', 'Erro ao conectar com Mercado Livre'));
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-4 text-slate-400">
        {t('adminMercadoLivre.checkingConnection', 'Verificando conexão...')}
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-lg mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-1">Mercado Livre</h3>
          <p className="text-sm text-slate-400">
            {isConnected
              ? t('adminMercadoLivre.connectedMessage', '✓ Conectado - Você pode importar produtos')
              : t('adminMercadoLivre.connectPrompt', 'Conecte sua conta do Mercado Livre para importar produtos')}
          </p>
        </div>

        {!isConnected && (
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-yellow-500 text-black rounded font-medium hover:bg-yellow-600 whitespace-nowrap"
          >
            {t('adminMercadoLivre.connectButton', 'Conectar ao ML')}
          </button>
        )}

        {isConnected && (
          <div className="text-green-400 font-medium">{t('adminMercadoLivre.connected', 'Conectado')}</div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-900/30 text-red-300 rounded text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
