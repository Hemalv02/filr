/**
 * Concrete Strategy: Static Extraction
 *
 * Uses predefined schema for known Bangladesh government documents
 * Best for: Forms with fixed structure (NID, Birth Certificate, etc.)
 */

import type { GoogleGenAI } from "@google/genai";
import type { IExtractionStrategy } from "./ExtractionStrategy";
import type { FormData } from "../formExtraction";
import { processDocuments } from "../gemini";

export class StaticExtractionStrategy implements IExtractionStrategy {
  getName(): string {
    return "StaticExtractionStrategy";
  }

  canHandle(formData?: FormData | null): boolean {
    // Use static extraction when no form data is available (backwards compatibility)
    return !formData || formData.inputs.length === 0;
  }

  async extract(
    files: File[],
    ai: GoogleGenAI,
    model: string,
    formData?: FormData | null,
    onProgress?: (event: any) => void
  ): Promise<Record<string, string>> {
    console.log('[StaticExtractionStrategy] Processing documents with predefined schema');

    // Get API key from the AI client (hacky but works for now)
    const apiKey = (ai as any).apiKey;

    // Use the existing Chain of Responsibility pattern
    const result = await processDocuments(files, apiKey, model, onProgress);

    console.log('[StaticExtractionStrategy] Extraction complete:', {
      fieldsExtracted: Object.keys(result).length,
    });

    // Convert ExtractedData to Record<string, string>
    return result as unknown as Record<string, string>;
  }
}
