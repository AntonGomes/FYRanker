import { BrandLogo } from "@/components/brand";
import { cn } from "@/lib/utils";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("shrink-0 border-t bg-card/50 px-6 py-4", className)}>
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <p className="text-xs text-muted-foreground">
          Made with ❤️ in Glasgow
        </p>
        <BrandLogo className="scale-75 origin-right" />
      </div>
    </footer>
  );
}
