/**
 * VIEW - MVC Pattern Implementation
 *
 * Views are pure presentational components that receive data via props
 * and communicate user actions via callbacks. They don't contain business logic.
 */

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Settings } from "lucide-react";

export interface HomeViewProps {
  onGetStarted: () => void;
  onSettings: () => void;
  appName?: string;
  appDescription?: string;
}

/**
 * Home view - Pure presentational component
 */
export function HomeView({
  onGetStarted,
  onSettings,
  appName = "Filr",
  appDescription = "Document Processing Extension",
}: HomeViewProps) {
  return (
    <div className="h-screen w-full bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-10 text-center">
        {/* Settings Button */}
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" onClick={onSettings}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Logo/Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-28 h-28 rounded-3xl bg-foreground flex items-center justify-center shadow-sm">
            <FileText className="w-14 h-14 text-background" strokeWidth={2} />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-5xl font-semibold tracking-tight">{appName}</h1>
          <p className="text-base text-muted-foreground">{appDescription}</p>
        </div>

        <Separator className="my-8" />

        {/* Description */}
        <p className="text-base text-muted-foreground px-4 leading-relaxed">
          Upload your documents and let AI extract and auto-fill information for
          government applications.
        </p>

        {/* CTA Button */}
        <div className="pt-4 space-y-3">
          <Button
            onClick={onGetStarted}
            className="w-full h-14 text-base font-medium"
            size="lg"
          >
            Get Started
          </Button>
        </div>

        {/* Footer */}
        <p className="text-sm text-muted-foreground pt-6">
          Secure document processing with Gemini AI
        </p>
      </div>
    </div>
  );
}
