import { Slider } from "@/components/ui/slider";

import { PERCENTAGE } from "./wizard-constants";

interface WeightSliderProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  onChange: (v: number) => void;
}

export function WeightSlider({
  icon: Icon,
  label,
  value,
  onChange,
}: WeightSliderProps): React.ReactElement {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {label}
        </label>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          {(value * PERCENTAGE).toFixed(0)}%
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        max={1}
        step={0.01}
      />
    </div>
  );
}
