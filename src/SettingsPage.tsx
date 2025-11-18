import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Eye, EyeOff, Trash2, FileText, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getCachedFormData, clearFormCache, getCacheInfo } from "./lib/FormCache";

interface SettingsPageProps {
  onBack: () => void;
}

const GEMINI_MODELS = [
  "Gemini 2.5 Flash",
  "Gemini 2.5 Flash-Lite",
  "Gemini 2.5 Pro",
  "Gemini 2.0 Flash",
  "Gemini 2.0 Flash-Lite",
  "Gemini 1.5 Pro",
  "Gemini 1.5 Flash",
] as const;

const formSchema = z.object({
  apiKey: z
    .string()
    .min(1, "API key is required")
    .min(20, "API key must be at least 20 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "API key contains invalid characters"),
  model: z.enum(GEMINI_MODELS, {
    message: "Please select a model",
  }),
  enableOfflineMode: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function SettingsPage({ onBack }: SettingsPageProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<any>(null);
  const [loadingCache, setLoadingCache] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apiKey: localStorage.getItem("gemini_api_key") || "",
      model: (localStorage.getItem("gemini_model") as FormValues["model"]) || "Gemini 2.0 Flash",
      enableOfflineMode: localStorage.getItem("enable_offline_mode") !== "false", // Enabled by default
    },
  });

  const onSubmit = (values: FormValues) => {
    localStorage.setItem("gemini_api_key", values.apiKey.trim());
    localStorage.setItem("gemini_model", values.model);
    localStorage.setItem("enable_offline_mode", String(values.enableOfflineMode ?? true));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClearQueue = async () => {
    const confirmed = confirm(
      '⚠️ CLEAR ALL QUEUED DOCUMENTS?\n\n' +
      'This will permanently delete all documents stored offline.\n' +
      'This action cannot be undone.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    try {
      const SimpleOfflineQueue = (await import('./lib/offline/SimpleOfflineQueue')).default;
      const queue = SimpleOfflineQueue();
      const cleared = await queue.clearAll();
      alert(`✅ Cleared ${cleared} queued document(s) successfully.`);
    } catch (error) {
      console.error('[Settings] Failed to clear queue:', error);
      alert('❌ Failed to clear queue. Please try again.');
    }
  };

  const loadCacheInfo = async () => {
    setLoadingCache(true);
    try {
      const info = await getCacheInfo();
      setCacheInfo(info);
    } catch (error) {
      console.error('[Settings] Failed to load cache info:', error);
      setCacheInfo(null);
    } finally {
      setLoadingCache(false);
    }
  };

  const handleClearFormCache = async () => {
    const confirmed = confirm(
      '⚠️ CLEAR FORM CACHE?\n\n' +
      'This will delete the cached form detection data.\n' +
      'You will need to re-detect the form next time.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    try {
      clearFormCache();
      setCacheInfo(null);
      alert('✅ Form cache cleared successfully.');
    } catch (error) {
      console.error('[Settings] Failed to clear cache:', error);
      alert('❌ Failed to clear cache. Please try again.');
    }
  };

  // Load cache info on mount
  useEffect(() => {
    loadCacheInfo();
  }, []);

  return (
    <div className="h-screen w-full bg-background p-6 overflow-auto">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>


        {/* API Configuration Card */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>
                  Configure your Gemini API credentials for document extraction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* API Key Field */}
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gemini API Key</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showApiKey ? "text" : "password"}
                            placeholder="Enter your API key"
                            className="pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={showApiKey ? "Hide API key" : "Show API key"}
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Get your API key from{" "}
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground"
                        >
                          Google AI Studio
                        </a>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Model Field */}
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gemini Model</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {GEMINI_MODELS.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose speed / cost trade-offs for document extraction
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator className="my-6" />

                {/* Security & Privacy Section */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Security & Privacy</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage offline storage and queued documents
                    </p>
                  </div>

                  {/* Offline Mode Toggle */}
                  <FormField
                    control={form.control}
                    name="enableOfflineMode"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Offline Mode</FormLabel>
                          <FormDescription>
                            Allow documents to be queued when offline<br />
                            <span className="text-xs text-yellow-600 dark:text-yellow-500">
                              ⚠️ Documents stored unencrypted on device
                            </span>
                          </FormDescription>
                        </div>
                        <FormControl>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={field.value ?? true}
                            onClick={() => field.onChange(!(field.value ?? true))}
                            className={`
                              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                              ${field.value ?? true ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}
                            `}
                          >
                            <span
                              className={`
                                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                ${field.value ?? true ? 'translate-x-6' : 'translate-x-1'}
                              `}
                            />
                          </button>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Clear Queue Button */}
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-destructive">Danger Zone</h4>
                      <p className="text-xs text-muted-foreground">
                        Clear all documents stored offline. This cannot be undone.
                      </p>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleClearQueue}
                      >
                        Clear All Queued Documents
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Form Cache Management */}
                <Separator className="my-6" />
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Form Cache</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage cached form detection data to save API credits
                    </p>
                  </div>

                  {loadingCache ? (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">
                        Loading cache information...
                      </CardContent>
                    </Card>
                  ) : cacheInfo && cacheInfo.exists ? (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Cached Form Data
                              {cacheInfo.isCurrent && (
                                <Badge variant="secondary" className="text-xs">Current Page</Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {cacheInfo.url ? new URL(cacheInfo.url).hostname : 'Unknown URL'}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Form Fields</p>
                            <p className="font-semibold">{cacheInfo.formFieldCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Documents</p>
                            <p className="font-semibold">{cacheInfo.documentCount || 0}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Cached on {cacheInfo.cachedAt?.toLocaleDateString()} at{' '}
                            {cacheInfo.cachedAt?.toLocaleTimeString()}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={loadCacheInfo}
                            className="flex-1"
                          >
                            Refresh
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleClearFormCache}
                            className="flex-1"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Clear Cache
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground">No cached form data found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Form detection results will be cached automatically to save API credits
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <Separator />
                <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full"
            >
              {isSaved ? "Saved Successfully!" : "Save Settings"}
            </Button>
              </CardContent>
            </Card>

            {/* Save Button */}
            
          </form>
        </Form>
      </div>
    </div>
  );
}
