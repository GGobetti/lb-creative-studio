import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function BentoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-1 md:grid-cols-3 gap-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function BentoCard({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
}: {
  name: string;
  className?: string;
  background?: ReactNode;
  Icon?: any;
  description: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div
      className={cn(
        "group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-3xl transition-all duration-300",
        // light styles
        "bg-white border border-slate-200/60 shadow-sm hover:shadow-md hover:border-primary/20",
        // dark styles
        "dark:bg-slate-900/40 dark:border-slate-800/60 dark:backdrop-blur-md dark:hover:border-primary/30",
        className
      )}
    >
      <div className="absolute inset-0 z-0">{background}</div>

      <div className="pointer-events-none z-10 flex transform flex-col gap-1 p-6 transition-all duration-300 group-hover:-translate-y-3">
        {Icon && (
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white">
            <Icon size={24} />
          </div>
        )}
        <h3 className="text-xl font-bold text-foreground">
          {name}
        </h3>
        <p className="max-w-xs text-muted-foreground text-sm leading-relaxed mt-1">{description}</p>
      </div>

      {href && cta && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-0 flex w-full translate-y-10 transform flex-row items-center p-6 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
          )}
        >
          <a
            href={href}
            className="pointer-events-auto flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
          >
            {cta}
            <span className="text-xs">→</span>
          </a>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 transform bg-gradient-to-t from-slate-50/50 to-transparent opacity-0 transition-all duration-300 group-hover:opacity-100 dark:from-slate-950/20" />
    </div>
  );
}
