import { Spinner } from "@/components/ui/spinner";
import { Check, AlertCircle, Upload, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProgressEvent, ProcessingStatus } from "./lib/observers/ProcessingObserver";

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
        return <Upload className="w-4 h-4 text-blue-500 animate-pulse" />;
      case "processing":
        return <Spinner className="w-4 h-4 text-blue-500" />;
      case "completed":
        return <Check className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
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

  return (
    <div className="h-screen w-full bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-foreground/5 flex items-center justify-center">
              <FileText className="w-8 h-8 text-foreground" />
            </div>
          </div>
          <h2 className="text-xl font-semibold">Processing Documents</h2>
          <p className="text-sm text-muted-foreground">
            {progress.current} of {progress.total} files
          </p>
        </div>

        {/* Progress List */}
        <div className="space-y-3">
          {fileArray.map((file) => (
            <div
              key={file.fileName}
              className={`p-4 rounded-lg border ${
                file.status === "error"
                  ? "border-red-200 bg-red-50/50"
                  : file.status === "completed"
                  ? "border-green-200 bg-green-50/50"
                  : "border-border bg-muted/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{getStatusIcon(file.status)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {file.error || getStatusText(file.status)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Overall Progress Indicator */}
        {fileArray.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Spinner className="w-8 h-8" />
            <p className="text-sm text-muted-foreground">Initializing...</p>
          </div>
        )}
      </div>
    </div>
  );
}
