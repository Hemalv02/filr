import { Button } from "@/components/ui/button";
import { Code } from "lucide-react";
import { useState } from "react";

interface HTMLSourcePageProps {
  onBack: () => void;
}

export default function HTMLSourcePage({ onBack }: HTMLSourcePageProps) {
  const [status, setStatus] = useState<string>("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const checkPermissions = async () => {
    try {
      const hasScripting = await browser.permissions.contains({
        permissions: ["scripting", "tabs"],
      });
      setHasPermission(hasScripting);
      return hasScripting;
    } catch (error) {
      console.error("Error checking permissions:", error);
      setStatus("Error checking permissions");
      setHasPermission(false);
      return false;
    }
  };

  const getHTMLSource = async () => {
    setStatus("Checking permissions...");

    await checkPermissions();

    try {
      setStatus("Getting current tab...");

      // Get the current active tab
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        setStatus("No active tab found");
        return;
      }

      setStatus("Injecting script to get HTML source...");

      // Execute script in the page context to get HTML source
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return document.documentElement.outerHTML;
        },
      });

      if (results && results[0] && results[0].result) {
        const htmlSource = results[0].result as string;
        console.log("=== HTML Source of Current Page ===");
        console.log(htmlSource);
        console.log("=== End of HTML Source ===");
        setStatus(`Success! HTML source logged to console (${htmlSource.length} characters)`);
      } else {
        setStatus("Failed to retrieve HTML source");
      }
    } catch (error: any) {
      console.error("Error getting HTML source:", error);
      setStatus(`Error: ${error.message || "Failed to get HTML source"}`);
    }
  };

  // Check permissions on mount
  useState(() => {
    checkPermissions();
  });

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <h2 className="text-lg font-semibold">HTML Source Viewer</h2>
        <div className="w-16" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
        <div className="w-24 h-24 rounded-2xl bg-foreground/10 flex items-center justify-center">
          <Code className="w-12 h-12 text-foreground" />
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold">Get HTML Source</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Click the button below to access the HTML source of the current page.
            The source will be logged to the console.
          </p>
        </div>

        <Button
          onClick={getHTMLSource}
          size="lg"
          className="w-full max-w-xs"
        >
          Get HTML Source
        </Button>

        {status && (
          <div className="bg-muted rounded-lg p-4 max-w-md text-sm">
            <p className="text-foreground">{status}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center max-w-md">
          Open the browser console (F12 or Cmd+Option+I) to view the HTML source output.
        </p>
      </div>
    </div>
  );
}
