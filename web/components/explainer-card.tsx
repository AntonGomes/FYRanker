"use client";

import { cn } from "@/lib/utils";
import { Info, Lightbulb, AlertTriangle } from "lucide-react";

const VARIANTS = {
  info: {
    icon: Info,
    bg: "bg-primary/5",
    border: "border-primary/15",
    iconColor: "text-primary",
  },
  tip: {
    icon: Lightbulb,
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/15",
    iconColor: "text-emerald-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-500/5",
    border: "border-amber-500/15",
    iconColor: "text-amber-500",
  },
} as const;

interface ExplainerCardProps {
  title: string;
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
  defaultOpen?: boolean;
  className?: string;
}

export function ExplainerCard({
  title,
  children,
  variant = "info",
  defaultOpen = false,
  className,
}: ExplainerCardProps) {
  const v = VARIANTS[variant];
  const Icon = v.icon;

  return (
    <details
      open={defaultOpen || undefined}
      className={cn(
        "group rounded-lg border border-dashed px-4 py-3",
        v.bg,
        v.border,
        className
      )}
    >
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground select-none list-none [&::-webkit-details-marker]:hidden">
        <Icon className={cn("h-4 w-4 shrink-0", v.iconColor)} />
        <span className="flex-1">{title}</span>
        <span className="text-muted-foreground text-xs transition-transform group-open:rotate-180">
          &#9662;
        </span>
      </summary>
      <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </details>
  );
}
