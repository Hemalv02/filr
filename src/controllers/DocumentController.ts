/**
 * CONTROLLER - MVC Pattern Implementation
 *
 * Controllers handle user input, update models, and coordinate between
 * models and views. They contain the application's business logic.
 */

/**
 * MVC PATTERN - Controllers
 * Controllers handle business logic and coordinate between models and views
 */

import type { ExtractedData } from "../lib/gemini";
import type { FormData, SourceDocumentList } from "../lib/formExtraction";
import { ProcessorChain, type ChainOptions } from "../lib/processors/ProcessorChain";
import { detectAndExtractForm } from "../lib/formExtraction";
import { processDynamicDocuments } from "../lib/dynamicExtraction";
import { executeAutoFill } from "../lib/formFiller";
import type {
  DocumentUploadModel,
  ApplicationStateModel,
  SettingsModel,
  ProcessingResultModel,
  PageType,
} from "../models/DocumentModel";
import { ModelValidator, ModelTransformer } from "../models/DocumentModel";

// SINGLETON PATTERN: Import singletons
import { APIClientSingleton, SettingsSingleton } from "../lib/singleton/APIClientSingleton";

// FACTORY PATTERN: Import factory
import { ProcessorFactory } from "../lib/factories/ProcessorFactory";

/**
 * MVC CONTROLLER: Document processing controller
 */
export class DocumentController {
  /**
   * Process uploaded documents
   * USES: Singleton, Factory, Chain of Responsibility, Decorator patterns
   */
  static async processDocuments(
    documents: DocumentUploadModel[],
    apiKey: string,
    model: string,
    onProgress?: (event: any) => void,
    options?: ChainOptions
  ): Promise<ProcessingResultModel> {
    const startTime = performance.now();

    // MVC MODEL: Validate documents using model validator
    const validation = this.validateDocuments(documents);
    if (!validation.valid) {
      throw new Error(`Document validation failed: ${validation.errors.join(", ")}`);
    }

    // Filter documents that have files
    const filesToProcess = documents
      .filter(doc => doc.file !== null)
      .map(doc => doc.file!);

    if (filesToProcess.length === 0) {
      throw new Error("No files to process");
    }

    // SINGLETON PATTERN: Initialize API client if needed
    const apiClient = APIClientSingleton.getInstance();
    apiClient.initializeClient(apiKey);

    // FACTORY PATTERN + CHAIN OF RESPONSIBILITY: Create optimized processor chain
    const chainOptions: ChainOptions = options || {
      enableLogging: true,
      enableMetrics: true,
      enableSanitization: true,
    };

    const chain = ProcessorChain.createOptimizedForFiles(filesToProcess, chainOptions);

    // OBSERVER PATTERN: Subscribe to progress updates
    if (onProgress) {
      chain.subscribe({
        onProgress: onProgress,
      });
    }

    // CHAIN OF RESPONSIBILITY: Process documents through the chain
    const result = await chain.processDocuments(filesToProcess, apiKey, model);

    const endTime = performance.now();

    // MVC MODEL: Return processing result model
    return {
      data: result.data,
      errors: result.errors,
      warnings: result.warnings,
      processingTime: endTime - startTime,
      filesProcessed: filesToProcess.length,
    };
  }

  /**
   * Validate documents before processing
   */
  static validateDocuments(documents: DocumentUploadModel[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const allErrors: string[] = [];
    const warnings: string[] = [];

    documents.forEach(doc => {
      const validation = ModelValidator.validateDocument(doc);
      if (!validation.valid) {
        allErrors.push(...validation.errors);
      }
    });

    const filesCount = documents.filter(d => d.file !== null).length;
    if (filesCount === 0) {
      warnings.push("No files selected for processing");
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings,
    };
  }
}

/**
 * Form detection controller
 */
export class FormController {
  /**
   * Detect form on current page
   */
  static async detectForm(
    apiKey: string,
    model: string
  ): Promise<{ formData: FormData; sourceDocuments: SourceDocumentList } | null> {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error("No active tab found");
      }

      // Get HTML source
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.documentElement.outerHTML,
      });

      if (!results || !results[0]) {
        throw new Error("Failed to get page source");
      }

      // Extract form data (detectAndExtractForm gets HTML source internally)
      const formData = await detectAndExtractForm(apiKey);

      if (!formData || !formData.inputs || formData.inputs.length === 0) {
        return null;
      }

      // detectAndExtractForm returns FormData directly, not wrapped
      // Source documents are extracted separately via detectSourceDocuments if needed
      return {
        formData: formData,
        sourceDocuments: {
          form_type_english: "",
          form_type_bangla: "",
          source_documents: [],
          additional_notes: "",
        },
      };
    } catch (error) {
      console.error("Form detection error:", error);
      throw error;
    }
  }

  /**
   * Auto-fill detected form with extracted data
   */
  static async autoFillForm(
    formData: FormData,
    extractedData: ExtractedData
  ): Promise<{ filled: number; failed: number; details: string[] }> {
    try {
      const result = await executeAutoFill(formData, extractedData);
      return result;
    } catch (error) {
      console.error("Auto-fill error:", error);
      throw error;
    }
  }

  /**
   * Extract dynamic data based on form fields
   */
  static async extractDynamicData(
    formData: FormData,
    files: File[],
    apiKey: string,
    model: string,
    accessibilityTree?: string,
    additionalContext?: string
  ): Promise<any> {
    try {
      const result = await processDynamicDocuments(files, formData, apiKey, model, accessibilityTree, additionalContext);
      return result;
    } catch (error) {
      console.error("Dynamic extraction error:", error);
      throw error;
    }
  }
}

/**
 * MVC CONTROLLER: Settings controller
 */
export class SettingsController {
  /**
   * Load settings from storage
   * USES: Singleton pattern for settings management
   */
  static loadSettings(): SettingsModel {
    // SINGLETON PATTERN: Use SettingsSingleton
    const settingsSingleton = SettingsSingleton.getInstance();

    const storage = {
      gemini_api_key: settingsSingleton.get("gemini_api_key"),
      gemini_model: settingsSingleton.get("gemini_model"),
      theme: settingsSingleton.get("theme"),
    };

    // MVC MODEL: Transform storage format to model
    return ModelTransformer.storageToSettings(storage);
  }

  /**
   * Save settings to storage
   * USES: Singleton pattern + Model validation
   */
  static saveSettings(settings: SettingsModel): void {
    // MVC MODEL: Validate settings using model validator
    const validation = ModelValidator.validateSettings(settings);
    if (!validation.valid) {
      throw new Error(`Invalid settings: ${validation.errors.join(", ")}`);
    }

    // MVC MODEL: Transform model to storage format
    const storage = ModelTransformer.settingsToStorage(settings);

    // SINGLETON PATTERN: Save using SettingsSingleton
    const settingsSingleton = SettingsSingleton.getInstance();
    settingsSingleton.set("gemini_api_key", storage.gemini_api_key);
    settingsSingleton.set("gemini_model", storage.gemini_model);
    settingsSingleton.set("theme", storage.theme);

    console.log("[MVC CONTROLLER] Settings saved successfully");
  }

  /**
   * Validate API key
   */
  static validateApiKey(apiKey: string): { valid: boolean; error?: string } {
    if (!apiKey || apiKey.trim() === "") {
      return { valid: false, error: "API key cannot be empty" };
    }

    if (apiKey.length < 20) {
      return { valid: false, error: "API key appears to be invalid" };
    }

    return { valid: true };
  }

  /**
   * Get available models
   */
  static getAvailableModels(): string[] {
    return [
      "Gemini 2.5 Flash",
      "Gemini 2.5 Flash-Lite",
      "Gemini 2.5 Pro",
      "Gemini 2.0 Flash",
      "Gemini 1.5 Pro",
      "Gemini 1.5 Flash",
    ];
  }
}

/**
 * Navigation controller
 */
export class NavigationController {
  /**
   * Check if navigation to page is allowed
   */
  static canNavigateTo(
    from: PageType,
    to: PageType,
    state: ApplicationStateModel
  ): { allowed: boolean; reason?: string } {
    // Settings can always be accessed
    if (to === "settings") {
      return { allowed: true };
    }

    // Home can always be accessed
    if (to === "home") {
      return { allowed: true };
    }

    // Form detection requires API key
    if (to === "formdetection") {
      const apiKey = localStorage.getItem("gemini_api_key");
      if (!apiKey) {
        return {
          allowed: false,
          reason: "API key not configured. Please go to settings first.",
        };
      }
      return { allowed: true };
    }

    // Upload requires form detection data
    if (to === "upload") {
      if (!state.detectedFormData) {
        return {
          allowed: false,
          reason: "No form detected. Please run form detection first.",
        };
      }
      return { allowed: true };
    }

    // Results requires extracted data
    if (to === "results") {
      if (!state.extractedData) {
        return {
          allowed: false,
          reason: "No extracted data available.",
        };
      }
      return { allowed: true };
    }

    // Debug and HTML source are always allowed
    if (to === "debug" || to === "htmlsource") {
      return { allowed: true };
    }

    // Loading is only accessible from upload
    if (to === "loading") {
      if (from !== "upload") {
        return {
          allowed: false,
          reason: "Loading state can only be entered from upload.",
        };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }
}
