import { Loader2 } from "lucide-react";

export default function LoadingScreen() {
  return (
    <div className="h-screen w-full bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-6">
        <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Processing Documents</h2>
          <p className="text-sm text-muted-foreground">
            Extracting information using AI...
          </p>
        </div>
      </div>
    </div>
  );
}
