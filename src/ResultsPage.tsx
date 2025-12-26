import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { ExtractedData } from "./lib/gemini";
import type { DynamicExtractedData } from "./lib/dynamicExtraction";
import type { FormData, SourceDocumentList } from "./lib/formExtraction";
import { executeAutoFill } from "./lib/formFiller";
import { ToastContainer } from "./components/ToastContainer";
import { OfflineNotifications } from "./lib/offline/OfflineNotifications";

interface ResultsPageProps {
  data: ExtractedData | DynamicExtractedData;
  onBack: () => void;
  onConfirm?: (data: ExtractedData | DynamicExtractedData) => void;
  detectedFormData?: FormData | null;
  detectedSourceDocuments?: SourceDocumentList | null;
}

export default function ResultsPage({ data: initialData, onBack, onConfirm, detectedFormData, detectedSourceDocuments }: ResultsPageProps) {
  const [data, setData] = useState<ExtractedData | DynamicExtractedData>(initialData);
  // Check if we have form data - if yes, always use dynamic mode
  const isDynamicData = !!detectedFormData;
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillResult, setAutoFillResult] = useState<{ filled: number; failed: number; details: string[] } | null>(null);
  const [showAutoFillDetails, setShowAutoFillDetails] = useState(false);

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    const notifications = OfflineNotifications.getInstance();
    notifications.showToast({
      type,
      title,
      message,
      duration: type === 'error' ? 5000 : 3000,
    });
  };

  const handleFieldChange = (field: keyof ExtractedData, value: string | number) => {
    setData({ ...data, [field]: value });
  };

  const handleAutoFill = async () => {
    if (!detectedFormData) {
      showToast('error', 'Auto-Fill Failed', 'No form data available. Please run form detection first.');
      return;
    }

    setIsAutoFilling(true);
    setAutoFillResult(null);
    setShowAutoFillDetails(false);

    console.log("=== AUTO-FILL DEBUG START ===");
    console.log("Detected Form Data:", detectedFormData);
    console.log("Extracted Data:", data);
    console.log("Form Inputs:", detectedFormData.inputs);
    console.log("Available Data Keys:", Object.keys(data));

    try {
      // IMPORTANT: Regenerate accessibility tree if stale (e.g., after page reload)
      // This ensures ref_ids are valid and form filling works correctly
      showToast('info', 'Preparing Form Fill', 'Refreshing form structure...');

      try {
        // Get current tab
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

        if (tab && tab.id) {
          // Send message to content script to regenerate accessibility tree
          console.log('[AutoFill] Regenerating accessibility tree...');
          await browser.tabs.sendMessage(tab.id, {
            action: 'generateAccessibilityTree',
            filter: 'all',
            depth: 15,
            expandCustomSelects: true,
          });
          console.log('[AutoFill] Accessibility tree regenerated successfully');
        }
      } catch (treeError) {
        console.warn('[AutoFill] Failed to regenerate tree, will use ID/name fallback:', treeError);
        // Continue anyway - fallback to ID/name should work
      }

      const result = await executeAutoFill(detectedFormData, data, '');
      setAutoFillResult(result);
      setShowAutoFillDetails(true);

      console.log("=== AUTO-FILL RESULT ===");
      console.log("Filled:", result.filled);
      console.log("Failed:", result.failed);
      console.log("Details:", result.details);

      if (result.filled > 0) {
        showToast(
          'success',
          'Auto-Fill Successful',
          `Successfully filled ${result.filled} field(s)${result.failed > 0 ? `. ${result.failed} field(s) failed.` : '.'}`
        );
      } else {
        showToast(
          'warning',
          'Auto-Fill Failed',
          'Could not fill any fields. Please check the details below.'
        );
      }
    } catch (error) {
      console.error("=== AUTO-FILL ERROR ===", error);
      showToast(
        'error',
        'Auto-Fill Error',
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    } finally {
      setIsAutoFilling(false);
    }
  };

  const renderField = (label: string, field: keyof ExtractedData, type: "text" | "number" = "text") => {
    const value = data[field];
    if (value === undefined || value === null || value === "" || value === 0) return null;

    return (
      <div className="space-y-1.5">
        <Label htmlFor={field} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <Input
          id={field}
          type={type}
          value={value}
          onChange={(e) => handleFieldChange(field, type === "number" ? Number(e.target.value) : e.target.value)}
          className="h-9 text-sm"
        />
      </div>
    );
  };

  return (
    <>
      <ToastContainer />
      <div className="h-screen w-full bg-background flex flex-col">
        {/* Mobile-First Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 -ml-2 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-base font-semibold truncate">Extracted Information</h1>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onConfirm && (
              <Button
                onClick={() => onConfirm(data)}
                variant="default"
                className="h-9 text-xs px-3"
              >
                Confirm & Load
              </Button>
            )}
            {detectedFormData && detectedSourceDocuments && (
              <Button
                onClick={handleAutoFill}
                disabled={isAutoFilling}
                className="h-9 text-xs px-3"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {isAutoFilling ? "Filling..." : "Auto-Fill"}
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          <div className="px-4 py-6 space-y-4 max-w-md mx-auto">

          {/* Auto-fill Result */}
          {showAutoFillDetails && autoFillResult && (
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Auto-Fill Results
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAutoFillDetails(false)}
                    className="h-8 w-8 -mr-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600 font-medium">✓ Filled: {autoFillResult.filled}</span>
                    <span className="text-orange-600 font-medium">⚠ Failed: {autoFillResult.failed}</span>
                  </div>
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                      View Details {autoFillResult.details.length > 0 && `(${autoFillResult.details.length})`}
                    </summary>
                    <div className="mt-2 space-y-1 text-xs font-mono bg-muted p-3 rounded-lg max-h-48 overflow-y-auto">
                      {autoFillResult.details.map((detail, idx) => (
                        <div key={idx}>{detail}</div>
                      ))}
                    </div>
                  </details>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Extracted Data */}
          {isDynamicData ? (
            /* Dynamic Data - Show only extracted fields with data */
            Object.entries(data)
              .filter(([_, value]) => value !== undefined && value !== null && value !== '' && value !== 0)
              .length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Extracted Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const entries = Object.entries(data).filter(([_, value]) => value !== undefined && value !== null && value !== '' && value !== 0);
                    const dateFields = ['d1', 'd2', 'm1', 'm2', 'y1', 'y2', 'y3', 'y4'];
                    const renderedKeys = new Set<string>();

                    return entries.map(([key, value]) => {
                      if (renderedKeys.has(key)) return null;

                      // Check if this is a date component field
                      if (dateFields.includes(key)) {
                        // Group all date fields together
                        const hasD1 = data.d1 || data.d2;
                        const hasM1 = data.m1 || data.m2;
                        const hasY1 = data.y1 || data.y2 || data.y3 || data.y4;

                        if (hasD1 || hasM1 || hasY1) {
                          // Mark all date fields as rendered
                          dateFields.forEach(f => renderedKeys.add(f));

                          return (
                            <div key="birth_date" className="space-y-1.5">
                              <Label className="text-sm text-muted-foreground">জন্ম তারিখ / Date of Birth</Label>
                              <div className="flex gap-2 items-center">
                                <div className="flex gap-1">
                                  <Input value={data.d1 || ''} onChange={(e) => setData({ ...data, d1: e.target.value })} className="h-9 w-10 text-sm text-center p-0" maxLength={1} placeholder="D" />
                                  <Input value={data.d2 || ''} onChange={(e) => setData({ ...data, d2: e.target.value })} className="h-9 w-10 text-sm text-center p-0" maxLength={1} placeholder="D" />
                                </div>
                                <span className="text-muted-foreground">/</span>
                                <div className="flex gap-1">
                                  <Input value={data.m1 || ''} onChange={(e) => setData({ ...data, m1: e.target.value })} className="h-9 w-10 text-sm text-center p-0" maxLength={1} placeholder="M" />
                                  <Input value={data.m2 || ''} onChange={(e) => setData({ ...data, m2: e.target.value })} className="h-9 w-10 text-sm text-center p-0" maxLength={1} placeholder="M" />
                                </div>
                                <span className="text-muted-foreground">/</span>
                                <div className="flex gap-1">
                                  <Input value={data.y1 || ''} onChange={(e) => setData({ ...data, y1: e.target.value })} className="h-9 w-10 text-sm text-center p-0" maxLength={1} placeholder="Y" />
                                  <Input value={data.y2 || ''} onChange={(e) => setData({ ...data, y2: e.target.value })} className="h-9 w-10 text-sm text-center p-0" maxLength={1} placeholder="Y" />
                                  <Input value={data.y3 || ''} onChange={(e) => setData({ ...data, y3: e.target.value })} className="h-9 w-10 text-sm text-center p-0" maxLength={1} placeholder="Y" />
                                  <Input value={data.y4 || ''} onChange={(e) => setData({ ...data, y4: e.target.value })} className="h-9 w-10 text-sm text-center p-0" maxLength={1} placeholder="Y" />
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }

                      // Regular field
                      renderedKeys.add(key);
                      const matchingField = detectedFormData?.inputs.find(
                        field => field.input_field_id === key || field.input_field_name === key
                      );
                      const label = matchingField?.label || key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

                      return (
                        <div key={key} className="space-y-1.5">
                          <Label htmlFor={key} className="text-sm text-muted-foreground">
                            {label}
                          </Label>
                          <Input
                            id={key}
                            type="text"
                            value={String(value)}
                            onChange={(e) => setData({ ...data, [key]: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                      );
                    });
                  })()}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No data extracted
                </CardContent>
              </Card>
            )
          ) : (
            /* Static Data - Original cards */
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Birth Certificate Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderField("Name (English)", "name_english")}
                  {renderField("Name (Bengali)", "name_bengali")}
                  {renderField("Father's Name (English)", "father_name_english")}
                  {renderField("Father's Name (Bengali)", "father_name_bengali")}
                  {renderField("Mother's Name (English)", "mother_name_english")}
                  {renderField("Mother's Name (Bengali)", "mother_name_bengali")}
                  {renderField("Date of Birth", "date_of_birth")}
              {(data.birth_day || data.birth_month || data.birth_year) && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Date Breakdown</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="birth_day" className="text-xs">Day</Label>
                      <Input
                        id="birth_day"
                        type="text"
                        value={data.birth_day}
                        onChange={(e) => handleFieldChange("birth_day", e.target.value)}
                        placeholder="DD"
                        maxLength={2}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="birth_month" className="text-xs">Month</Label>
                      <Input
                        id="birth_month"
                        type="text"
                        value={data.birth_month}
                        onChange={(e) => handleFieldChange("birth_month", e.target.value)}
                        placeholder="MM"
                        maxLength={2}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="birth_year" className="text-xs">Year</Label>
                      <Input
                        id="birth_year"
                        type="text"
                        value={data.birth_year}
                        onChange={(e) => handleFieldChange("birth_year", e.target.value)}
                        placeholder="YYYY"
                        maxLength={4}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
              {renderField("Place of Birth", "place_of_birth")}
              {renderField("Birth Registration Number", "birth_registration_number")}
              {renderField("Sex", "sex")}
              {renderField("Permanent Address", "permanent_address")}
            </CardContent>
          </Card>

          {/* Address Information */}
          {(data.current_address || data.utility_account_number) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Address & Utility Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderField("Current Address", "current_address")}
                {renderField("Utility Account Number", "utility_account_number")}
              </CardContent>
            </Card>
          )}

          {/* Education Information */}
          {(data.education_board || data.ssc_roll_number || data.institution_name) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Education Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderField("Institution Name", "institution_name")}
                {renderField("Education Board", "education_board")}
                {renderField("SSC Roll Number", "ssc_roll_number")}
                {renderField("SSC Registration Number", "ssc_registration_number")}
                {renderField("Passing Year", "ssc_passing_year")}
              </CardContent>
            </Card>
          )}

          {/* Parent/Spouse NID Information */}
          {(data.parent_nid_number || data.parent_name) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Parent/Spouse NID Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderField("Name", "parent_name")}
                {renderField("NID Number", "parent_nid_number")}
                {renderField("Relation", "relation")}
              </CardContent>
            </Card>
          )}

              {/* Other Identification */}
              {('passport_number' in data || 'tin_number' in data || 'driving_license_number' in data) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Other Identification</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {renderField("Passport Number", "passport_number")}
                    {renderField("TIN Number", "tin_number")}
                    {renderField("Driving License Number", "driving_license_number")}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

        {/* Footer Button */}
        <div className="flex-shrink-0 px-4 py-4 border-t bg-background">
          <div className="max-w-md mx-auto">
            <Button onClick={onBack} className="w-full h-11">
              Back to Upload
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
