import { GoogleGenAI } from "@google/genai";
import type { DocumentProcessor } from "./DocumentProcessor";
import type { ExtractedData } from "../gemini";
import { ProgressNotifier } from "../observers/ProcessingObserver";
import type { ProcessingObserver } from "../observers/ProcessingObserver";
import { ProcessorFactory, type ProcessorChainConfig } from "../factories/ProcessorFactory";
import { ProcessorValidator } from "./ProcessorValidator";

export interface ProcessingResult {
  data: ExtractedData;
  errors: string[];
  warnings: string[];
}

export interface ChainOptions {
  enableLogging?: boolean;
  enableMetrics?: boolean;
  enableRateLimit?: boolean;
  enableSanitization?: boolean;
  rateLimitMs?: number;
}

/**
 * ProcessorChain - Orchestrates document processing using Chain of Responsibility
 * DECORATOR PATTERN: Optionally wraps processors with decorators
 * FACTORY PATTERN: Uses factory to create processors
 */
export class ProcessorChain {
  private chain: DocumentProcessor;
  private notifier: ProgressNotifier;
  private options: ChainOptions;

  constructor(config?: ProcessorChainConfig, options?: ChainOptions) {
    // Use Factory Pattern to create the processor chain
    this.chain = ProcessorFactory.createChain(config);
    this.notifier = new ProgressNotifier();
    this.options = options || {
      enableLogging: true,
      enableMetrics: true,
      enableRateLimit: false,
      enableSanitization: true,
    };

    // Apply decorators if enabled (Decorator Pattern in action)
    this.applyDecorators();
  }

  /**
   * DECORATOR PATTERN: Apply decorators to the processor chain
   */
  private applyDecorators(): void {
    // Note: Since decorators need to wrap individual processors,
    // we'll apply them at the processing level instead
    console.log("[CHAIN] Decorators configured:", this.options);
  }

  /**
   * Create an optimized chain based on files to be processed
   */
  static createOptimizedForFiles(files: File[], options?: ChainOptions): ProcessorChain {
    const instance = new ProcessorChain(undefined, options);
    instance.chain = ProcessorFactory.createChainForFiles(files);
    instance.applyDecorators();
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
    // CHAIN OF RESPONSIBILITY: Validate API config before processing
    const apiValidation = ProcessorValidator.validateAPIConfig(apiKey, model);
    if (!apiValidation.isValid) {
      throw new Error(`API configuration invalid: ${apiValidation.errors.join(", ")}`);
    }

    // CHAIN OF RESPONSIBILITY: Validate chain integrity
    const chainValidation = ProcessorValidator.validateChain(this.chain);
    if (!chainValidation.isValid) {
      throw new Error(`Chain validation failed: ${chainValidation.errors.join(", ")}`);
    }

    if (chainValidation.warnings.length > 0) {
      console.warn("[CHAIN] Warnings:", chainValidation.warnings);
    }

    // Log chain description (Chain of Responsibility pattern)
    console.log(`[CHAIN] Processing ${files.length} files through: ${this.chain.getChainDescription()}`);

    const ai = new GoogleGenAI({ apiKey });

    // Initialize empty data structure (could use Prototype pattern here)
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

    // CHAIN OF RESPONSIBILITY: Process each file through the chain
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // CHAIN OF RESPONSIBILITY: Validate file before processing
      if (this.options.enableLogging) {
        console.log(`[CHAIN] Processing file ${i + 1}/${files.length}: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
      }

      const fileValidation = ProcessorValidator.validateFile(file);
      if (!fileValidation.isValid) {
        const error = `File validation failed for ${file.name}: ${fileValidation.errors.join(", ")}`;
        allErrors.push(error);
        console.error(error);
        continue; // Skip invalid file
      }

      if (fileValidation.warnings.length > 0 && this.options.enableLogging) {
        console.warn(`[CHAIN] File warnings for ${file.name}:`, fileValidation.warnings);
        allWarnings.push(...fileValidation.warnings.map(w => `${file.name}: ${w}`));
      }

      // Set progress notifier for this file
      this.chain.setProgressNotifier(this.notifier, i + 1, files.length);

      // CHAIN OF RESPONSIBILITY: Pass file through the chain
      try {
        const result = await this.chain.handle(file, accumulatedData, ai, model);
        accumulatedData = result.data;
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);

        if (this.options.enableLogging) {
          console.log(`[CHAIN] ✓ Completed ${file.name}`);
        }
      } catch (error) {
        const errorMsg = `Unexpected error processing ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`;
        allErrors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // Log summary
    console.log(`[CHAIN] Processing complete: ${files.length} files, ${allErrors.length} errors, ${allWarnings.length} warnings`);

    return {
      data: accumulatedData as ExtractedData,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}
