import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  size?: "sm" | "md" | "lg"
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center border border-dashed border-border rounded-2xl bg-muted/20",
        size === "sm" && "py-8 px-4",
        size === "md" && "py-12 px-6",
        size === "lg" && "py-20 px-8",
        className
      )}
    >
      <div
        className={cn(
          "rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground/60",
          size === "sm" && "w-10 h-10",
          size === "md" && "w-14 h-14",
          size === "lg" && "w-20 h-20",
        )}
      >
        <Icon className={cn(
          size === "sm" && "w-5 h-5",
          size === "md" && "w-7 h-7",
          size === "lg" && "w-10 h-10",
        )} />
      </div>
      <p className={cn(
        "font-semibold text-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        size === "lg" && "text-base",
      )}>
        {title}
      </p>
      {description && (
        <p className={cn(
          "text-muted-foreground mt-1 max-w-xs leading-relaxed",
          size === "sm" && "text-xs",
          size === "md" && "text-xs",
          size === "lg" && "text-sm",
        )}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
