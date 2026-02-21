import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 w-full">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 flex-1 rounded-full transition-all duration-300",
            i + 1 <= currentStep ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
