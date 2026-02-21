import { cn } from "@/lib/utils";
import { getRegionStyle } from "@/lib/region-colors";

interface RegionBadgeProps {
  region: string;
  className?: string;
}

export function RegionBadge({ region, className }: RegionBadgeProps) {
  const style = getRegionStyle(region);
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold border shrink-0",
        style.bg,
        style.text,
        style.border,
        className
      )}
    >
      {region}
    </span>
  );
}
