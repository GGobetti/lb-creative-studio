"use client"

import React from "react"
import { Plus, X } from "lucide-react"
import { STL_CATEGORIES } from "@/types/games"
import { cn } from "@/lib/utils"

interface PhotoCuratorCategoryTabProps {
  selectedCategories: Set<string>
  toggleCategory: (cat: string) => void
  handleRemoveSuggestion: (cat: string) => void
  suggestion: string
  setSuggestion: (val: string) => void
  showSuggestionInput: boolean
  setShowSuggestionInput: (val: boolean) => void
}

export function PhotoCuratorCategoryTab({
  selectedCategories,
  toggleCategory,
  handleRemoveSuggestion,
  suggestion,
  setSuggestion,
  showSuggestionInput,
  setShowSuggestionInput,
}: PhotoCuratorCategoryTabProps) {
  return (
    <div className="space-y-3 max-h-[40vh] overflow-y-auto">
      <p className="text-xs text-muted-foreground">
        Selecione uma ou mais categorias para aplicar em massa aos selecionados:
      </p>

      {/* Grid de categorias padrão */}
      <div className="grid grid-cols-2 gap-2">
        {STL_CATEGORIES.map((cat) => (
          <label
            key={cat}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition",
              selectedCategories.has(cat)
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-muted/50"
            )}
          >
            <input
              type="checkbox"
              checked={selectedCategories.has(cat)}
              onChange={() => toggleCategory(cat)}
              className="accent-primary"
            />
            <span>{cat}</span>
          </label>
        ))}
      </div>

      {/* Sugestões customizadas */}
      {selectedCategories.size > 0 && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex flex-wrap gap-1">
            {Array.from(selectedCategories)
              .filter((c) => !STL_CATEGORIES.includes(c))
              .map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs"
                >
                  {cat}
                  <button
                    onClick={() => handleRemoveSuggestion(cat)}
                    className="opacity-60 hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
          </div>

          {!showSuggestionInput ? (
            <button
              onClick={() => setShowSuggestionInput(true)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-muted"
            >
              <Plus className="w-3 h-3" /> Sugerir categoria customizada
            </button>
          ) : (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="Ex: Sonic, Mario..."
                className="flex-1 px-2 py-1 rounded text-xs border border-border bg-background"
                autoFocus
              />
              <button
                onClick={() => {
                  if (suggestion.trim()) {
                    toggleCategory(suggestion.trim())
                    setSuggestion("")
                    setShowSuggestionInput(false)
                  }
                }}
                className="px-2 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Adicionar
              </button>
              <button
                onClick={() => {
                  setSuggestion("")
                  setShowSuggestionInput(false)
                }}
                className="px-2 py-1 rounded text-xs border border-border hover:bg-muted"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
