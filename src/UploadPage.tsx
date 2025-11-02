import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Settings, AlertCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { processDocuments, type ExtractedData } from "./lib/gemini";
import type { ProgressEvent } from "./lib/observers/ProcessingObserver";

type DocumentType = "birthCertificate" | "utilityBill" | "educationCertificate" | "nidCard" | "passport" | "other";

interface DocumentUpload {
  type: DocumentType;
  file: File | null;
  required: boolean;
  label: string;
  description: string;
}

interface UploadPageProps {
  documents: DocumentUpload[];
  setDocuments: (documents: DocumentUpload[]) => void;
  onClearAll: () => void;
  onBack: () => void;
  onSettings: () => void;
  onProcessComplete: (data: ExtractedData) => void;
  onProcessStart: () => void;
  onProgressCallback: (callback: (event: ProgressEvent) => void) => void;
}

export default function UploadPage({ documents, setDocuments, onClearAll, onBack, onSettings, onProcessComplete, onProcessStart, onProgressCallback }: UploadPageProps) {

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [processingError, setProcessingError] = useState<string>("");

  const handleFileSelect = (type: DocumentType, file: File | null) => {
    setDocuments(
      documents.map((doc) =>
        doc.type === type ? { ...doc, file } : doc
      )
    );
    setTouched({ ...touched, [type]: true });
    if (file) {
      setErrors({ ...errors, [type]: "" });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    documents
      .filter((doc) => doc.required)
      .forEach((doc) => {
        if (!doc.file) {
          newErrors[doc.type] = `${doc.label} is required`;
        }
      });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    const allTouched: Record<string, boolean> = {};
    documents.forEach((doc) => {
      allTouched[doc.type] = true;
    });
    setTouched(allTouched);

    if (!validateForm()) {
      return;
    }

    // Check for API key and model
    const apiKey = localStorage.getItem("gemini_api_key");
    const model = localStorage.getItem("gemini_model");

    if (!apiKey) {
      setProcessingError("Please configure your Gemini API key in settings");
      return;
    }

    setProcessingError("");

    try {
      // Show loading screen
      onProcessStart();

      // Get all uploaded files
      const uploadedFiles = documents
        .filter((doc) => doc.file !== null)
        .map((doc) => doc.file!);

      // Set up progress callback
      onProgressCallback((event: ProgressEvent) => {
        // Update the ProcessingScreen via window handler
        if ((window as any).__progressHandler) {
          (window as any).__progressHandler(event);
        }
      });

      // Process documents with Gemini
      const extractedData = await processDocuments(
        uploadedFiles,
        apiKey,
        model || "Gemini 2.0 Flash",
        (event) => {
          // Forward progress events
          if ((window as any).__progressHandler) {
            (window as any).__progressHandler(event);
          }
        }
      );

      // Show results
      onProcessComplete(extractedData);
    } catch (error) {
      console.error("Processing error:", error);
      setProcessingError(
        error instanceof Error
          ? error.message
          : "Failed to process documents. Please try again."
      );
    }
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      <div className="flex-shrink-0 p-6 pb-4 border-b">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-2xl font-semibold">Upload Documents</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onClearAll}>
                <Trash2 className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onSettings}>
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="max-w-2xl mx-auto space-y-6">
          {processingError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Error</p>
                <p className="text-destructive/90">{processingError}</p>
              </div>
            </div>
          )}

          {documents.map((doc) => (
            <div key={doc.type} className="space-y-2">
              <Label htmlFor={`file-${doc.type}`}>
                {doc.label}
                {doc.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Input
                id={`file-${doc.type}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  handleFileSelect(doc.type, file);
                }}
                className={touched[doc.type] && errors[doc.type] ? "border-destructive" : ""}
              />
              {touched[doc.type] && errors[doc.type] && (
                <p className="text-sm text-destructive">{errors[doc.type]}</p>
              )}
              <p className="text-xs text-muted-foreground">{doc.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Submit Button */}
      <div className="flex-shrink-0 p-6 pt-4 border-t bg-background">
        <div className="max-w-2xl mx-auto">
          <Button onClick={handleSubmit} className="w-full" size="lg">
            Process Documents
          </Button>
        </div>
      </div>
    </div>
  );
}
