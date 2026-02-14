import { cn } from "@/lib/utils";
import Link from "next/link";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-0", className)}>
      <span className="bg-primary text-primary-foreground font-extrabold text-lg px-2 py-0.5 rounded-md">
        FYRanker
      </span>
    </Link>
  );
}
