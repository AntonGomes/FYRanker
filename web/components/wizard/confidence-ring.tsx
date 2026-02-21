import { PERCENTAGE, RING_CIRCUMFERENCE } from "./wizard-constants";

interface ConfidenceRingProps {
  percentage: number;
}

export function ConfidenceRing({ percentage }: ConfidenceRingProps): React.ReactElement {
  const dashLength = (percentage * RING_CIRCUMFERENCE) / PERCENTAGE;

  return (
    <div className="ml-auto flex items-center gap-2">
      <svg className="h-9 w-9" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor"
          className="text-muted" strokeWidth="3" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor"
          className="text-primary transition-all duration-500"
          strokeWidth="3"
          strokeDasharray={`${dashLength} ${RING_CIRCUMFERENCE}`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)" />
      </svg>
      <span className="text-xs font-medium text-foreground">{percentage}% ranked</span>
    </div>
  );
}
