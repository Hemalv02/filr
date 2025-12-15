/**
 * Facade Pattern Implementation
 *
 * Problem: Document processing involves multiple complex subsystems:
 * - Storage (API key retrieval)
 * - Form detection (HTML parsing, AI analysis)
 * - Strategy selection (Static vs Dynamic vs Hybrid)
 * - Processor chain (Chain of Responsibility)
 * - Progress tracking (Observer pattern)
 * - Form filling (DOM manipulation)
 *
 * Solution: Facade pattern provides a simplified, unified interface
 * to hide the complexity of subsystem interactions
 */

import { GoogleGenAI } from "@google/genai";
import { getApiKey, getModel } from "../storage";
import {
  detectAndExtractForm,
  detectRequiredDocuments,
  type FormData,
  type SourceDocumentList,
} from "../formExtraction";
import {
  type IExtractionStrategy,
  ExtractionContext,
  selectStrategy,
  StaticExtractionStrategy,
  DynamicExtractionStrategy,
  HybridExtractionStrategy,
} from "../strategies";
import { ProcessorFactory } from "../factories/ProcessorFactory";
import { executeAutoFill } from "../formFiller";

/**
 * Configuration options for document processing
 */
export interface ProcessingConfig {
  useHybridExtraction?: boolean;
  autoDetectForm?: boolean;
  autoFillForm?: boolean;
  onProgress?: (event: any) => void;
}

/**
 * Complete processing result
 */
export interface ProcessingResult {
  success: boolean;
  extractedData: Record<string, string>;
  formData?: FormData;
  sourceDocuments?: SourceDocumentList;
  autoFillResult?: {
    filled: number;
    failed: number;
    details: string[];
  };
  errors: string[];
}

/**
 * Facade for entire document processing workflow
 *
 * This class hides the complexity of:
 * - Storage operations
 * - Form detection
 * - Strategy selection
 * - Data extraction
 * - Form auto-filling
 */
export class DocumentProcessingFacade {
  private static instance: DocumentProcessingFacade;
  private ai: GoogleGenAI | null = null;
  private model: string = 'Gemini 2.0 Flash';

  private constructor() {}

  /**
   * Singleton instance
   */
  public static getInstance(): DocumentProcessingFacade {
    if (!DocumentProcessingFacade.instance) {
      DocumentProcessingFacade.instance = new DocumentProcessingFacade();
    }
    return DocumentProcessingFacade.instance;
  }

  /**
   * Initialize the facade with API credentials
   * Must be called before processing
   */
  public async initialize(): Promise<void> {
    console.log('[DocumentProcessingFacade] Initializing...');

    // Subsystem 1: Storage
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured. Please set up your Gemini API key in settings.');
    }

    const model = await getModel();
    this.model = model || 'Gemini 2.0 Flash';

    // Initialize AI client
    this.ai = new GoogleGenAI({ apiKey });

    console.log('[DocumentProcessingFacade] Initialized with model:', this.model);
  }

  /**
   * Detect form on current page
   * Subsystems: Form detection, AI analysis
   */
  public async detectForm(): Promise<{
    formData: FormData;
    sourceDocuments: SourceDocumentList;
  }> {
    console.log('[DocumentProcessingFacade] Detecting form...');

    if (!this.ai) {
      await this.initialize();
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('API key not found');
    }

    // Subsystem 2: Form Detection
    const formData = await detectAndExtractForm(apiKey);

    if (!formData || formData.inputs.length === 0) {
      throw new Error('No valid form detected on the current page');
    }

    // Subsystem 3: Document Detection
    const sourceDocuments = await detectRequiredDocuments(formData, apiKey);

    console.log('[DocumentProcessingFacade] Form detected:', {
      formName: formData.form_name,
      fieldCount: formData.inputs.length,
      documentCount: sourceDocuments.source_documents.length,
    });

    return { formData, sourceDocuments };
  }

  /**
   * Process documents with automatic strategy selection
   * Subsystems: Strategy pattern, Processor chain, Progress tracking
   */
  public async processDocuments(
    files: File[],
    formData?: FormData,
    config: ProcessingConfig = {}
  ): Promise<ProcessingResult> {
    console.log('[DocumentProcessingFacade] Processing documents...');

    if (!this.ai) {
      await this.initialize();
    }

    const errors: string[] = [];
    let extractedData: Record<string, string> = {};

    try {
      // Subsystem 4: Strategy Selection
      const availableStrategies: IExtractionStrategy[] = [
        new StaticExtractionStrategy(),
        new DynamicExtractionStrategy(),
        new HybridExtractionStrategy(),
      ];

      let strategy: IExtractionStrategy;
      if (config.useHybridExtraction) {
        strategy = new HybridExtractionStrategy();
        console.log('[DocumentProcessingFacade] Using hybrid extraction strategy');
      } else {
        strategy = selectStrategy(formData, availableStrategies);
      }

      // Subsystem 5: Extraction Context (Strategy Pattern)
      const context = new ExtractionContext(strategy);

      // Execute extraction
      extractedData = await context.executeExtraction(
        files,
        this.ai!,
        this.model,
        formData,
        config.onProgress
      );

      console.log('[DocumentProcessingFacade] Extraction complete:', {
        fieldsExtracted: Object.keys(extractedData).length,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      console.error('[DocumentProcessingFacade] Processing error:', error);
    }

    return {
      success: errors.length === 0,
      extractedData,
      formData,
      errors,
    };
  }

  /**
   * Auto-fill form with extracted data
   * Subsystem: Form filler (DOM manipulation)
   */
  public async autoFillForm(
    formData: FormData,
    extractedData: Record<string, string>
  ): Promise<{ filled: number; failed: number; details: string[] }> {
    console.log('[DocumentProcessingFacade] Auto-filling form...');

    // Subsystem 6: Form Filler
    const result = await executeAutoFill(formData, extractedData);

    console.log('[DocumentProcessingFacade] Auto-fill complete:', {
      filled: result.filled,
      failed: result.failed,
    });

    return result;
  }

  /**
   * Complete workflow: Detect → Process → Fill
   * This is the main facade method that orchestrates everything
   */
  public async processAndFillForm(
    files: File[],
    config: ProcessingConfig = {}
  ): Promise<ProcessingResult> {
    console.log('[DocumentProcessingFacade] Starting complete workflow...');

    const result: ProcessingResult = {
      success: false,
      extractedData: {},
      errors: [],
    };

    try {
      // Step 1: Initialize
      await this.initialize();

      // Step 2: Detect form (if configured)
      let formData: FormData | undefined;
      let sourceDocuments: SourceDocumentList | undefined;

      if (config.autoDetectForm !== false) {
        try {
          const detection = await this.detectForm();
          formData = detection.formData;
          sourceDocuments = detection.sourceDocuments;
          result.formData = formData;
          result.sourceDocuments = sourceDocuments;
        } catch (error) {
          console.warn('[DocumentProcessingFacade] Form detection failed, continuing with static extraction');
        }
      }

      // Step 3: Process documents
      const processingResult = await this.processDocuments(files, formData, config);
      result.extractedData = processingResult.extractedData;
      result.errors.push(...processingResult.errors);

      // Step 4: Auto-fill form (if configured and form detected)
      if (config.autoFillForm && formData) {
        try {
          const autoFillResult = await this.autoFillForm(formData, result.extractedData);
          result.autoFillResult = autoFillResult;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Auto-fill failed';
          result.errors.push(errorMessage);
        }
      }

      result.success = result.errors.length === 0;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      result.errors.push(errorMessage);
      console.error('[DocumentProcessingFacade] Workflow error:', error);
    }

    console.log('[DocumentProcessingFacade] Workflow complete:', {
      success: result.success,
      fieldsExtracted: Object.keys(result.extractedData).length,
      errorCount: result.errors.length,
    });

    return result;
  }

  /**
   * Get processing statistics for debugging
   */
  public getStats(): {
    model: string;
    isInitialized: boolean;
    processorCount: number;
  } {
    const factory = ProcessorFactory.getInstance();
    return {
      model: this.model,
      isInitialized: this.ai !== null,
      processorCount: factory.getAllProcessorTypes().length,
    };
  }
}

/**
 * Convenience function to get facade instance
 */
export function getDocumentProcessingFacade(): DocumentProcessingFacade {
  return DocumentProcessingFacade.getInstance();
}
