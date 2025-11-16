/**
 * Strategy Pattern Implementation
 *
 * Defines a family of algorithms (extraction strategies), encapsulates each one,
 * and makes them interchangeable. Strategy lets the algorithm vary independently
 * from clients that use it.
 */

import type { GoogleGenAI } from "@google/genai";
import type { ExtractedData } from "../gemini";

/**
 * Strategy interface for data extraction
 */
export interface ExtractionStrategy {
  extract(file: File, ai: GoogleGenAI, model: string): Promise<Partial<ExtractedData>>;
  canHandle(file: File): boolean;
  getName(): string;
}

/**
 * Fast extraction strategy - Uses lightweight model for speed
 */
export class FastExtractionStrategy implements ExtractionStrategy {
  getName(): string {
    return "Fast Extraction";
  }

  canHandle(file: File): boolean {
    // Fast strategy for small files
    return file.size < 1024 * 1024; // < 1MB
  }

  async extract(file: File, ai: GoogleGenAI, model: string): Promise<Partial<ExtractedData>> {
    console.log(`[STRATEGY] Using ${this.getName()} for ${file.name}`);

    // Use simpler, faster prompt
    const prompt = "Extract key information: name, date of birth, ID numbers.";

    // Implementation would call Gemini API with fast model
    // For now, return placeholder
    return {};
  }
}

/**
 * Accurate extraction strategy - Uses advanced model for accuracy
 */
export class AccurateExtractionStrategy implements ExtractionStrategy {
  getName(): string {
    return "Accurate Extraction";
  }

  canHandle(file: File): boolean {
    // Accurate strategy for larger or complex files
    return file.size >= 1024 * 1024; // >= 1MB
  }

  async extract(file: File, ai: GoogleGenAI, model: string): Promise<Partial<ExtractedData>> {
    console.log(`[STRATEGY] Using ${this.getName()} for ${file.name}`);

    // Use detailed, comprehensive prompt
    const prompt = `
      Extract all available information in detail:
      - Personal information (name, DOB, gender)
      - Address information (permanent, current)
      - ID numbers (birth certificate, NID, passport, etc.)
      - Education information (board, roll, institution)
      - Parent information (names, relationships)
      Extract both English and Bengali text where available.
    `;

    // Implementation would call Gemini API with accurate model
    return {};
  }
}

/**
 * Balanced extraction strategy - Balance between speed and accuracy
 */
export class BalancedExtractionStrategy implements ExtractionStrategy {
  getName(): string {
    return "Balanced Extraction";
  }

  canHandle(file: File): boolean {
    // Works for all file sizes
    return true;
  }

  async extract(file: File, ai: GoogleGenAI, model: string): Promise<Partial<ExtractedData>> {
    console.log(`[STRATEGY] Using ${this.getName()} for ${file.name}`);

    // Use moderate prompt
    const prompt = "Extract important information: name, ID numbers, dates, addresses.";

    return {};
  }
}

/**
 * Context class that uses extraction strategies
 */
export class ExtractionContext {
  private strategy: ExtractionStrategy;

  constructor(strategy: ExtractionStrategy) {
    this.strategy = strategy;
  }

  /**
   * Set the strategy at runtime
   */
  setStrategy(strategy: ExtractionStrategy): void {
    console.log(`[CONTEXT] Switching strategy to: ${strategy.getName()}`);
    this.strategy = strategy;
  }

  /**
   * Execute extraction using current strategy
   */
  async execute(file: File, ai: GoogleGenAI, model: string): Promise<Partial<ExtractedData>> {
    if (!this.strategy.canHandle(file)) {
      console.warn(`[CONTEXT] Current strategy cannot handle file: ${file.name}`);
    }
    return await this.strategy.extract(file, ai, model);
  }

  /**
   * Get current strategy name
   */
  getStrategyName(): string {
    return this.strategy.getName();
  }
}

/**
 * Strategy selector - Automatically selects best strategy
 */
export class StrategySelector {
  private strategies: ExtractionStrategy[] = [];

  constructor() {
    this.strategies = [
      new FastExtractionStrategy(),
      new AccurateExtractionStrategy(),
      new BalancedExtractionStrategy(),
    ];
  }

  /**
   * Select best strategy for file
   */
  selectStrategy(file: File): ExtractionStrategy {
    // Try strategies in order of preference
    for (const strategy of this.strategies) {
      if (strategy.canHandle(file)) {
        console.log(`[SELECTOR] Selected ${strategy.getName()} for ${file.name}`);
        return strategy;
      }
    }

    // Default to balanced if no specific match
    console.log(`[SELECTOR] Using default balanced strategy for ${file.name}`);
    return new BalancedExtractionStrategy();
  }

  /**
   * Add custom strategy
   */
  addStrategy(strategy: ExtractionStrategy): void {
    this.strategies.push(strategy);
  }
}

/**
 * Validation strategy interface
 */
export interface ValidationStrategy {
  validate(data: any): { valid: boolean; errors: string[] };
  getName(): string;
}

/**
 * Strict validation strategy
 */
export class StrictValidationStrategy implements ValidationStrategy {
  getName(): string {
    return "Strict Validation";
  }

  validate(data: Partial<ExtractedData>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Require all critical fields
    if (!data.name_english && !data.name_bengali) {
      errors.push("Name is required");
    }
    if (!data.date_of_birth) {
      errors.push("Date of birth is required");
    }

    // Validate format
    if (data.date_of_birth && !/^\d{2}\/\d{2}\/\d{4}$/.test(data.date_of_birth)) {
      errors.push("Date of birth must be in DD/MM/YYYY format");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Lenient validation strategy
 */
export class LenientValidationStrategy implements ValidationStrategy {
  getName(): string {
    return "Lenient Validation";
  }

  validate(data: Partial<ExtractedData>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Only check if at least some data exists
    const nonEmptyFields = Object.values(data).filter(v => v && v !== "");

    if (nonEmptyFields.length === 0) {
      errors.push("No data extracted");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Retry strategy interface
 */
export interface RetryStrategy {
  shouldRetry(attempt: number, error: Error): boolean;
  getDelay(attempt: number): number;
  getName(): string;
}

/**
 * Exponential backoff retry strategy
 */
export class ExponentialBackoffStrategy implements RetryStrategy {
  private maxRetries: number;
  private baseDelay: number;

  constructor(maxRetries: number = 3, baseDelay: number = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  getName(): string {
    return "Exponential Backoff";
  }

  shouldRetry(attempt: number, error: Error): boolean {
    if (attempt >= this.maxRetries) {
      return false;
    }

    // Retry on network errors
    const retryableErrors = ["network", "timeout", "429", "503"];
    return retryableErrors.some(err =>
      error.message.toLowerCase().includes(err)
    );
  }

  getDelay(attempt: number): number {
    return this.baseDelay * Math.pow(2, attempt);
  }
}

/**
 * Fixed delay retry strategy
 */
export class FixedDelayStrategy implements RetryStrategy {
  private maxRetries: number;
  private delay: number;

  constructor(maxRetries: number = 3, delay: number = 2000) {
    this.maxRetries = maxRetries;
    this.delay = delay;
  }

  getName(): string {
    return "Fixed Delay";
  }

  shouldRetry(attempt: number, error: Error): boolean {
    return attempt < this.maxRetries;
  }

  getDelay(attempt: number): number {
    return this.delay;
  }
}
