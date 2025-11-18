import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Settings, AlertCircle, Trash2, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { processDocuments, type ExtractedData } from "./lib/gemini";
import { processDynamicDocuments, type DynamicExtractedData } from "./lib/dynamicExtraction";
import type { ProgressEvent } from "./lib/observers/ProcessingObserver";
import type { FormData, SourceDocumentList } from "./lib/formExtraction";

// MVC PATTERN: Import controller
import { DocumentController } from "./controllers/DocumentController";

// Offline Processing - Import Components
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import { ToastContainer } from "./components/ToastContainer";
import { QueueStatus } from "./components/QueueStatus";
import { NetworkStatusManager } from "./lib/offline/NetworkStatusManager";
import SimpleOfflineQueue from "./lib/offline/SimpleOfflineQueue";

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
  detectedFormData?: FormData | null;
  detectedSourceDocuments?: SourceDocumentList | null;
  extractedData?: ExtractedData | null;
  onViewResults?: () => void;
  uploadedFiles?: Map<string, File> | null;
  onFileUpload?: (type: string, file: File | null) => void;
}

export default function UploadPage({ documents, setDocuments, onClearAll, onBack, onSettings, onProcessComplete, onProcessStart, onProgressCallback, detectedFormData, detectedSourceDocuments, extractedData, onViewResults, uploadedFiles, onFileUpload }: UploadPageProps) {

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [processingError, setProcessingError] = useState<string>("");
  const [dynamicDocuments, setDynamicDocuments] = useState<DocumentUpload[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Convert detected source documents to DocumentUpload format
  useEffect(() => {
    if (detectedSourceDocuments && detectedSourceDocuments.source_documents.length > 0) {
      const converted = detectedSourceDocuments.source_documents.map((doc) => ({
        type: doc.file_id as DocumentType,
        file: uploadedFiles?.get(doc.file_id) || null, // Restore from shared state
        required: false, // Make all documents optional
        label: doc.document_name_bangla,
        description: doc.notes || doc.necessity,
      }));
      setDynamicDocuments(converted);
    }
  }, [detectedSourceDocuments, uploadedFiles]);

  const displayDocuments = dynamicDocuments.length > 0 ? dynamicDocuments : documents;

  const handleFileSelect = (type: DocumentType, file: File | null) => {
    // Update shared uploaded files state
    if (onFileUpload) {
      onFileUpload(type, file);
    }

    if (dynamicDocuments.length > 0) {
      // Update dynamic documents state
      setDynamicDocuments(
        dynamicDocuments.map((doc) =>
          doc.type === type ? { ...doc, file } : doc
        )
      );
    } else {
      // Update static documents state
      setDocuments(
        documents.map((doc) =>
          doc.type === type ? { ...doc, file } : doc
        )
      );
    }
    setTouched({ ...touched, [type]: true });
    if (file) {
      setErrors({ ...errors, [type]: "" });
    }

    // Debug log
    console.log('File selected:', { type, fileName: file?.name, hasDynamic: dynamicDocuments.length > 0 });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Check if at least one document is uploaded
    const hasAnyDocument = displayDocuments.some((doc) => doc.file !== null);
    if (!hasAnyDocument) {
      setProcessingError("Please upload at least one document to continue");
      return false;
    }

    // Check required documents (if any)
    displayDocuments
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
    // Prevent double submission
    if (isProcessing) {
      console.log('Already processing, ignoring duplicate submission');
      return;
    }

    const allTouched: Record<string, boolean> = {};
    displayDocuments.forEach((doc) => {
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
    setIsProcessing(true);

    try {
      // Get all uploaded files
      const uploadedFiles = displayDocuments
        .filter((doc) => doc.file !== null)
        .map((doc) => doc.file!);

      console.log('=== UPLOAD DEBUG ===');
      console.log('Display documents:', displayDocuments);
      console.log('Uploaded files count:', uploadedFiles.length);
      console.log('Uploaded files:', uploadedFiles.map(f => f.name));
      console.log('Has detected form data:', !!detectedFormData);

      // Check if offline - queue documents instead of processing
      const networkManager = NetworkStatusManager.getInstance();

      // Force a fresh connectivity check before processing
      console.log('[UploadPage] Refreshing connectivity status...');
      await networkManager.refreshStatus();

      const isOffline = !networkManager.isOnline();
      const offlineModeEnabled = localStorage.getItem("enable_offline_mode") !== "false";

      console.log('[UploadPage] Connectivity check result:', isOffline ? 'OFFLINE' : 'ONLINE');

      if (isOffline) {
        // Check if offline mode is enabled in settings
        if (!offlineModeEnabled) {
          setProcessingError(
            "You are currently offline and offline mode is disabled in settings. " +
            "Please connect to the internet or enable offline mode in settings to continue."
          );
          setIsProcessing(false);
          return;
        }
        console.log('[UploadPage] Offline detected - queueing documents');

        // Security warning for sensitive documents
        const userConfirmed = confirm(
          `⚠️ PRIVACY & SECURITY NOTICE\n\n` +
          `You are currently offline. Your ${uploadedFiles.length} document(s) will be stored UNENCRYPTED on this device until processed.\n\n` +
          `⚠️ Only proceed if:\n` +
          `• This is your personal, secure device\n` +
          `• No one else has access to this computer\n` +
          `• You trust this device's security\n\n` +
          `Documents will be automatically processed and deleted when you're back online.\n\n` +
          `Continue with offline storage?`
        );

        if (!userConfirmed) {
          setProcessingError("Offline storage cancelled. Please try again when you have internet connection.");
          setIsProcessing(false);
          return;
        }

        try {
          const queue = SimpleOfflineQueue();
          const jobId = await queue.queueDocuments(uploadedFiles, detectedFormData || null);

          setProcessingError("");
          setIsProcessing(false);

          alert(
            `✅ Documents queued successfully!\n\n` +
            `${uploadedFiles.length} document(s) saved locally.\n` +
            `Queue ID: ${jobId}\n\n` +
            `⚠️ Remember: Documents are stored unencrypted on this device.\n` +
            `They will be automatically processed when you're back online.`
          );

          return;
        } catch (queueError) {
          console.error('[UploadPage] Failed to queue documents:', queueError);
          setProcessingError("Failed to queue documents for offline processing. Please try again.");
          setIsProcessing(false);
          return;
        }
      }

      // Online - proceed with normal processing
      console.log('[UploadPage] Online - processing documents immediately');

      // Show loading screen
      onProcessStart();

      // Set up progress callback
      onProgressCallback((event: ProgressEvent) => {
        // Update the ProcessingScreen via window handler
        if ((window as any).__progressHandler) {
          (window as any).__progressHandler(event);
        }
      });

      // Process documents with Gemini - use dynamic extraction if form data is available
      let extractedData: ExtractedData | DynamicExtractedData;

      if (detectedFormData) {
        // Use dynamic extraction based on detected form fields
        extractedData = await processDynamicDocuments(
          uploadedFiles,
          detectedFormData,
          apiKey,
          model || "gemini-2.5-flash",
          (event) => {
            // Convert dynamic progress to standard progress format
            if ((window as any).__progressHandler) {
              const status = event.stage === "upload" ? "uploading" as const :
                            event.stage === "extract" ? "processing" as const :
                            event.stage === "error" ? "error" as const :
                            "completed" as const;

              (window as any).__progressHandler({
                fileName: event.documentName,
                status,
                current: event.currentDocument,
                total: event.totalDocuments,
                message: event.message,
                error: event.stage === "error" ? event.message : undefined,
              });
            }
          }
        );
      } else {
        // Use static extraction for backwards compatibility
        extractedData = await processDocuments(
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
      }

      // Show results
      onProcessComplete(extractedData as ExtractedData);
    } catch (error) {
      console.error("Processing error:", error);
      setProcessingError(
        error instanceof Error
          ? error.message
          : "Failed to process documents. Please try again."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      {/* Queue Status */}
      <div className="flex-shrink-0 px-6 pt-4">
        <div className="max-w-2xl mx-auto">
          <QueueStatus />
        </div>
      </div>

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
          {/* Extracted Data Banner - Show if data exists */}
          {extractedData && Object.keys(extractedData).length > 0 && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-900 dark:text-green-100">
                      Data Extracted Successfully
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {Object.keys(extractedData).length} fields extracted • Upload more documents or view results
                    </p>
                  </div>
                </div>
                {onViewResults && (
                  <Button
                    onClick={onViewResults}
                    variant="outline"
                    size="sm"
                    className="border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900"
                  >
                    View Results
                  </Button>
                )}
              </div>
            </div>
          )}

          {processingError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Error</p>
                <p className="text-destructive/90">{processingError}</p>
              </div>
            </div>
          )}

          {displayDocuments.map((doc) => (
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
              {doc.file && (
                <p className="text-xs text-green-600">✓ {doc.file.name}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Submit Button */}
      <div className="flex-shrink-0 p-6 pt-4 border-t bg-background">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="text-center text-sm text-muted-foreground">
            {displayDocuments.filter(doc => doc.file).length} / {displayDocuments.length} documents uploaded
          </div>
          <Button onClick={handleSubmit} className="w-full" size="lg">
            Process Documents
          </Button>
        </div>
      </div>
    </div>
  );
}
