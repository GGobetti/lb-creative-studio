'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff, Zap } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'

type Mode = 'login' | 'signup'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMode = (searchParams.get('mode') as Mode) || 'login'

  // Limpa o cache local ao carregar a página de login para evitar o "auth lock bug" do Supabase
  useEffect(() => {
    try { localStorage.clear() } catch (e) {}
  }, [])

  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    const supabase = getSupabaseBrowser()
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.href = '/dashboard'
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        })
        if (error) throw error
        setSuccess('Conta criada! Verifique seu email para confirmar o cadastro.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const supabase = getSupabaseBrowser()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  const handleForgotPassword = async () => {
    if (!email) { setError('Digite seu email para redefinir a senha.'); return }
    setLoading(true)
    setError(null)
    const supabase = getSupabaseBrowser()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard/settings?tab=security`,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSuccess('Email de redefinição enviado! Verifique sua caixa de entrada.')
  }

  const handleMagicLink = async () => {
    if (!email) { setError('Digite seu email antes de continuar.'); return }
    setLoading(true)
    setError(null)
    const supabase = getSupabaseBrowser()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSuccess('Link mágico enviado! Verifique seu email.')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Liquid Glass mesh background */}
      <div aria-hidden className="absolute inset-0 z-0 overflow-hidden pointer-events-none dark:block hidden">
        {/* Blob 1 — primary cyan (era violeta/indigo) */}
        <div
          className="absolute -top-[20%] -left-[10%] w-[70%] h-[80%] animate-blob-1 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(6,182,212,0.20) 0%, transparent 65%)' }}
        />
        {/* Blob 2 — accent violet */}
        <div
          className="absolute -bottom-[10%] -right-[10%] w-[55%] h-[70%] animate-blob-2 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 65%)' }}
        />
        {/* Blob 3 — pink accent (mantém) */}
        <div
          className="absolute top-[35%] left-[35%] w-[40%] h-[45%] animate-blob-3 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(255,80,120,0.10) 0%, transparent 65%)' }}
        />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/80 to-blue-500/70 dark:border dark:border-white/20 shadow-primary mb-5">
            <span className="text-white font-black text-xl">LB</span>
          </div>
          <h1 className="text-heading text-2xl text-foreground">
            LB Creative <span className="text-foreground/60">Studio</span>
          </h1>
          <p className="text-sm text-white/40 mt-1.5">
            {mode === 'login' ? 'Acesse sua conta de Maker' : 'Crie sua conta gratuita'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-6 shadow-overlay backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-label text-white/50">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10
                             text-sm text-white placeholder:text-white/20
                             focus:outline-none focus:border-primary/60 focus:bg-white/8
                             transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-label text-white/50">Senha</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10
                             text-sm text-white placeholder:text-white/20
                             focus:outline-none focus:border-primary/60 focus:bg-white/8
                             transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Esqueci a senha (apenas no login) */}
            {mode === 'login' && (
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs text-white/35 hover:text-primary transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            {/* Feedback */}
            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3.5 py-2.5">
                {success}
              </div>
            )}

            {/* Submit */}
            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl
                         bg-primary hover:bg-primary/90
                         text-white font-semibold text-sm
                         transition-all duration-200 shadow-primary
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Entrar' : 'Criar conta'}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-xs text-white/25">ou</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-2.5 mb-2.5 rounded-xl bg-white text-gray-900 font-semibold text-sm
                       hover:bg-gray-50 flex items-center justify-center gap-2
                       transition-all duration-200 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Entrar com o Google
          </button>

          {/* Magic Link */}
          <button
            onClick={handleMagicLink}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10
                       hover:border-primary/40 hover:bg-primary/8
                       text-sm text-white/50 hover:text-white
                       transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Zap size={13} className="text-primary" />
            Entrar com link mágico
          </button>

          {/* Toggle mode */}
          <p className="text-center text-xs text-white/35 mt-5">
            {mode === 'login' ? (
              <>
                Não tem conta?{' '}
                <button
                  onClick={() => { setMode('signup'); setError(null); setSuccess(null) }}
                  className="text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  Cadastre-se grátis
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button
                  onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
                  className="text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-foreground/20 mt-6">
          LB Creative Studio · Para Makers Brasileiros
        </p>
      </div>
    </div>
  )
}

export function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-foreground/40 w-8 h-8" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
