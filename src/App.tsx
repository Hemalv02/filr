import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Settings } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import UploadPage from "./UploadPage";
import SettingsPage from "./SettingsPage";
import ProcessingScreen from "./ProcessingScreen";
import ResultsPage from "./ResultsPage";
import HTMLSourcePage from "./HTMLSourcePage";
import FormDetectionPage from "./FormDetectionPage";
import DebugPage from "./DebugPage";
import type { ExtractedData } from "./lib/gemini";
import type { ProgressEvent } from "./lib/observers/ProcessingObserver";
import type { FormData, SourceDocumentList } from "./lib/formExtraction";
import { StateManager, type PageType, type StateContext } from "./lib/state/AppState";

// MVC Pattern - Import Controllers and Models
import { NavigationController, SettingsController } from "./controllers/DocumentController";
import type { DocumentUploadModel } from "./models/DocumentModel";

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

  const handleGetStarted = () => {
    // Check if API key exists
    const apiKey = localStorage.getItem("gemini_api_key");

    if (!apiKey) {
      alert("Please set your Gemini API key in settings first!");
      transitionToPage("settings");
      return;
    }

    // Navigate to form detection page using state manager
    transitionToPage("formdetection");
  };

  // Use stateContext.currentPage from state manager
  const currentPage = stateContext.currentPage;

  if (currentPage === "upload") {
    return (
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
          transitionToPage("results");
        }}
        onProgressCallback={handleProgressCallback}
        detectedFormData={stateContext.detectedFormData}
        detectedSourceDocuments={stateContext.detectedSourceDocuments}
      />
    );
  }

  if (currentPage === "settings") {
    return <SettingsPage onBack={() => transitionToPage("home")} />;
  }

  if (currentPage === "loading") {
    return (
      <ProcessingScreen
        onProgress={(event) => {
          if (progressCallbackRef.current) {
            progressCallbackRef.current(event);
          }
        }}
      />
    );
  }

  if (currentPage === "results" && stateContext.extractedData) {
    return (
      <ResultsPage
        data={stateContext.extractedData}
        onBack={() => {
          stateManager.updateContext({ extractedData: null });
          transitionToPage("upload");
        }}
        detectedFormData={stateContext.detectedFormData}
        detectedSourceDocuments={stateContext.detectedSourceDocuments}
      />
    );
  }

  if (currentPage === "htmlsource") {
    return <HTMLSourcePage onBack={() => transitionToPage("home")} />;
  }

  if (currentPage === "formdetection") {
    return (
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
    );
  }

  if (currentPage === "debug") {
    return <DebugPage onBack={() => transitionToPage("home")} />;
  }

  return (
    <div className="h-screen w-full bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-10 text-center">
        {/* Settings Button */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => transitionToPage("settings")}
          >
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
          <h1 className="text-5xl font-semibold tracking-tight">Filr</h1>
          <p className="text-base text-muted-foreground">
            Document Processing Extension
          </p>
        </div>

        <Separator className="my-8" />

        {/* Description */}
        <p className="text-base text-muted-foreground px-4 leading-relaxed">
          Upload your documents and let AI extract and auto-fill information for government applications.
        </p>

        {/* CTA Button */}
        <div className="pt-4 space-y-3">
          <Button
            onClick={handleGetStarted}
            className="w-full h-14 text-base font-medium"
            size="lg"
          >
            Get Started
          </Button>
          {/* Debug buttons hidden */}
        </div>

        {/* Footer */}
        <p className="text-sm text-muted-foreground pt-6">
          Secure document processing with Gemini AI
        </p>
      </div>
    </div>
  );
}