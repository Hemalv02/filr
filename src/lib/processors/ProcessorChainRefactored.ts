/**
 * Refactored ProcessorChain using Factory Pattern
 *
 * Before: Manually instantiated and chained processors
 * After: Uses ProcessorFactory for creation and configuration
 *
 * Benefits:
 * - Reduced coupling between ProcessorChain and concrete processors
 * - Easier to add/remove processors
 * - Centralized processor configuration
 * - Better testability (can inject mock factory)
 */

import { GoogleGenAI } from "@google/genai";
import type { DocumentProcessor } from "./DocumentProcessor";
import type { ExtractedData } from "../gemini";
import { ProgressNotifier } from "../observers/ProcessingObserver";
import type { ProcessingObserver } from "../observers/ProcessingObserver";
import { ProcessorFactory } from "../factories/ProcessorFactory";

export interface ProcessingResult {
  data: ExtractedData;
  errors: string[];
}

export class ProcessorChainRefactored {
  private chain: DocumentProcessor;
  private notifier: ProgressNotifier;
  private factory: ProcessorFactory;

  constructor(factory?: ProcessorFactory) {
    // Use dependency injection for factory (better for testing)
    this.factory = factory || ProcessorFactory.getInstance();

    console.log('[ProcessorChain] Initializing with Factory pattern');

    // Use factory to build the chain
    this.chain = this.factory.createProcessorChain();
    this.notifier = new ProgressNotifier();

    console.log('[ProcessorChain] Chain built successfully with processors:',
      this.factory.getAllProcessorMetadata().map(p => p.name).join(' → ')
    );
  }

  subscribe(observer: ProcessingObserver): void {
    this.notifier.subscribe(observer);
  }

  async processDocuments(
    files: File[],
    apiKey: string,
    model: string
  ): Promise<ProcessingResult> {
    const ai = new GoogleGenAI({ apiKey });

    // Initialize empty data structure
    let accumulatedData: Partial<ExtractedData> = {
      name_english: "",
      name_bengali: "",
      father_name_english: "",
      father_name_bengali: "",
      mother_name_english: "",
      mother_name_bengali: "",
      date_of_birth: "",
      birth_day: "",
      birth_month: "",
      birth_year: "",
      place_of_birth: "",
      birth_registration_number: "",
      sex: "",
      permanent_address: "",
      current_address: "",
      utility_account_number: "",
      education_board: "",
      ssc_roll_number: "",
      ssc_registration_number: "",
      ssc_passing_year: "",
      institution_name: "",
      parent_nid_number: "",
      parent_name: "",
      relation: "",
      passport_number: "",
      tin_number: "",
      driving_license_number: "",
    };

    const allErrors: string[] = [];

    console.log(`[ProcessorChain] Processing ${files.length} files`);

    // Process each file through the chain
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[ProcessorChain] Processing file ${i + 1}/${files.length}: ${file.name}`);

      // Set progress notifier for this file
      this.chain.setProgressNotifier(this.notifier, i + 1, files.length);

      const result = await this.chain.handle(file, accumulatedData, ai, model);
      accumulatedData = result.data;
      allErrors.push(...result.errors);
    }

    console.log(`[ProcessorChain] Processing complete. Extracted ${Object.keys(accumulatedData).filter(k => accumulatedData[k as keyof ExtractedData]).length} fields`);

    return {
      data: accumulatedData as ExtractedData,
      errors: allErrors,
    };
  }

  /**
   * Get processor metadata for debugging/logging
   */
  public getProcessorInfo(): { name: string; description: string }[] {
    return this.factory.getAllProcessorMetadata().map(p => ({
      name: p.name,
      description: p.description,
    }));
  }
}
