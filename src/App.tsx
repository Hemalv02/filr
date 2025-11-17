import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Settings } from "lucide-react";
import { useState, useRef } from "react";
import { getApiKey } from "./lib/storage";
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

type DocumentType = "birthCertificate" | "utilityBill" | "educationCertificate" | "nidCard" | "passport" | "other";

interface DocumentUpload {
  type: DocumentType;
  file: File | null;
  required: boolean;
  label: string;
  description: string;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<"home" | "upload" | "settings" | "loading" | "results" | "htmlsource" | "formdetection" | "debug">("home");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [detectedFormData, setDetectedFormData] = useState<FormData | null>(null);
  const [detectedSourceDocuments, setDetectedSourceDocuments] = useState<SourceDocumentList | null>(null);
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

  const clearAllDocuments = () => {
    setDocuments(documents.map(doc => ({ ...doc, file: null })));
  };

  const handleProgressCallback = (callback: (event: ProgressEvent) => void) => {
    progressCallbackRef.current = callback;
  };

  const handleGetStarted = async () => {
    // Check if API key exists
    const apiKey = await getApiKey();

    if (!apiKey) {
      alert("Please set your Gemini API key in settings first!");
      setCurrentPage("settings");
      return;
    }

    // Navigate to form detection page
    setCurrentPage("formdetection");
  };

  if (currentPage === "upload") {
    return (
      <UploadPage
        documents={documents}
        setDocuments={setDocuments}
        onClearAll={clearAllDocuments}
        onBack={() => {
          // Clear form data when going back
          setDetectedFormData(null);
          setDetectedSourceDocuments(null);
          setCurrentPage("home");
        }}
        onSettings={() => setCurrentPage("settings")}
        onProcessStart={() => setCurrentPage("loading")}
        onProcessComplete={(data) => {
          setExtractedData(data);
          setCurrentPage("results");
        }}
        onProgressCallback={handleProgressCallback}
        detectedFormData={detectedFormData}
        detectedSourceDocuments={detectedSourceDocuments}
      />
    );
  }

  if (currentPage === "settings") {
    return <SettingsPage onBack={() => setCurrentPage("home")} />;
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

  if (currentPage === "results" && extractedData) {
    return (
      <ResultsPage
        data={extractedData}
        onBack={() => {
          setExtractedData(null);
          setCurrentPage("upload");
        }}
        detectedFormData={detectedFormData}
        detectedSourceDocuments={detectedSourceDocuments}
      />
    );
  }

  if (currentPage === "htmlsource") {
    return <HTMLSourcePage onBack={() => setCurrentPage("home")} />;
  }

  if (currentPage === "formdetection") {
    return (
      <FormDetectionPage
        onBack={() => setCurrentPage("home")}
        onContinueToUpload={(formData, sourceDocuments) => {
          setDetectedFormData(formData);
          setDetectedSourceDocuments(sourceDocuments);
          setCurrentPage("upload");
        }}
      />
    );
  }

  if (currentPage === "debug") {
    return <DebugPage onBack={() => setCurrentPage("home")} />;
  }

  return (
    <div className="h-screen w-full bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-10 text-center">
        {/* Settings Button */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage("settings")}
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