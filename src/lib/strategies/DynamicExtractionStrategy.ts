/**
 * Concrete Strategy: Dynamic Extraction
 *
 * Uses AI-detected form schema for flexible extraction
 * Best for: Unknown forms, custom government portals, varying structures
 */

import type { GoogleGenAI } from "@google/genai";
import type { IExtractionStrategy } from "./ExtractionStrategy";
import type { FormData } from "../formExtraction";
import { processDynamicDocuments } from "../dynamicExtraction";

export class DynamicExtractionStrategy implements IExtractionStrategy {
  getName(): string {
    return "DynamicExtractionStrategy";
  }

  canHandle(formData?: FormData | null): boolean {
    // Use dynamic extraction when form data is available
    return !!formData && formData.inputs.length > 0;
  }

  async extract(
    files: File[],
    ai: GoogleGenAI,
    model: string,
    formData?: FormData | null,
    onProgress?: (event: any) => void
  ): Promise<Record<string, string>> {
    if (!formData || formData.inputs.length === 0) {
      throw new Error('[DynamicExtractionStrategy] Form data is required for dynamic extraction');
    }

    console.log('[DynamicExtractionStrategy] Processing documents with AI-detected schema:', {
      formName: formData.form_name,
      fieldCount: formData.inputs.length,
    });

    // Get API key from the AI client
    const apiKey = (ai as any).apiKey;

    // Use dynamic extraction based on detected form fields
    const result = await processDynamicDocuments(
      files,
      formData,
      apiKey,
      model,
      (event) => {
        // Convert dynamic progress to standard progress format
        if (onProgress) {
          const status = event.stage === "upload" ? "uploading" as const :
                        event.stage === "extract" ? "processing" as const :
                        event.stage === "error" ? "error" as const :
                        "completed" as const;

          onProgress({
            fileName: event.documentName,
            status,
            current: event.currentDocument,
            total: event.totalDocuments,
            message: event.message,
            error: event.stage === "error" ? event.message : undefined,
          });
        }
      }
    );

    console.log('[DynamicExtractionStrategy] Extraction complete:', {
      fieldsExtracted: Object.keys(result).length,
      fields: Object.keys(result),
    });

    return result;
  }
}
