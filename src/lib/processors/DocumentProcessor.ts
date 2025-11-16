import { GoogleGenAI, createUserContent, createPartFromUri, Type } from "@google/genai";
import type { ExtractedData } from "../gemini";
import type { ProgressNotifier } from "../observers/ProcessingObserver";
import { ProcessorValidator, ErrorRecoveryStrategy } from "./ProcessorValidator";

export interface ProcessorResult {
  data: Partial<ExtractedData>;
  errors: string[];
  warnings: string[];
}

export interface ProcessorConfig {
  maxRetries?: number;
  retryDelay?: number;
  validateFiles?: boolean;
}

export abstract class DocumentProcessor {
  protected next: DocumentProcessor | null = null;
  protected notifier?: ProgressNotifier;
  protected currentIndex: number = 0;
  protected totalFiles: number = 0;
  protected config: ProcessorConfig = {
    maxRetries: 2,
    retryDelay: 1000,
    validateFiles: true,
  };

  setNext(processor: DocumentProcessor): DocumentProcessor {
    this.next = processor;
    return processor;
  }

  setProgressNotifier(notifier: ProgressNotifier, currentIndex: number, totalFiles: number): void {
    this.notifier = notifier;
    this.currentIndex = currentIndex;
    this.totalFiles = totalFiles;
  }

  setConfig(config: Partial<ProcessorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async handle(
    file: File,
    accumulatedData: Partial<ExtractedData>,
    ai: GoogleGenAI,
    model: string
  ): Promise<ProcessorResult> {
    let result: ProcessorResult = { data: accumulatedData, errors: [], warnings: [] };

    // Validate file before processing
    if (this.config.validateFiles) {
      const validation = ProcessorValidator.validateFile(file);

      if (!validation.isValid) {
        const validationError = `File validation failed: ${validation.errors.join(", ")}`;
        result.errors.push(validationError);

        if (this.notifier) {
          this.notifier.notifyError(file.name, validationError, this.currentIndex, this.totalFiles);
        }

        // Continue to next processor even if validation failed
        if (this.next) {
          if (this.notifier) {
            this.next.setProgressNotifier(this.notifier, this.currentIndex, this.totalFiles);
            this.next.setConfig(this.config);
          }
          const nextResult = await this.next.handle(file, result.data, ai, model);
          result.data = nextResult.data;
          result.errors = [...result.errors, ...nextResult.errors];
          result.warnings = [...result.warnings, ...nextResult.warnings];
        }

        return result;
      }

      // Add warnings if any
      result.warnings.push(...validation.warnings);
    }

    // Check if this processor should handle this file
    if (this.canProcess(file)) {
      try {
        // Process with retry logic
        const extractedData = await ErrorRecoveryStrategy.retry(
          async () => await this.process(file, ai, model),
          this.config.maxRetries,
          this.config.retryDelay
        );

        result.data = { ...result.data, ...extractedData };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const fullError = `Error processing ${file.name}: ${errorMessage}`;
        result.errors.push(fullError);

        // Notify error
        if (this.notifier) {
          this.notifier.notifyError(file.name, errorMessage, this.currentIndex, this.totalFiles);
        }

        // Log error for debugging
        console.error(`[${this.constructor.name}] ${fullError}`);
      }
    }

    // Pass to next processor in chain
    if (this.next) {
      if (this.notifier) {
        this.next.setProgressNotifier(this.notifier, this.currentIndex, this.totalFiles);
        this.next.setConfig(this.config);
      }
      const nextResult = await this.next.handle(file, result.data, ai, model);
      result.data = nextResult.data;
      result.errors = [...result.errors, ...nextResult.errors];
      result.warnings = [...result.warnings, ...nextResult.warnings];
    }

    return result;
  }

  protected abstract canProcess(file: File): boolean;
  protected abstract process(
    file: File,
    ai: GoogleGenAI,
    model: string
  ): Promise<Partial<ExtractedData>>;

  protected async uploadAndExtract(
    file: File,
    ai: GoogleGenAI,
    model: string,
    prompt: string,
    schema: any
  ): Promise<any> {
    // Notify uploading
    if (this.notifier) {
      this.notifier.notifyUploading(file.name, this.currentIndex, this.totalFiles);
    }

    // Upload file
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });

    const uploadedFile = await ai.files.upload({
      file: blob,
      config: { mimeType: file.type },
    });

    // Notify processing
    if (this.notifier) {
      this.notifier.notifyProcessing(file.name, this.currentIndex, this.totalFiles);
    }

    // Create content with file and prompt
    const parts = [createPartFromUri(uploadedFile.uri, uploadedFile.mimeType), prompt];

    // Call Gemini API
    const response = await ai.models.generateContent({
      model: model.toLowerCase().replace(/\s+/g, "-"),
      contents: createUserContent(parts),
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    // Notify completed
    if (this.notifier) {
      this.notifier.notifyCompleted(file.name, this.currentIndex, this.totalFiles);
    }

    return JSON.parse(response.text);
  }
}
