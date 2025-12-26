import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle, Upload, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProgressEvent, ProcessingStatus } from "./lib/observers/ProcessingObserver";
import { cn } from "@/lib/utils";

interface FileProgress {
  fileName: string;
  status: ProcessingStatus;
  message: string;
  error?: string;
}

interface ProcessingScreenProps {
  onProgress?: (event: ProgressEvent) => void;
}

export default function ProcessingScreen({ onProgress }: ProcessingScreenProps) {
  const [files, setFiles] = useState<Map<string, FileProgress>>(new Map());
  const [currentFile, setCurrentFile] = useState<string>("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (onProgress) {
      // This will be called from parent component
      const handleProgress = (event: ProgressEvent) => {
        setCurrentFile(event.fileName);
        setProgress({ current: event.current, total: event.total });

        setFiles((prev) => {
          const updated = new Map(prev);
          updated.set(event.fileName, {
            fileName: event.fileName,
            status: event.status,
            message: event.message || "",
            error: event.error,
          });
          return updated;
        });
      };

      // Store the handler for cleanup
      (window as any).__progressHandler = handleProgress;
    }
  }, [onProgress]);

  const getStatusIcon = (status: ProcessingStatus) => {
    switch (status) {
      case "uploading":
        return <Upload className="w-5 h-5 text-blue-500 animate-pulse" />;
      case "processing":
        return <Spinner className="w-5 h-5 text-blue-500" />;
      case "completed":
        return <Check className="w-5 h-5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
    }
  };

  const getStatusText = (status: ProcessingStatus) => {
    switch (status) {
      case "uploading":
        return "Uploading...";
      case "processing":
        return "Processing...";
      case "completed":
        return "Completed";
      case "error":
        return "Error";
    }
  };

  const fileArray = Array.from(files.values());
  const completedCount = fileArray.filter(f => f.status === "completed").length;
  const errorCount = fileArray.filter(f => f.status === "error").length;
  // Calculate percentage based on completed + error files (finished processing)
  const finishedCount = completedCount + errorCount;
  const progressPercentage = progress.total > 0 ? Math.round((finishedCount / progress.total) * 100) : 0;

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      {/* Mobile-First Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-base font-semibold">Processing Documents</h2>
        </div>
        {progress.total > 0 && (
          <Badge variant="secondary" className="text-xs">
            {completedCount} / {progress.total}
          </Badge>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 py-6 space-y-4 max-w-md mx-auto">
          {/* Progress Bar */}
          {progress.total > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Overall Progress</span>
                    <span className="font-medium">{progressPercentage}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{completedCount} completed</span>
                    {errorCount > 0 && <span className="text-destructive">{errorCount} errors</span>}
                    <span>{progress.total - finishedCount} remaining</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* File Progress List */}
          {fileArray.length > 0 ? (
            <div className="space-y-3">
              {fileArray.map((file) => (
                <Card
                  key={file.fileName}
                  className={cn(
                    "transition-all",
                    file.status === "error" && "border-destructive/20 bg-destructive/10",
                    file.status === "completed" && "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50"
                  )}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getStatusIcon(file.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.fileName}</p>
                        <p className={cn(
                          "text-xs mt-0.5",
                          file.status === "error" ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {file.error || getStatusText(file.status)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Empty State */
            <Card>
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Spinner className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium">Initializing...</p>
                    <p className="text-xs text-muted-foreground">
                      Preparing to process your documents
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
