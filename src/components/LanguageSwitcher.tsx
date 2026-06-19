'use client'

import { useState, useRef, useEffect } from 'react'
import { useConfiguratorStore } from '@/store/store'
import { getSupabaseBrowser } from '@/lib/supabase'

const LANGUAGES = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English',   flag: '🇺🇸' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
] as const

type LangCode = typeof LANGUAGES[number]['code']

export function LanguageSwitcher() {
  const { language, setLanguage, profile, setProfile } = useConfiguratorStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = async (code: LangCode) => {
    setOpen(false)
    setLanguage(code)

    if (profile) {
      try {
        const supabase = getSupabaseBrowser()
        const { error } = await supabase
          .from('profiles')
          .update({ language: code })
          .eq('id', profile.id)
        if (!error) setProfile({ ...profile, language: code })
      } catch (err) {
        console.error('Error saving language preference:', err)
      }
    }
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-bold"
        title={current.label}
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="uppercase">{current.code}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-xl border border-border bg-card shadow-elevated overflow-hidden">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left ${
                language === lang.code ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'
              }`}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
