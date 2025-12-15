/**
 * Concrete Strategy: Hybrid Extraction
 *
 * Combines static and dynamic approaches for best results
 * Best for: Complex forms with both known and unknown fields
 */

import type { GoogleGenAI } from "@google/genai";
import type { IExtractionStrategy } from "./ExtractionStrategy";
import type { FormData } from "../formExtraction";
import { StaticExtractionStrategy } from "./StaticExtractionStrategy";
import { DynamicExtractionStrategy } from "./DynamicExtractionStrategy";

export class HybridExtractionStrategy implements IExtractionStrategy {
  private staticStrategy = new StaticExtractionStrategy();
  private dynamicStrategy = new DynamicExtractionStrategy();

  getName(): string {
    return "HybridExtractionStrategy";
  }

  canHandle(formData?: FormData | null): boolean {
    // Hybrid can always handle any context
    return true;
  }

  async extract(
    files: File[],
    ai: GoogleGenAI,
    model: string,
    formData?: FormData | null,
    onProgress?: (event: any) => void
  ): Promise<Record<string, string>> {
    console.log('[HybridExtractionStrategy] Using both static and dynamic extraction');

    const results: Record<string, string> = {};

    try {
      // Step 1: Try dynamic extraction first (if form data available)
      if (formData && formData.inputs.length > 0) {
        console.log('[HybridExtractionStrategy] Phase 1: Dynamic extraction');
        const dynamicResults = await this.dynamicStrategy.extract(
          files,
          ai,
          model,
          formData,
          onProgress
        );

        // Merge dynamic results
        Object.assign(results, dynamicResults);
        console.log(`[HybridExtractionStrategy] Dynamic extraction found ${Object.keys(dynamicResults).length} fields`);
      }

      // Step 2: Run static extraction to fill gaps
      console.log('[HybridExtractionStrategy] Phase 2: Static extraction for missing fields');
      const staticResults = await this.staticStrategy.extract(
        files,
        ai,
        model,
        null,
        onProgress
      );

      // Merge static results (don't overwrite existing values)
      for (const [key, value] of Object.entries(staticResults)) {
        if (!results[key] && value) {
          results[key] = value;
        }
      }

      console.log(`[HybridExtractionStrategy] Static extraction added ${Object.keys(staticResults).length} fields`);
      console.log(`[HybridExtractionStrategy] Total fields extracted: ${Object.keys(results).length}`);

    } catch (error) {
      console.error('[HybridExtractionStrategy] Error during hybrid extraction:', error);
      throw error;
    }

    return results;
  }
}
