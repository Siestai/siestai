"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardLayoutProps {
  step: number;
  totalSteps: number;
  stepLabels: string[];
  onBack: () => void;
  onNext: () => void;
  onSave?: () => void;
  saving?: boolean;
  nextDisabled?: boolean;
  children: React.ReactNode;
}

export function WizardLayout({
  step,
  totalSteps,
  stepLabels,
  onBack,
  onNext,
  onSave,
  saving,
  nextDisabled,
  children,
}: WizardLayoutProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Progress bar */}
      <div className="px-6 md:px-12 pt-6 pb-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isCompleted = stepNum < step;
            const isCurrent = stepNum === step;
            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                      isCompleted && "bg-cyan-400 text-black",
                      isCurrent && "ring-2 ring-cyan-400 bg-cyan-400/10 text-cyan-400",
                      !isCompleted && !isCurrent && "bg-secondary text-muted-foreground"
                    )}
                  >
                    {stepNum}
                  </div>
                  <span
                    className={cn(
                      "text-xs whitespace-nowrap",
                      isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </div>
                {i < totalSteps - 1 && (
                  <div
                    className={cn(
                      "h-px flex-1 mx-3 mt-[-1.25rem]",
                      isCompleted ? "bg-cyan-400" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 md:px-12 py-6">
        <div className="max-w-2xl mx-auto">{children}</div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-6 md:px-12 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={onBack} disabled={saving}>
                Back
              </Button>
            )}
          </div>
          <div>
            {step < totalSteps ? (
              <Button onClick={onNext} disabled={nextDisabled}>
                Next
              </Button>
            ) : (
              onSave && (
                <Button onClick={onSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save &amp; Create Agent
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
