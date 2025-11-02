import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

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
});

type FormValues = z.infer<typeof formSchema>;

export default function SettingsPage({ onBack }: SettingsPageProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apiKey: localStorage.getItem("gemini_api_key") || "",
      model: (localStorage.getItem("gemini_model") as FormValues["model"]) || "Gemini 2.0 Flash",
    },
  });

  const onSubmit = (values: FormValues) => {
    localStorage.setItem("gemini_api_key", values.apiKey.trim());
    localStorage.setItem("gemini_model", values.model);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

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
