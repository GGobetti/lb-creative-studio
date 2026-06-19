import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-semibold text-label transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-primary/10 text-primary border border-primary/20",
        success:     "bg-success/10 text-success border border-success/20",
        warning:     "bg-warning/10 text-warning border border-warning/20",
        destructive: "bg-destructive/10 text-destructive border border-destructive/20",
        muted:       "bg-muted text-muted-foreground border border-border",
        outline:     "border border-border text-foreground bg-transparent",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm",
      },
      pulse: {
        true:  "",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "default",     pulse: true, className: "badge-pulse" },
      { variant: "success",     pulse: true, className: "badge-pulse-success" },
      { variant: "warning",     pulse: true, className: "badge-pulse-warning" },
      { variant: "destructive", pulse: true, className: "badge-pulse-destructive" },
    ],
    defaultVariants: {
      variant: "default",
      size: "sm",
      pulse: false,
    },
  }
)

interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode
  dot?: boolean
  className?: string
}

export function StatusBadge({ children, dot, className, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants(props), className)}>
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            props.variant === "success"     && "bg-success",
            props.variant === "warning"     && "bg-warning",
            props.variant === "destructive" && "bg-destructive",
            props.variant === "muted"       && "bg-muted-foreground",
            props.variant === "outline"     && "bg-foreground",
            (!props.variant || props.variant === "default") && "bg-primary",
          )}
        />
      )}
      {children}
    </span>
  )
}
