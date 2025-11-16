/**
 * MODEL - MVC Pattern Implementation
 *
 * Models represent the data and business logic of the application.
 * They are independent of the UI and contain the core application logic.
 */

import type { ExtractedData } from "../lib/gemini";
import type { FormData, SourceDocumentList } from "../lib/formExtraction";

/**
 * Document upload model
 */
export type DocumentType =
  | "birthCertificate"
  | "utilityBill"
  | "educationCertificate"
  | "nidCard"
  | "passport"
  | "other";

export interface DocumentUploadModel {
  type: DocumentType;
  file: File | null;
  required: boolean;
  label: string;
  description: string;
}

/**
 * Application state model
 */
export interface ApplicationStateModel {
  currentPage: PageType;
  extractedData: ExtractedData | null;
  detectedFormData: FormData | null;
  detectedSourceDocuments: SourceDocumentList | null;
  error: string | null;
}

export type PageType =
  | "home"
  | "upload"
  | "settings"
  | "loading"
  | "results"
  | "htmlsource"
  | "formdetection"
  | "debug";

/**
 * Settings model
 */
export interface SettingsModel {
  apiKey: string;
  selectedModel: string;
  theme?: "light" | "dark" | "system";
}

/**
 * Processing result model
 */
export interface ProcessingResultModel {
  data: ExtractedData;
  errors: string[];
  warnings: string[];
  processingTime: number;
  filesProcessed: number;
}

/**
 * Form field model
 */
export interface FormFieldModel {
  id: string;
  name: string;
  label: string;
  type: string;
  value: string;
  required: boolean;
}

/**
 * Model validator
 */
export class ModelValidator {
  /**
   * Validate document upload model
   */
  static validateDocument(doc: DocumentUploadModel): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!doc.type) {
      errors.push("Document type is required");
    }

    if (doc.required && !doc.file) {
      errors.push(`${doc.label} is required but no file provided`);
    }

    if (doc.file) {
      if (doc.file.size === 0) {
        errors.push(`${doc.label} file is empty`);
      }

      const maxSize = 20 * 1024 * 1024; // 20MB
      if (doc.file.size > maxSize) {
        errors.push(`${doc.label} file exceeds maximum size of 20MB`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate settings model
   */
  static validateSettings(settings: SettingsModel): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!settings.apiKey || settings.apiKey.trim() === "") {
      errors.push("API key is required");
    }

    if (settings.apiKey && settings.apiKey.length < 20) {
      errors.push("API key appears to be invalid (too short)");
    }

    if (!settings.selectedModel || settings.selectedModel.trim() === "") {
      errors.push("Model selection is required");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate extracted data model
   */
  static validateExtractedData(data: Partial<ExtractedData>): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if data has at least some fields
    const nonEmptyFields = Object.values(data).filter(
      v => v !== null && v !== undefined && v !== ""
    );

    if (nonEmptyFields.length === 0) {
      errors.push("No data was extracted");
    } else if (nonEmptyFields.length < 3) {
      warnings.push(`Only ${nonEmptyFields.length} fields extracted, expected more`);
    }

    // Validate specific important fields
    if (!data.name_english && !data.name_bengali) {
      warnings.push("No name was extracted");
    }

    if (!data.date_of_birth && !data.birth_day && !data.birth_month && !data.birth_year) {
      warnings.push("No date of birth information was extracted");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Model transformer - converts between different model formats
 */
export class ModelTransformer {
  /**
   * Transform extracted data to form-fillable format
   */
  static toFormValues(data: ExtractedData): Record<string, string> {
    const formValues: Record<string, string> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (value && value !== "") {
        formValues[key] = String(value);
      }
    });

    return formValues;
  }

  /**
   * Transform settings model to storage format
   */
  static settingsToStorage(settings: SettingsModel): Record<string, string> {
    return {
      gemini_api_key: settings.apiKey,
      gemini_model: settings.selectedModel,
      theme: settings.theme || "system",
    };
  }

  /**
   * Transform storage format to settings model
   */
  static storageToSettings(storage: Record<string, string | null>): SettingsModel {
    return {
      apiKey: storage.gemini_api_key || "",
      selectedModel: storage.gemini_model || "Gemini 2.5 Flash",
      theme: (storage.theme as "light" | "dark" | "system") || "system",
    };
  }
}
