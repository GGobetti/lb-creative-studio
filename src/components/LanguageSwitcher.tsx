'use client'

import { Languages } from 'lucide-react'
import { useConfiguratorStore } from '@/store/store'
import { getSupabaseBrowser } from '@/lib/supabase'

export function LanguageSwitcher() {
  const { language, setLanguage, profile, setProfile } = useConfiguratorStore()
  
  const handleToggle = async () => {
    const nextLang = language === 'pt' ? 'en' : 'pt'
    setLanguage(nextLang)
    
    // If user is logged in, attempt to persist preferred language to the database profiles table
    if (profile) {
      try {
        const supabase = getSupabaseBrowser()
        const { error } = await supabase
          .from('profiles')
          .update({ language: nextLang })
          .eq('id', profile.id)
        if (!error) {
          setProfile({ ...profile, language: nextLang })
        }
      } catch (err) {
        console.error('Error saving language preference:', err)
      }
    }
  }

  return (
    <button
      onClick={handleToggle}
      className="flex items-center justify-center p-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors gap-1.5 text-xs font-bold shrink-0"
      title={language === 'pt' ? 'Switch to English' : 'Mudar para Português'}
    >
      <Languages size={14} className="text-primary" />
      <span className="uppercase">{language}</span>
    </button>
  )
}
