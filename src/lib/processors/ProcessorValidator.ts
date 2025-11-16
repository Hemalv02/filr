/**
 * Validator for Chain of Responsibility Pattern
 *
 * Adds validation, error recovery, and request validation
 * to make the chain more robust and fault-tolerant.
 */

import type { DocumentProcessor } from "./DocumentProcessor";
import type { ExtractedData } from "../gemini";

/**
 * Validation result for processor chain
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Request validation for file processing
 */
export interface ProcessingRequest {
  file: File;
  accumulatedData: Partial<ExtractedData>;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Processor Chain Validator
 */
export class ProcessorValidator {
  /**
   * Validate a file before processing
   */
  static validateFile(file: File): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if file exists
    if (!file) {
      errors.push("File is null or undefined");
      return { isValid: false, errors, warnings };
    }

    // Check file size (max 20MB)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (20MB)`);
    }

    // Check file size (min 1KB)
    const MIN_FILE_SIZE = 1024; // 1KB
    if (file.size < MIN_FILE_SIZE) {
      warnings.push(`File size (${file.size} bytes) is very small, may not contain valid data`);
    }

    // Check file type
    const validMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!validMimeTypes.includes(file.type)) {
      warnings.push(`File type "${file.type}" may not be supported. Supported types: ${validMimeTypes.join(", ")}`);
    }

    // Check file name
    if (!file.name || file.name.trim() === "") {
      errors.push("File name is empty");
    }

    // Check for suspicious file extensions
    const suspiciousExtensions = [".exe", ".bat", ".sh", ".js", ".msi"];
    const hasExtension = suspiciousExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );
    if (hasExtension) {
      errors.push("File has suspicious extension and cannot be processed");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate processor chain integrity
   */
  static validateChain(chain: DocumentProcessor): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!chain) {
      errors.push("Processor chain is null or undefined");
      return { isValid: false, errors, warnings };
    }

    // Count processors in chain
    let count = 0;
    let current: DocumentProcessor | null = chain;
    const visited = new Set<DocumentProcessor>();

    while (current !== null) {
      // Check for circular references
      if (visited.has(current)) {
        errors.push("Circular reference detected in processor chain");
        break;
      }

      visited.add(current);
      count++;

      // Get next processor (using type assertion since 'next' is protected)
      current = (current as any).next || null;

      // Prevent infinite loop
      if (count > 100) {
        errors.push("Chain length exceeds maximum (100 processors)");
        break;
      }
    }

    if (count === 0) {
      errors.push("Processor chain is empty");
    } else if (count === 1) {
      warnings.push("Chain contains only one processor");
    }

    console.log(`Validated chain with ${count} processors`);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate API configuration
   */
  static validateAPIConfig(apiKey: string, model: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check API key
    if (!apiKey || apiKey.trim() === "") {
      errors.push("API key is empty");
    }

    if (apiKey && apiKey.length < 20) {
      warnings.push("API key appears to be too short");
    }

    // Check model name
    if (!model || model.trim() === "") {
      errors.push("Model name is empty");
    }

    const validModelPrefixes = ["gemini-2.5", "gemini-2.0", "gemini-1.5"];
    const hasValidPrefix = validModelPrefixes.some(prefix =>
      model.toLowerCase().includes(prefix)
    );

    if (!hasValidPrefix) {
      warnings.push(`Model "${model}" may not be a valid Gemini model`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate processing request
   */
  static validateRequest(request: ProcessingRequest): ValidationResult {
    const fileValidation = this.validateFile(request.file);

    const errors: string[] = [...fileValidation.errors];
    const warnings: string[] = [...fileValidation.warnings];

    // Check retry count
    const maxRetries = request.maxRetries ?? 3;
    const retryCount = request.retryCount ?? 0;

    if (retryCount > maxRetries) {
      errors.push(`Retry count (${retryCount}) exceeds maximum retries (${maxRetries})`);
    }

    if (retryCount > 0) {
      warnings.push(`Processing attempt ${retryCount + 1} of ${maxRetries + 1}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Error Recovery Strategy
 */
export class ErrorRecoveryStrategy {
  /**
   * Determine if error is recoverable
   */
  static isRecoverable(error: Error): boolean {
    const recoverableErrors = [
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "429", // Too many requests
      "503", // Service unavailable
      "network",
      "timeout",
    ];

    const errorMessage = error.message.toLowerCase();
    return recoverableErrors.some(err => errorMessage.includes(err.toLowerCase()));
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  static calculateRetryDelay(retryCount: number, baseDelay: number = 1000): number {
    // Exponential backoff: baseDelay * 2^retryCount
    const delay = baseDelay * Math.pow(2, retryCount);
    // Add jitter (random ±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.min(delay + jitter, 30000); // Max 30 seconds
  }

  /**
   * Sleep for specified duration
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if error is recoverable
        if (!this.isRecoverable(lastError)) {
          console.error("Non-recoverable error:", lastError.message);
          throw lastError;
        }

        // Don't retry on last attempt
        if (i === maxRetries) {
          break;
        }

        const delay = this.calculateRetryDelay(i, baseDelay);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms due to: ${lastError.message}`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error("Operation failed after retries");
  }
}
