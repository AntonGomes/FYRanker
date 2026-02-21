import { Button } from "@/components/ui/button";

interface WizardFooterProps {
  showBackButton: boolean;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
}

export function WizardFooter({
  showBackButton,
  nextLabel,
  onBack,
  onNext,
}: WizardFooterProps): React.ReactElement {
  return (
    <div className="shrink-0 border-t px-4 py-2 sm:px-6 sm:py-3 flex items-center justify-between">
      {showBackButton ? (
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-3">
        <Button onClick={onNext} className="min-w-25">
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
