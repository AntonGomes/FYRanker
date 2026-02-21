import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  as?: "h3" | "h4" | "span";
  className?: string;
}

export function SectionLabel({ children, as: Tag = "h3", className }: SectionLabelProps) {
  return (
    <Tag className={cn("text-xs font-semibold uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </Tag>
  );
}
