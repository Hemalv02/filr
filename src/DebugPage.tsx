import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bug, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

interface DebugPageProps {
  onBack: () => void;
}

interface DetectedInput {
  tag: string;
  type: string;
  id: string;
  name: string;
  placeholder: string;
  value: string;
  label: string;
}

export default function DebugPage({ onBack }: DebugPageProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [inputs, setInputs] = useState<DetectedInput[]>([]);
  const [isFilling, setIsFilling] = useState(false);
  const [fillResult, setFillResult] = useState<{ filled: number; failed: number; details: string[] } | null>(null);

  const detectAllInputs = async () => {
    setIsDetecting(true);
    setInputs([]);

    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        alert("No active tab found");
        return;
      }

      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const detectedInputs: any[] = [];

          // Get all input, textarea, and select elements
          const allElements = document.querySelectorAll('input, textarea, select');

          allElements.forEach((element, index) => {
            if (element instanceof HTMLInputElement ||
                element instanceof HTMLTextAreaElement ||
                element instanceof HTMLSelectElement) {

              // Try to find associated label
              let label = '';
              if (element.id) {
                const labelElement = document.querySelector(`label[for="${element.id}"]`);
                if (labelElement) {
                  label = labelElement.textContent?.trim() || '';
                }
              }

              // If no label found, look for parent label
              if (!label) {
                const parentLabel = element.closest('label');
                if (parentLabel) {
                  label = parentLabel.textContent?.trim() || '';
                }
              }

              // If still no label, look for nearby text
              if (!label && element.previousElementSibling) {
                label = element.previousElementSibling.textContent?.trim() || '';
              }

              detectedInputs.push({
                tag: element.tagName.toLowerCase(),
                type: element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase(),
                id: element.id || '',
                name: element.getAttribute('name') || '',
                placeholder: element.getAttribute('placeholder') || '',
                value: element.value || '',
                label: label.substring(0, 100), // Limit label length
              });
            }
          });

          return detectedInputs;
        },
      });

      if (results && results[0] && results[0].result) {
        setInputs(results[0].result as DetectedInput[]);
      }
    } catch (error) {
      console.error("Detection error:", error);
      alert(`Failed to detect inputs: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const fillWithRandomText = async () => {
    setIsFilling(true);
    setFillResult(null);

    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        alert("No active tab found");
        return;
      }

      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const details: string[] = [];
          let filled = 0;
          let failed = 0;

          const randomNames = ['John Doe', 'Jane Smith', 'রহিম আলী', 'করিম মিয়া'];
          const randomDates = ['01/01/1990', '15/06/1985', '25/12/1995'];
          const randomNumbers = ['123456789', '987654321', '555555555'];

          function getRandomText(type: string): string {
            if (type.includes('date') || type.includes('birth')) {
              return randomDates[Math.floor(Math.random() * randomDates.length)];
            } else if (type.includes('number') || type.includes('phone') || type.includes('mobile')) {
              return randomNumbers[Math.floor(Math.random() * randomNumbers.length)];
            } else if (type.includes('email')) {
              return 'test@example.com';
            } else {
              return randomNames[Math.floor(Math.random() * randomNames.length)];
            }
          }

          function setInputValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): boolean {
            try {
              const originalValue = element.value;

              // Set value
              element.value = value;

              // Trigger events
              const events = [
                new Event('input', { bubbles: true, cancelable: true }),
                new Event('change', { bubbles: true, cancelable: true }),
                new Event('blur', { bubbles: true, cancelable: true }),
              ];

              events.forEach(event => element.dispatchEvent(event));

              // For React compatibility
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
              )?.set;

              if (nativeInputValueSetter && element instanceof HTMLInputElement) {
                nativeInputValueSetter.call(element, value);
                element.dispatchEvent(new Event('input', { bubbles: true }));
              }

              const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                'value'
              )?.set;

              if (nativeTextAreaValueSetter && element instanceof HTMLTextAreaElement) {
                nativeTextAreaValueSetter.call(element, value);
                element.dispatchEvent(new Event('input', { bubbles: true }));
              }

              return true;
            } catch (error) {
              console.error('Error setting value:', error);
              return false;
            }
          }

          // Get all inputs
          const allElements = document.querySelectorAll('input, textarea, select');

          allElements.forEach((element, index) => {
            if (element instanceof HTMLInputElement ||
                element instanceof HTMLTextAreaElement ||
                element instanceof HTMLSelectElement) {

              // Skip hidden, submit, button inputs
              if (element instanceof HTMLInputElement) {
                if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(element.type)) {
                  return;
                }
              }

              const identifier = element.id || element.name || `element-${index}`;
              const elementType = element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase();
              const randomValue = getRandomText(identifier.toLowerCase() + ' ' + elementType);

              const success = setInputValue(element, randomValue);

              if (success) {
                details.push(`✓ Filled [${identifier}] (${elementType}): "${randomValue}"`);
                filled++;
              } else {
                details.push(`✗ Failed to fill [${identifier}] (${elementType})`);
                failed++;
              }
            }
          });

          return { filled, failed, details };
        },
      });

      if (results && results[0] && results[0].result) {
        const result = results[0].result as { filled: number; failed: number; details: string[] };
        setFillResult(result);
        alert(`Filled ${result.filled} fields! Failed: ${result.failed}`);
      }
    } catch (error) {
      console.error("Fill error:", error);
      alert(`Failed to fill inputs: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsFilling(false);
    }
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold">Debug: Form Detection & Fill</h2>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={detectAllInputs}
              disabled={isDetecting}
              className="flex-1"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Detecting...
                </>
              ) : (
                <>
                  <Bug className="w-4 h-4 mr-2" />
                  Detect All Inputs
                </>
              )}
            </Button>
            <Button
              onClick={fillWithRandomText}
              disabled={isFilling}
              variant="secondary"
              className="flex-1"
            >
              {isFilling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Filling...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Fill with Random Text
                </>
              )}
            </Button>
          </div>

          {/* Fill Results */}
          {fillResult && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-base">Fill Results</CardTitle>
                <CardDescription>
                  Filled: {fillResult.filled} | Failed: {fillResult.failed}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <details open className="group">
                  <summary className="cursor-pointer text-sm font-medium mb-2">
                    View Details ({fillResult.details.length})
                  </summary>
                  <div className="space-y-1 text-xs font-mono bg-muted p-3 rounded-lg max-h-96 overflow-y-auto">
                    {fillResult.details.map((detail, idx) => (
                      <div key={idx} className={detail.startsWith('✓') ? 'text-green-600' : 'text-orange-600'}>
                        {detail}
                      </div>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          )}

          {/* Detected Inputs */}
          {inputs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detected Inputs ({inputs.length})</CardTitle>
                <CardDescription>
                  All form elements found on the current page
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {inputs.map((input, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          {input.label && (
                            <div className="font-medium text-sm">{input.label}</div>
                          )}
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline">{input.tag}</Badge>
                            {input.type && <Badge variant="secondary">{input.type}</Badge>}
                            {input.id && (
                              <span className="text-muted-foreground">
                                <span className="font-medium">ID:</span> {input.id}
                              </span>
                            )}
                            {input.name && (
                              <span className="text-muted-foreground">
                                <span className="font-medium">Name:</span> {input.name}
                              </span>
                            )}
                          </div>
                          {input.placeholder && (
                            <div className="text-xs text-muted-foreground">
                              Placeholder: {input.placeholder}
                            </div>
                          )}
                          {input.value && (
                            <div className="text-xs text-muted-foreground">
                              Current Value: {input.value}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="flex-shrink-0">
                          #{index + 1}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {inputs.length === 0 && !isDetecting && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Click "Detect All Inputs" to scan the current page</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
