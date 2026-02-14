import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Settings, Scan, UserPen } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import UploadPage from "./UploadPage";
import SettingsPage from "./SettingsPage";
import ProcessingScreen from "./ProcessingScreen";
import ResultsPage from "./ResultsPage";
import HTMLSourcePage from "./HTMLSourcePage";
import FormDetectionPage from "./FormDetectionPage";
import TraditionalFormPage from "./TraditionalFormPage";
import { ToonConfirmationPage } from "./ToonConfirmationPage";
import DebugPage from "./DebugPage";
import type { ExtractedData } from "./lib/gemini";
import type { ProgressEvent } from "./lib/observers/ProcessingObserver";
import type { FormData, SourceDocumentList } from "./lib/formExtraction";
import { StateManager, type PageType, type StateContext } from "./lib/state/AppState";

// MVC Pattern - Import Controllers and Models
import { NavigationController, SettingsController } from "./controllers/DocumentController";
import type { DocumentUploadModel } from "./models/DocumentModel";

// Secure storage for API keys
import { ApiKeyManager } from "./lib/secureStorage";

// Offline Processing - Import Components
import { ToastContainer } from "./components/ToastContainer";
import { OfflineStatusIndicator } from "./components/OfflineStatusIndicator";
import { OfflineNotifications } from "./lib/offline/OfflineNotifications";
import { initializeOfflineProcessing } from "./lib/offline";

// Use model type instead of local interface
type DocumentType = "birthCertificate" | "utilityBill" | "educationCertificate" | "nidCard" | "passport" | "other";

// Legacy interface for compatibility - should use DocumentUploadModel from models
interface DocumentUpload {
  type: DocumentType;
  file: File | null;
  required: boolean;
  label: string;
  description: string;
}

export default function App() {
  // Initialize state manager with proper State pattern
  const [stateContext, setStateContext] = useState<StateContext>({
    currentPage: "home",
    extractedData: null,
    detectedFormData: null,
    detectedSourceDocuments: null,
    progressCallback: null,
    error: null,
    uploadedFiles: new Map<string, File>(),
    toonImportData: null, // For TOON confirmation page
    toonExistingData: null, // For TOON confirmation page
  });

  const stateManager = useMemo(() => new StateManager(stateContext), []);
  const progressCallbackRef = useRef<((event: ProgressEvent) => void) | null>(null);
  const [documents, setDocuments] = useState<DocumentUpload[]>([
    {
      type: "birthCertificate",
      file: null,
      required: true,
      label: "Birth Certificate",
      description: "Proof of age",
    },
    {
      type: "utilityBill",
      file: null,
      required: true,
      label: "Utility Bill / Rent Receipt",
      description: "Proof of residence",
    },
    {
      type: "educationCertificate",
      file: null,
      required: true,
      label: "SSC / Education Certificate",
      description: "Proof of education",
    },
    {
      type: "nidCard",
      file: null,
      required: false,
      label: "NID Card (Parents/Spouse)",
      description: "Optional",
    },
    {
      type: "passport",
      file: null,
      required: false,
      label: "Passport / Driving License / TIN",
      description: "Optional",
    },
    {
      type: "other",
      file: null,
      required: false,
      label: "Other Documents",
      description: "Optional",
    },
  ]);

  // Sync state manager context with React state
  useEffect(() => {
    const context = stateManager.getContext();
    setStateContext({ ...context });
  }, [stateManager]);

  // Initialize secure storage and offline processing subsystem
  useEffect(() => {
    const initOffline = async () => {
      try {
        // Initialize API key manager (decrypt/migrate stored key)
        await ApiKeyManager.getInstance().initialize();

        await initializeOfflineProcessing();
        console.log('[App] Offline processing initialized');

        // Security: Auto-cleanup expired queued documents (older than 24 hours)
        try {
          const SimpleOfflineQueue = (await import('./lib/offline/SimpleOfflineQueue')).default;
          const queue = SimpleOfflineQueue();
          const expired = await queue.clearExpired(24);
          if (expired > 0) {
            console.log(`[App] 🔒 Cleared ${expired} expired documents for security`);
          }
        } catch (cleanupError) {
          console.warn('[App] Failed to cleanup expired documents:', cleanupError);
        }
      } catch (error) {
        console.error('[App] Failed to initialize offline processing:', error);
      }
    };

    initOffline();
  }, []);

  // Helper function to transition between states
  const transitionToPage = (targetPage: PageType): boolean => {
    const success = stateManager.transitionTo(targetPage);
    if (success) {
      setStateContext({ ...stateManager.getContext() });
    } else {
      console.error(`Failed to transition to ${targetPage}`);
      // If transition to settings failed, try to show error
      if (targetPage !== "settings" && stateManager.getContext().error) {
        alert(stateManager.getContext().error);
      }
    }
    return success;
  };

  const clearAllDocuments = () => {
    setDocuments(documents.map(doc => ({ ...doc, file: null })));
  };

  const handleProgressCallback = (callback: (event: ProgressEvent) => void) => {
    progressCallbackRef.current = callback;
    stateManager.updateContext({ progressCallback: callback });
  };

  const handleDetectForm = () => {
    // Check if API key exists
    const apiKey = ApiKeyManager.getInstance().getApiKey();

    if (!apiKey) {
      // Show toast notification instead of alert
      const notifications = OfflineNotifications.getInstance();
      notifications.showToast({
        type: 'warning',
        title: 'API Key Required',
        message: 'Please configure your Gemini API key in settings first.',
        duration: 4000,
      });
      transitionToPage("settings");
      return;
    }

    // Navigate to form detection page using state manager
    transitionToPage("formdetection");
  };

  const handleUpdateInfo = () => {
    // Navigate to traditional form page for manual data entry
    transitionToPage("traditionalform");
  };

  // Use stateContext.currentPage from state manager
  const currentPage = stateContext.currentPage;

  if (currentPage === "upload") {
    return (
      <>
        <OfflineStatusIndicator />
        <UploadPage
          documents={documents}
          setDocuments={setDocuments}
          onClearAll={clearAllDocuments}
          onBack={() => {
            // Clear form data when going back
            stateManager.updateContext({
              detectedFormData: null,
              detectedSourceDocuments: null,
            });
            transitionToPage("home");
          }}
          onSettings={() => transitionToPage("settings")}
          onProcessStart={() => transitionToPage("loading")}
          onProcessComplete={(data) => {
            stateManager.updateContext({ extractedData: data });
            // Only transition if we're not already in results state
            if (stateManager.getCurrentState() !== "results") {
              transitionToPage("results");
            }
          }}
          onProgressCallback={handleProgressCallback}
          detectedFormData={stateContext.detectedFormData}
          detectedSourceDocuments={stateContext.detectedSourceDocuments}
          extractedData={stateContext.extractedData}
          onViewResults={() => transitionToPage("results")}
          uploadedFiles={stateContext.uploadedFiles}
          onFileUpload={(type, file) => {
            const newFiles = new Map(stateContext.uploadedFiles || new Map());
            if (file) {
              newFiles.set(type, file);
            } else {
              newFiles.delete(type);
            }
            stateManager.updateContext({ uploadedFiles: newFiles });
            setStateContext({ ...stateManager.getContext() });
          }}
        />
      </>
    );
  }

  if (currentPage === "settings") {
    return (
      <>
        <OfflineStatusIndicator />
        <SettingsPage onBack={() => transitionToPage("home")} />
      </>
    );
  }

  if (currentPage === "loading") {
    return (
      <>
        <OfflineStatusIndicator />
        <ProcessingScreen
          onProgress={(event) => {
            if (progressCallbackRef.current) {
              progressCallbackRef.current(event);
            }
          }}
        />
      </>
    );
  }

  if (currentPage === "results" && stateContext.extractedData) {
    return (
      <>
        <OfflineStatusIndicator />
        <ResultsPage
          data={stateContext.extractedData}
          onBack={() => {
            // If there's form detection data, go back to upload page
            // Otherwise, go back to traditional form
            if (stateContext.detectedFormData) {
              transitionToPage("upload");
            } else {
              transitionToPage("traditionalform");
            }
          }}
          onConfirm={
            // Show confirm button when there's no form detection data
            // (meaning user came from traditional form - either manual save or TOON import)
            !stateContext.detectedFormData
              ? (data) => {
                stateManager.updateContext({ extractedData: data as ExtractedData });
                transitionToPage("traditionalform");
              }
              : undefined
          }
          detectedFormData={stateContext.detectedFormData}
          detectedSourceDocuments={stateContext.detectedSourceDocuments}
        />
      </>
    );
  }

  if (currentPage === "htmlsource") {
    return (
      <>
        <OfflineStatusIndicator />
        <HTMLSourcePage onBack={() => transitionToPage("home")} />
      </>
    );
  }

  if (currentPage === "formdetection") {
    return (
      <>
        <OfflineStatusIndicator />
        <FormDetectionPage
          onBack={() => transitionToPage("home")}
          onContinueToUpload={(formData, sourceDocuments) => {
            stateManager.updateContext({
              detectedFormData: formData,
              detectedSourceDocuments: sourceDocuments,
            });
            transitionToPage("upload");
          }}
        />
      </>
    );
  }

  if (currentPage === "traditionalform") {
    return (
      <>
        <OfflineStatusIndicator />
        <TraditionalFormPage
          onBack={() => transitionToPage("home")}
          onSave={(data) => {
            stateManager.updateContext({
              extractedData: data,
              detectedFormData: null,
              detectedSourceDocuments: null
            });
            transitionToPage("results");
          }}
          onProcessComplete={(data) => {
            stateManager.updateContext({
              extractedData: data,
              detectedFormData: null,
              detectedSourceDocuments: null
            });
            transitionToPage("results");
          }}
          onToonImport={(importedData: Partial<ExtractedData>, existingData: Partial<ExtractedData>) => {
            stateManager.updateContext({
              toonImportData: importedData,
              toonExistingData: existingData,
            });
            transitionToPage("toonconfirmation");
          }}
          onDataChange={(data) => {
            // Update state manager without navigation when user clicks Save button
            stateManager.updateContext({
              extractedData: data as ExtractedData,
            });
            setStateContext({ ...stateManager.getContext() });
          }}
          initialData={stateManager.getContext().extractedData || undefined}
        />
      </>
    );
  }

  if (currentPage === "toonconfirmation") {
    const { toonImportData, toonExistingData } = stateManager.getContext();
    return (
      <>
        <OfflineStatusIndicator />
        <ToonConfirmationPage
          importedData={toonImportData || {}}
          existingData={toonExistingData || {}}
          onConfirm={(mergedData) => {
            stateManager.updateContext({
              extractedData: mergedData as ExtractedData,
              toonImportData: null,
              toonExistingData: null,
            });
            transitionToPage("traditionalform");
          }}
          onCancel={() => {
            stateManager.updateContext({
              toonImportData: null,
              toonExistingData: null,
            });
            transitionToPage("traditionalform");
          }}
        />
      </>
    );
  }

  if (currentPage === "debug") {
    return (
      <>
        <OfflineStatusIndicator />
        <DebugPage onBack={() => transitionToPage("home")} />
      </>
    );
  }

  return (
    <>
      {/* Always-visible status indicator */}
      <OfflineStatusIndicator />

      {/* Toast notifications for offline/online status */}
      <ToastContainer />

      <div className="h-screen w-full bg-background flex items-center justify-center px-4 py-6 relative overflow-auto">
        {/* Settings Button - Fixed top-right */}
        <div className="absolute top-3 right-3 z-40">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => transitionToPage("settings")}
            className="h-8 w-8 hover:bg-accent/50 transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-full max-w-md mx-auto space-y-6 text-center px-2">
          {/* Logo/Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-lg border border-border/50 backdrop-blur-sm">
                <FileText className="w-10 h-10 text-primary" strokeWidth={1.5} />
              </div>
              {/* Decorative ring */}
              <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-xl -z-10"></div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Filr
            </h1>
            <p className="text-sm text-muted-foreground font-medium">
              AI-Powered Form Assistant
            </p>
          </div>

          <Separator className="my-5 opacity-50" />

          {/* Description */}
          <p className="text-sm text-muted-foreground px-2 leading-relaxed">
            Extract data from documents and automatically fill government forms.
          </p>

          {/* CTA Buttons */}
          <div className="pt-3 space-y-3">
            <Button
              onClick={handleDetectForm}
              className="w-full h-11 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              size="lg"
            >
              <Scan className="w-5 h-5 mr-2" />
              Detect Form
            </Button>
            <Button
              onClick={handleUpdateInfo}
              className="w-full h-11 text-base font-semibold border-2 hover:bg-accent/50 transition-all duration-200"
              size="lg"
              variant="outline"
            >
              <UserPen className="w-5 h-5 mr-2" />
              Update Info
            </Button>
          </div>

          {/* Footer */}
          <div className="pt-3">
            <p className="text-xs text-muted-foreground/80">
              Powered by Gemini AI • Secure & Private
            </p>
          </div>
        </div>
      </div>
    </>
  );
}