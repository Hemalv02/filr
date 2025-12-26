import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Settings, AlertCircle, Trash2, CheckCircle2, FileText, Upload, X } from "lucide-react";
import { useState, useEffect } from "react";
import { processDocuments, type ExtractedData } from "./lib/gemini";
import { processDynamicDocuments, type DynamicExtractedData } from "./lib/dynamicExtraction";
import type { ProgressEvent } from "./lib/observers/ProcessingObserver";
import type { FormData, SourceDocumentList } from "./lib/formExtraction";
import { getPageAccessibilityTree } from "./lib/formExtraction";
import { cn } from "@/lib/utils";

// MVC PATTERN: Import controller
import { DocumentController } from "./controllers/DocumentController";

// Offline Processing - Import Components
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import { ToastContainer } from "./components/ToastContainer";
import { QueueStatus } from "./components/QueueStatus";
import { NetworkStatusManager } from "./lib/offline/NetworkStatusManager";
import SimpleOfflineQueue from "./lib/offline/SimpleOfflineQueue";
import { OfflineNotifications } from "./lib/offline/OfflineNotifications";

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
  const [formFillContext, setFormFillContext] = useState<string>("");
  
  // Dialog states
  const [offlineWarningDialogOpen, setOfflineWarningDialogOpen] = useState(false);
  const [pendingOfflineFiles, setPendingOfflineFiles] = useState<File[]>([]);

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

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    const notifications = OfflineNotifications.getInstance();
    notifications.showToast({
      type,
      title,
      message,
      duration: type === 'error' ? 5000 : 3000,
    });
  };

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

        // Store files for dialog confirmation
        setPendingOfflineFiles(uploadedFiles);
        setOfflineWarningDialogOpen(true);
        setIsProcessing(false);
        return;
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
        // Get accessibility tree for better context during extraction
        let accessibilityTree: string | undefined;
        try {
          accessibilityTree = await getPageAccessibilityTree();
          console.log('[UploadPage] Accessibility tree retrieved for document extraction');
        } catch (error) {
          console.warn('[UploadPage] Failed to get accessibility tree, continuing without it:', error);
          // Continue without tree - extraction will still work with field descriptions
        }

        // Use dynamic extraction based on detected form fields
        extractedData = await processDynamicDocuments(
          uploadedFiles,
          detectedFormData,
          apiKey,
          model || "gemini-2.5-flash",
          accessibilityTree,
          formFillContext.trim() || undefined,
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

  const handleOfflineConfirm = async () => {
    setOfflineWarningDialogOpen(false);
    setIsProcessing(true);

    try {
      const queue = SimpleOfflineQueue();
      const jobId = await queue.queueDocuments(pendingOfflineFiles, detectedFormData || null);

      setProcessingError("");
      setIsProcessing(false);
      showToast('success', 'Documents Queued', `${pendingOfflineFiles.length} document(s) saved locally. They will be processed when you're back online.`);
      setPendingOfflineFiles([]);
    } catch (queueError) {
      console.error('[UploadPage] Failed to queue documents:', queueError);
      setProcessingError("Failed to queue documents for offline processing. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <>
      <ToastContainer />
      <div className="h-screen w-full bg-background flex flex-col">
        {/* Mobile-Friendly Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack} 
            className="h-10 w-10 -ml-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base font-semibold flex-1">Upload Documents</h1>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClearAll}
              className="h-10 w-10"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onSettings}
              className="h-10 w-10"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable Content - Mobile Optimized */}
        <div className="flex-1 overflow-auto">
          <div className="px-4 py-6 space-y-5 max-w-md mx-auto">
            {/* Queue Status */}
            <QueueStatus />

            {/* Extracted Data Banner - Show if data exists */}
            {extractedData && Object.keys(extractedData).length > 0 && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm text-green-900 dark:text-green-100 mb-1">
                          Data Extracted Successfully
                        </h3>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          {Object.keys(extractedData).length} fields extracted • Upload more documents or view results
                        </p>
                      </div>
                    </div>
                    {onViewResults && (
                      <Button
                        onClick={onViewResults}
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0 h-9 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900"
                      >
                        View Results
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Display */}
            {processingError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm min-w-0 flex-1">
                  <p className="font-medium text-destructive mb-1">Error</p>
                  <p className="text-destructive/90 text-xs leading-relaxed">{processingError}</p>
                </div>
              </div>
            )}

            {/* Form Fill Context Textarea */}
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Form Fill Context (Optional)
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Provide context about the form fields to help AI extract data more accurately (e.g., "Field 'nationality' might be labeled as 'Country'", "Use 'passport_number' for 'document_id'", etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Textarea
                  placeholder="E.g., Field 'nationality' might be labeled as 'Country' in the form, or use 'passport_number' for 'document_id' field"
                  value={formFillContext}
                  onChange={(e) => setFormFillContext(e.target.value)}
                  className="min-h-[80px] resize-none text-sm"
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Document Upload Cards */}
            {displayDocuments.map((doc) => (
              <Card 
                key={doc.type} 
                className={cn(
                  "transition-all",
                  doc.file && "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50",
                  touched[doc.type] && errors[doc.type] && "border-destructive"
                )}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    {doc.label}
                    {doc.required && <span className="text-destructive ml-1">*</span>}
                  </CardTitle>
                  {doc.description && (
                    <CardDescription className="text-xs mt-1">
                      {doc.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="relative">
                    <Input
                      id={`file-${doc.type}`}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleFileSelect(doc.type, file);
                      }}
                      className={cn(
                        "h-11",
                        touched[doc.type] && errors[doc.type] && "border-destructive"
                      )}
                    />
                  </div>
                  {touched[doc.type] && errors[doc.type] && (
                    <p className="text-xs text-destructive">{errors[doc.type]}</p>
                  )}
                  {doc.file && (
                    <div className="flex items-center justify-between p-2.5 bg-background border rounded-lg">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <p className="text-xs text-foreground truncate">{doc.file.name}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleFileSelect(doc.type, null)}
                        className="h-7 w-7 flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Fixed Submit Button - Mobile Optimized */}
        <div className="flex-shrink-0 px-4 py-4 border-t bg-background">
          <div className="max-w-md mx-auto space-y-2">
            <div className="text-center text-xs text-muted-foreground">
              {displayDocuments.filter(doc => doc.file).length} / {displayDocuments.length} documents uploaded
            </div>
            <Button 
              onClick={handleSubmit} 
              className="w-full h-11 font-semibold" 
              size="lg"
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Process Documents"}
            </Button>
          </div>
        </div>

        {/* Offline Warning Dialog */}
        <Dialog open={offlineWarningDialogOpen} onOpenChange={setOfflineWarningDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>⚠️ Privacy & Security Notice</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                You are currently offline. Your {pendingOfflineFiles.length} document(s) will be stored UNENCRYPTED on this device until processed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm font-medium">⚠️ Only proceed if:</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>This is your personal, secure device</li>
                <li>No one else has access to this computer</li>
                <li>You trust this device's security</li>
              </ul>
              <p className="text-xs text-muted-foreground pt-2">
                Documents will be automatically processed and deleted when you're back online.
              </p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOfflineWarningDialogOpen(false);
                  setPendingOfflineFiles([]);
                  setProcessingError("Offline storage cancelled. Please try again when you have internet connection.");
                }}
                className="w-full sm:w-auto h-11"
              >
                Cancel
              </Button>
              <Button
                onClick={handleOfflineConfirm}
                className="w-full sm:w-auto h-11"
              >
                Continue with Offline Storage
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
