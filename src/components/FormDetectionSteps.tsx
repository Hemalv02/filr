import { Loader2, CheckCircle2, Network, Search, CheckCircle, FileText, Save, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

type DetectionStep = 
  | "generating_tree"
  | "capturing_screenshots"
  | "detecting_form" 
  | "validating_form"
  | "detecting_documents"
  | "caching_results"
  | "complete";

interface StepConfig {
  id: DetectionStep;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const steps: StepConfig[] = [
  {
    id: "generating_tree",
    label: "Generating Accessibility Tree",
    description: "Analyzing page structure...",
    icon: Network,
  },
  {
    id: "capturing_screenshots",
    label: "Capturing Screenshots",
    description: "Taking page screenshots for visual context...",
    icon: Camera,
  },
  {
    id: "detecting_form",
    label: "Detecting Form",
    description: "Identifying form fields...",
    icon: Search,
  },
  {
    id: "validating_form",
    label: "Validating Form",
    description: "Validating form structure...",
    icon: CheckCircle,
  },
  {
    id: "detecting_documents",
    label: "Detecting Required Documents",
    description: "Determining required documents...",
    icon: FileText,
  },
  {
    id: "caching_results",
    label: "Caching Results",
    description: "Saving results...",
    icon: Save,
  },
];

interface FormDetectionStepsProps {
  currentStep: DetectionStep;
}

export function FormDetectionSteps({ currentStep }: FormDetectionStepsProps) {
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  // If step not found or is "complete", show all steps as completed
  const effectiveIndex = currentStepIndex === -1 || currentStep === "complete" 
    ? steps.length 
    : currentStepIndex;
  
  return (
    <div className="w-full space-y-0">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = index < effectiveIndex;
        const isActive = step.id === currentStep && currentStep !== "complete";
        const isPending = index > effectiveIndex;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="relative flex items-start gap-4">
            {/* Vertical connector line */}
            {!isLast && (
              <div className="absolute left-[11px] top-8 w-0.5 h-full">
                <div
                  className={cn(
                    "w-full h-full transition-colors",
                    isCompleted ? "bg-green-500" : "bg-border"
                  )}
                />
              </div>
            )}

            {/* Icon */}
            <div className="relative z-10 flex-shrink-0">
              {isCompleted ? (
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              ) : isActive ? (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                  <Icon className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5 pb-5">
              <h4
                className={cn(
                  "text-sm font-medium mb-1.5",
                  isActive && "text-foreground font-semibold",
                  isCompleted && "text-foreground",
                  isPending && "text-muted-foreground"
                )}
              >
                {step.label}
              </h4>
              <p
                className={cn(
                  "text-xs leading-relaxed",
                  isActive && "text-foreground/70",
                  isCompleted && "text-muted-foreground",
                  isPending && "text-muted-foreground/60"
                )}
              >
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

