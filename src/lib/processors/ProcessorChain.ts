import { GoogleGenAI } from "@google/genai";
import type { DocumentProcessor } from "./DocumentProcessor";
import type { ExtractedData } from "../gemini";
import { ProgressNotifier } from "../observers/ProcessingObserver";
import type { ProcessingObserver } from "../observers/ProcessingObserver";
import { ProcessorFactory, type ProcessorChainConfig } from "../factories/ProcessorFactory";

export interface ProcessingResult {
  data: ExtractedData;
  errors: string[];
  warnings: string[];
}

/**
 * ProcessorChain - Orchestrates document processing using Chain of Responsibility
 * Now uses Factory Pattern for creating processors
 */
export class ProcessorChain {
  private chain: DocumentProcessor;
  private notifier: ProgressNotifier;

  constructor(config?: ProcessorChainConfig) {
    // Use Factory Pattern to create the processor chain
    this.chain = ProcessorFactory.createChain(config);
    this.notifier = new ProgressNotifier();
  }

  /**
   * Create an optimized chain based on files to be processed
   */
  static createOptimizedForFiles(files: File[]): ProcessorChain {
    const instance = new ProcessorChain();
    instance.chain = ProcessorFactory.createChainForFiles(files);
    return instance;
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
    const allWarnings: string[] = [];

    // Process each file through the chain
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Set progress notifier for this file
      this.chain.setProgressNotifier(this.notifier, i + 1, files.length);

      const result = await this.chain.handle(file, accumulatedData, ai, model);
      accumulatedData = result.data;
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    // Log summary
    console.log(`Processing complete: ${files.length} files, ${allErrors.length} errors, ${allWarnings.length} warnings`);

    return {
      data: accumulatedData as ExtractedData,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}
