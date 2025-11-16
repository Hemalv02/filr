/**
 * CONTROLLER - MVC Pattern Implementation
 *
 * Controllers handle user input, update models, and coordinate between
 * models and views. They contain the application's business logic.
 */

import type { ExtractedData } from "../lib/gemini";
import type { FormData, SourceDocumentList } from "../lib/formExtraction";
import { ProcessorChain } from "../lib/processors/ProcessorChain";
import { extractFormData } from "../lib/formExtraction";
import { extractDynamicData } from "../lib/dynamicExtraction";
import { executeAutoFill } from "../lib/formFiller";
import type {
  DocumentUploadModel,
  ApplicationStateModel,
  SettingsModel,
  ProcessingResultModel,
  PageType,
} from "../models/DocumentModel";
import { ModelValidator, ModelTransformer } from "../models/DocumentModel";

/**
 * Document processing controller
 */
export class DocumentController {
  /**
   * Process uploaded documents
   */
  static async processDocuments(
    documents: DocumentUploadModel[],
    apiKey: string,
    model: string,
    onProgress?: (event: any) => void
  ): Promise<ProcessingResultModel> {
    const startTime = performance.now();

    // Filter documents that have files
    const filesToProcess = documents
      .filter(doc => doc.file !== null)
      .map(doc => doc.file!);

    if (filesToProcess.length === 0) {
      throw new Error("No files to process");
    }

    // Create optimized processor chain
    const chain = ProcessorChain.createOptimizedForFiles(filesToProcess);

    // Subscribe to progress updates
    if (onProgress) {
      chain.subscribe({
        onProgress: onProgress,
      });
    }

    // Process documents
    const result = await chain.processDocuments(filesToProcess, apiKey, model);

    const endTime = performance.now();

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

      const htmlSource = results[0].result as string;

      // Extract form data
      const formData = await extractFormData(htmlSource, apiKey, model);

      if (!formData || !formData.inputs || formData.inputs.length === 0) {
        return null;
      }

      return {
        formData: formData.form_data,
        sourceDocuments: formData.source_documents,
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
    model: string
  ): Promise<any> {
    try {
      // Build field list from form data
      const fields = formData.inputs.map(input => ({
        id: input.input_field_id,
        name: input.input_field_name,
        label: input.label,
      }));

      const result = await extractDynamicData(files, fields, apiKey, model);
      return result;
    } catch (error) {
      console.error("Dynamic extraction error:", error);
      throw error;
    }
  }
}

/**
 * Settings controller
 */
export class SettingsController {
  /**
   * Load settings from storage
   */
  static loadSettings(): SettingsModel {
    const storage = {
      gemini_api_key: localStorage.getItem("gemini_api_key"),
      gemini_model: localStorage.getItem("gemini_model"),
      theme: localStorage.getItem("theme"),
    };

    return ModelTransformer.storageToSettings(storage);
  }

  /**
   * Save settings to storage
   */
  static saveSettings(settings: SettingsModel): void {
    // Validate settings
    const validation = ModelValidator.validateSettings(settings);
    if (!validation.valid) {
      throw new Error(`Invalid settings: ${validation.errors.join(", ")}`);
    }

    // Transform and save
    const storage = ModelTransformer.settingsToStorage(settings);

    localStorage.setItem("gemini_api_key", storage.gemini_api_key);
    localStorage.setItem("gemini_model", storage.gemini_model);
    localStorage.setItem("theme", storage.theme);

    console.log("Settings saved successfully");
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
