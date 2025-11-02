import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText } from "lucide-react";
import { useState, useRef } from "react";
import UploadPage from "./UploadPage";
import SettingsPage from "./SettingsPage";
import ProcessingScreen from "./ProcessingScreen";
import ResultsPage from "./ResultsPage";
import type { ExtractedData } from "./lib/gemini";
import type { ProgressEvent } from "./lib/observers/ProcessingObserver";

type DocumentType = "birthCertificate" | "utilityBill" | "educationCertificate" | "nidCard" | "passport" | "other";

interface DocumentUpload {
  type: DocumentType;
  file: File | null;
  required: boolean;
  label: string;
  description: string;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<"home" | "upload" | "settings" | "loading" | "results">("home");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
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

  if (currentPage === "upload") {
    return (
      <UploadPage
        documents={documents}
        setDocuments={setDocuments}
        onClearAll={clearAllDocuments}
        onBack={() => setCurrentPage("home")}
        onSettings={() => setCurrentPage("settings")}
        onProcessStart={() => setCurrentPage("loading")}
        onProcessComplete={(data) => {
          setExtractedData(data);
          setCurrentPage("results");
        }}
        onProgressCallback={handleProgressCallback}
      />
    );
  }

  if (currentPage === "settings") {
    return <SettingsPage onBack={() => setCurrentPage("upload")} />;
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
      />
    );
  }

  return (
    <div className="h-screen w-full bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-10 text-center">
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
          Upload your documents and let AI extract and auto-fill information for NID applications.
        </p>

        {/* CTA Button */}
        <div className="pt-4">
          <Button
            onClick={() => setCurrentPage("upload")}
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