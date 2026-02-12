import { BrandLogo } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="shrink-0 border-t bg-card/50 px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <p className="text-xs text-muted-foreground">
          Made with ❤️ in Glasgow
        </p>
        <BrandLogo className="scale-75 origin-right" />
      </div>
    </footer>
  );
}
