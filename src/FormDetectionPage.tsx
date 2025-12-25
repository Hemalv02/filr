import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, CheckCircle2, FileSearch, FileText, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { detectAndExtractForm, detectRequiredDocuments, type FormData, type SourceDocumentList } from "./lib/formExtraction";
import {
  getCachedFormData,
  isCachedFormCurrent,
  cacheFormData,
  clearFormCache,
  getCacheInfo,
} from "./lib/FormCache";

interface FormDetectionPageProps {
  onBack: () => void;
  onContinueToUpload?: (formData: FormData, sourceDocuments: SourceDocumentList) => void;
}

export default function FormDetectionPage({ onBack, onContinueToUpload }: FormDetectionPageProps) {
  const [isDetecting, setIsDetecting] = useState(false); // Start false, check cache first
  const [formData, setFormData] = useState<FormData | null>(null);
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocumentList | null>(null);
  const [currentStep, setCurrentStep] = useState<"detecting_form" | "detecting_documents" | "complete">("detecting_form");
  const [error, setError] = useState<string | null>(null);

  // Cache-related state
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<any>(null);

  useEffect(() => {
    // Check cache first before detecting
    const checkCacheAndDetect = async () => {
      try {
        const info = await getCacheInfo();

        if (info && info.exists && info.isCurrent) {
          // Cache exists and matches current form
          console.log('[FormDetection] Found matching cache - showing resume dialog');
          setCacheInfo(info);
          setShowResumeDialog(true);
        } else {
          // No cache or different form - start fresh detection
          console.log('[FormDetection] No matching cache - starting fresh detection');
          startFreshDetection();
        }
      } catch (err) {
        console.error('[FormDetection] Error checking cache:', err);
        // If cache check fails, just start fresh
        startFreshDetection();
      }
    };

    checkCacheAndDetect();
  }, []);

  const handleResumeCache = async () => {
    console.log('[FormDetection] User chose to resume cached form');
    setShowResumeDialog(false);

    try {
      const cached = await getCachedFormData();
      if (cached) {
        setFormData(cached.formData);
        setSourceDocuments(cached.sourceDocuments);
        setCurrentStep("complete");
      } else {
        // Cache disappeared, start fresh
        startFreshDetection();
      }
    } catch (err) {
      console.error('[FormDetection] Error loading cache:', err);
      setError("Failed to load cached data. Starting fresh detection...");
      startFreshDetection();
    }
  };

  const handleStartNewDetection = () => {
    console.log('[FormDetection] User chose to start new detection');
    setShowResumeDialog(false);
    clearFormCache();
    startFreshDetection();
  };

  const startFreshDetection = () => {
    setIsDetecting(true);
    detectFormAndDocuments();
  };

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

      // Step 3: Cache the results for future use
      console.log('[FormDetection] Caching detection results...');
      await cacheFormData(extractedFormData, requiredDocuments);

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

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-sm font-semibold">Form Detection</h2>
        <div className="w-8" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-3">
          {/* Resume Cache Dialog */}
          {showResumeDialog && cacheInfo && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <RefreshCw className="w-10 h-10 text-blue-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Resume Previous Session?</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  We found a previously detected form for this page.
                </p>
              </div>

              {/* Cache Info Card */}
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="text-base">Cached Form Data</CardTitle>
                  <CardDescription>
                    Detected on {cacheInfo.cachedAt?.toLocaleDateString()} at{' '}
                    {cacheInfo.cachedAt?.toLocaleTimeString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Form Fields:</span>
                    <span className="font-medium">{cacheInfo.formFieldCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Required Documents:</span>
                    <span className="font-medium">{cacheInfo.documentCount}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full max-w-md">
                <Button
                  onClick={handleResumeCache}
                  className="flex-1"
                  size="lg"
                >
                  Resume Session
                </Button>
                <Button
                  onClick={handleStartNewDetection}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  Start New Detection
                </Button>
              </div>

              <p className="text-xs text-muted-foreground max-w-md text-center">
                💡 <strong>Tip:</strong> Resume to save API credits. Start new if the form has changed.
              </p>
            </div>
          )}

          {/* Loading State */}
          {!showResumeDialog && isDetecting && (
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
          {!showResumeDialog && !isDetecting && error && (
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
          {!showResumeDialog && !isDetecting && !error && formData && formData.inputs.length === 0 && (
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
          {!showResumeDialog && !isDetecting && !error && formData && formData.inputs.length > 0 && sourceDocuments && (
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
