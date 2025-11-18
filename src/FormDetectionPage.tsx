import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, CheckCircle2, FileSearch, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { detectAndExtractForm, detectRequiredDocuments, type FormData, type SourceDocumentList } from "./lib/formExtraction";

interface FormDetectionPageProps {
  onBack: () => void;
  onContinueToUpload?: (formData: FormData, sourceDocuments: SourceDocumentList) => void;
}

export default function FormDetectionPage({ onBack, onContinueToUpload }: FormDetectionPageProps) {
  const [isDetecting, setIsDetecting] = useState(true);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocumentList | null>(null);
  const [currentStep, setCurrentStep] = useState<"detecting_form" | "detecting_documents" | "complete">("detecting_form");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detectFormAndDocuments = async () => {
      try {
        // Get API key from localStorage
        const apiKey = localStorage.getItem("gemini_api_key");

        if (!apiKey) {
          setError("API key not found. Please configure your API key in settings.");
          setIsDetecting(false);
          return;
        }

        // Step 1: Detect and extract form from current page
        setCurrentStep("detecting_form");
        const extractedFormData = await detectAndExtractForm(apiKey);
        setFormData(extractedFormData);
        console.log("Detected form:", extractedFormData);

        // Step 2: Detect required documents
        setCurrentStep("detecting_documents");
        const requiredDocuments = await detectRequiredDocuments(extractedFormData, apiKey);
        setSourceDocuments(requiredDocuments);
        console.log("Required documents:", requiredDocuments);

        // Complete
        setCurrentStep("complete");
      } catch (err) {
        console.error("Error detecting form:", err);

        // Check if it's a network error
        const errorMessage = err instanceof Error ? err.message : "Failed to detect form";
        const isNetworkError = errorMessage.includes("Failed to fetch") ||
                               errorMessage.includes("NetworkError") ||
                               errorMessage.includes("ERR_NAME_NOT_RESOLVED") ||
                               !navigator.onLine;

        if (isNetworkError) {
          setError("Cannot detect form while offline. Please connect to the internet and try again, or go back and manually upload your documents.");
        } else {
          setError(errorMessage);
        }
      } finally {
        setIsDetecting(false);
      }
    };

    detectFormAndDocuments();
  }, []);

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold">Form Detection</h2>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Loading State */}
          {isDetecting && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">
                  {currentStep === "detecting_form" && "Detecting Form..."}
                  {currentStep === "detecting_documents" && "Analyzing Required Documents..."}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {currentStep === "detecting_form" && "Analyzing the current page to identify form fields and structure."}
                  {currentStep === "detecting_documents" && "Determining which documents you need to collect to fill this form."}
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {!isDetecting && error && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <FileSearch className="w-10 h-10 text-destructive" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Detection Failed</h3>
                <p className="text-sm text-muted-foreground max-w-md">{error}</p>
              </div>
              <Button onClick={onBack}>Go Back</Button>
            </div>
          )}

          {/* No Form Detected State */}
          {!isDetecting && !error && formData && formData.inputs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                <FileSearch className="w-10 h-10 text-muted-foreground" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">No Form Detected</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  We couldn't find any form fields on the current page. Please make sure you're on a page with a form.
                </p>
              </div>
              <Button onClick={onBack}>Go Back</Button>
            </div>
          )}

          {/* Success State */}
          {!isDetecting && !error && formData && formData.inputs.length > 0 && sourceDocuments && (
            <div className="space-y-6">
              {/* Success Header */}
              <div className="flex items-center gap-3 pb-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{sourceDocuments.form_type_english}</h3>
                  <p className="text-sm text-muted-foreground">{sourceDocuments.form_type_bangla}</p>
                </div>
              </div>

              {/* Required Documents Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Required Documents</CardTitle>
                  <CardDescription>
                    Collect these {sourceDocuments.source_documents.length} documents to fill this form
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sourceDocuments.source_documents.map((doc, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-primary" />
                          <div>
                            <h4 className="font-medium text-sm">{doc.document_name_english}</h4>
                            <p className="text-xs text-muted-foreground">{doc.document_name_bangla}</p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            doc.necessity === "required"
                              ? "destructive"
                              : doc.necessity === "optional"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {doc.necessity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={onBack} className="flex-1">
                  Go Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => onContinueToUpload?.(formData, sourceDocuments)}
                  disabled={!onContinueToUpload}
                >
                  Continue to Upload
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
