'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@/store/store'
import { getSupabaseBrowser } from '@/lib/supabase'

const LANGUAGES = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English',   flag: '🇺🇸' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
] as const

type LangCode = typeof LANGUAGES[number]['code']

export function LanguageSwitcher() {
  const { language, setLanguage, profile, setProfile } = useAppStore()
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const [mounted, setMounted] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0]

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen(prev => !prev)
  }

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
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-bold"
        title={current.label}
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="uppercase">{current.code}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && mounted && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className="z-[999] min-w-[140px] rounded-xl border border-border bg-card shadow-elevated overflow-hidden"
        >
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
        </div>,
        document.body
      )}
    </div>
  )
}
