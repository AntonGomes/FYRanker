import { cn } from "@/lib/utils";

import { PERCENTAGE, WEIGHT_FIELDS, type Weights } from "./wizard-constants";

interface WeightDistributionProps {
  weights: Weights;
  lockRegions: boolean;
}

export function WeightDistribution({ weights, lockRegions }: WeightDistributionProps): React.ReactElement {
  const visibleFields = lockRegions
    ? WEIGHT_FIELDS.filter((f) => f.key !== "region")
    : WEIGHT_FIELDS;

  const total = visibleFields.reduce((sum, f) => sum + weights[f.key], 0);

  function pct(key: "region" | "hospital" | "specialty"): string {
    return ((weights[key] / total) * PERCENTAGE).toFixed(0);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Effective distribution</p>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        {visibleFields.map((f) => (
          <div
            key={f.key}
            className={cn(f.color, "transition-all")}
            style={{ width: `${pct(f.key)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {visibleFields.map((f) => (
          <span key={f.key} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", f.color)} />
            {f.label} {pct(f.key)}%
          </span>
        ))}
      </div>
    </div>
  );
}
