import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, CheckCircle2, FileSearch, FileText, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { detectAndExtractForm, detectRequiredDocuments, type FormData, type SourceDocumentList } from "./lib/formExtraction";
import { FormDetectionSteps } from "./components/FormDetectionSteps";
import { cn } from "@/lib/utils";
import { ApiKeyManager } from "./lib/secureStorage";
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

type DetectionStep = 
  | "generating_tree"
  | "detecting_form" 
  | "validating_form"
  | "detecting_documents"
  | "caching_results"
  | "complete";

export default function FormDetectionPage({ onBack, onContinueToUpload }: FormDetectionPageProps) {
  const [isDetecting, setIsDetecting] = useState(false); // Start false, check cache first
  const [formData, setFormData] = useState<FormData | null>(null);
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocumentList | null>(null);
  const [currentStep, setCurrentStep] = useState<DetectionStep>("generating_tree");
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
    // Clear all previous session data
    setFormData(null);
    setSourceDocuments(null);
    setError(null);
    clearFormCache();
    startFreshDetection();
  };

  const startFreshDetection = async () => {
    setCurrentStep("generating_tree");
    setIsDetecting(true);
    // Small delay to ensure UI shows the initial loading state
    await new Promise(resolve => setTimeout(resolve, 300));
    detectFormAndDocuments();
  };

  const detectFormAndDocuments = async () => {
    try {
      // Get API key from localStorage
      const apiKey = ApiKeyManager.getInstance().getApiKey();

      if (!apiKey) {
        setError("API key not found. Please configure your API key in settings.");
        setIsDetecting(false);
        return;
      }

      // Step 1: Detect and extract form from current page
      // Step is already set to "generating_tree" in startFreshDetection
      const extractedFormData = await detectAndExtractForm(apiKey, (step) => {
        setCurrentStep(step as DetectionStep);
      });
      setFormData(extractedFormData);
      console.log("Detected form:", extractedFormData);

      // Step 2: Detect required documents
      // The callback will handle setting the step to "detecting_documents"
      const requiredDocuments = await detectRequiredDocuments(
        extractedFormData,
        apiKey,
        (step) => {
          setCurrentStep(step as DetectionStep);
        }
      );
      setSourceDocuments(requiredDocuments);
      console.log("Required documents:", requiredDocuments);

      // Step 3: Cache the results for future use
      setCurrentStep("caching_results");
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
        <h1 className="text-base font-semibold flex-1">Form Detection</h1>
      </div>

      {/* Content - Mobile Optimized */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 py-6">
          {/* Resume Cache Dialog */}
          {showResumeDialog && cacheInfo && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Resume Previous Session?</h3>
                <p className="text-sm text-muted-foreground">
                  We found a previously detected form for this page.
                </p>
              </div>

              {/* Cache Info Card */}
              <Card className="w-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cached Form Data</CardTitle>
                  <CardDescription className="text-xs">
                    Detected on {cacheInfo.cachedAt?.toLocaleDateString()} at{' '}
                    {cacheInfo.cachedAt?.toLocaleTimeString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
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

              {/* Action Buttons - Mobile Friendly */}
              <div className="flex flex-col gap-3 w-full">
                <Button
                  onClick={handleResumeCache}
                  className="w-full h-11"
                  size="lg"
                >
                  Resume Session
                </Button>
                <Button
                  onClick={handleStartNewDetection}
                  variant="outline"
                  className="w-full h-11"
                  size="lg"
                >
                  Start New Detection
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center px-4">
                💡 <strong>Tip:</strong> Resume to save API credits. Start new if the form has changed.
              </p>
            </div>
          )}

          {/* Loading State with Step Indicators - Mobile Optimized */}
          {!showResumeDialog && isDetecting && (
            <div className="flex flex-col py-4">
              <div className="w-full max-w-md mx-auto">
                <FormDetectionSteps currentStep={currentStep} />
              </div>
            </div>
          )}

          {/* Error State - Mobile Optimized */}
          {!showResumeDialog && !isDetecting && error && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <FileSearch className="w-8 h-8 text-destructive" />
              </div>
              <div className="text-center space-y-2 px-4">
                <h3 className="text-lg font-semibold">Detection Failed</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={onBack} className="w-full h-11">Go Back</Button>
            </div>
          )}

          {/* No Form Detected State - Mobile Optimized */}
          {!showResumeDialog && !isDetecting && !error && formData && formData.inputs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <FileSearch className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center space-y-2 px-4">
                <h3 className="text-lg font-semibold">No Form Detected</h3>
                <p className="text-sm text-muted-foreground">
                  We couldn't find any form fields on the current page. Please make sure you're on a page with a form.
                </p>
              </div>
              <Button onClick={onBack} className="w-full h-11">Go Back</Button>
            </div>
          )}

          {/* Success State - Mobile Optimized */}
          {!showResumeDialog && !isDetecting && !error && formData && formData.inputs.length > 0 && sourceDocuments && (
            <div className="space-y-6 max-w-md mx-auto">
              {/* Success Header */}
              <div className="flex items-center gap-3 pb-1">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold leading-tight">{sourceDocuments.form_type_english}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{sourceDocuments.form_type_bangla}</p>
                </div>
              </div>

              {/* Summary Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-foreground">{formData.inputs.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Form Fields</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-foreground">{sourceDocuments.source_documents.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Documents</div>
                </div>
              </div>

              {/* Required Documents Card */}
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Required Documents
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Collect these documents to fill this form
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2.5">
                    {sourceDocuments.source_documents.map((doc, index) => {
                      const isRequired = doc.necessity === "required";
                      return (
                        <div
                          key={index}
                          className={cn(
                            "relative flex items-start gap-3 p-3.5 rounded-lg border transition-all",
                            isRequired 
                              ? "border-destructive/20 bg-destructive/5" 
                              : "border-border bg-background",
                            "active:scale-[0.98] active:bg-muted/50"
                          )}
                        >
                          {/* Document Icon */}
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                            isRequired 
                              ? "bg-destructive/10" 
                              : "bg-muted"
                          )}>
                            <FileText className={cn(
                              "w-5 h-5",
                              isRequired ? "text-destructive" : "text-muted-foreground"
                            )} />
                          </div>

                          {/* Document Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-semibold text-sm leading-tight">{doc.document_name_english}</h4>
                              <Badge
                                variant={
                                  doc.necessity === "required"
                                    ? "destructive"
                                    : doc.necessity === "optional"
                                    ? "secondary"
                                    : "default"
                                }
                                className="flex-shrink-0 text-xs"
                              >
                                {doc.necessity}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {doc.document_name_bangla}
                            </p>
                            {doc.notes && (
                              <p className="text-xs text-muted-foreground/80 mt-1.5 italic">
                                {doc.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Additional Notes */}
              {sourceDocuments.additional_notes && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3.5">
                  <p className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed">
                    <strong className="font-semibold">💡 Note:</strong> {sourceDocuments.additional_notes}
                  </p>
                </div>
              )}

              {/* Action Buttons - Mobile Friendly */}
              <div className="flex flex-col gap-3 pt-2">
                <Button
                  className="w-full h-11 font-semibold"
                  onClick={() => onContinueToUpload?.(formData, sourceDocuments)}
                  disabled={!onContinueToUpload}
                >
                  Continue to Upload
                </Button>
                <Button variant="outline" onClick={onBack} className="w-full h-11">
                  Go Back
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
