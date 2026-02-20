"use client";

import { BrandLogo } from "@/components/brand";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="shrink-0 border-b bg-gradient-to-r from-primary/10 via-card to-accent/10 px-6 py-3">
      <div className="flex items-center justify-between">
        <BrandLogo />
        <div className="flex items-center gap-4">
          <Link
            href="/about"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </Link>
        </div>
      </div>
    </header>
  );
}
