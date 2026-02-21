"use client";

export function VsSeparator() {
  return (
    <div className="flex items-center shrink-0">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="w-3 sm:w-4 h-px bg-border" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/60 px-1.5 sm:px-2 py-0.5 rounded-full border border-border/50">
          vs
        </span>
        <div className="w-3 sm:w-4 h-px bg-border" />
      </div>
    </div>
  );
}
