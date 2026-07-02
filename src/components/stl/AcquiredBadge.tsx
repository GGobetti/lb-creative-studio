import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface AcquiredBadgeProps {
  hasAccess: boolean
}

export function AcquiredBadge({ hasAccess }: AcquiredBadgeProps): React.ReactNode {
  if (!hasAccess) return null

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
        "bg-green-900/40 border border-green-500/50",
        "text-green-200 text-sm font-medium"
      )}
    >
      <Check size={16} className="shrink-0" />
      <span>Você tem este</span>
    </div>
  )
}
