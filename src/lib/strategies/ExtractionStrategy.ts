/**
 * Strategy Pattern Implementation
 *
 * Problem: Different forms require different extraction approaches
 * - Static forms: Predefined schema (backwards compatibility)
 * - Dynamic forms: AI-detected schema (flexible)
 * - Hybrid forms: Combination of both
 *
 * Solution: Strategy pattern allows switching extraction algorithms at runtime
 */

import type { GoogleGenAI } from "@google/genai";
import type { FormData } from "../formExtraction";

/**
 * Strategy Interface
 * Defines the contract for all extraction strategies
 */
export interface IExtractionStrategy {
  /**
   * Extract data from uploaded files
   * @param files - Files to process
   * @param ai - Google AI client
   * @param model - Model name to use
   * @param formData - Optional form schema for dynamic extraction
   * @param onProgress - Progress callback
   */
  extract(
    files: File[],
    ai: GoogleGenAI,
    model: string,
    formData?: FormData | null,
    onProgress?: (event: any) => void
  ): Promise<Record<string, string>>;

  /**
   * Get strategy name for logging/debugging
   */
  getName(): string;

  /**
   * Check if this strategy can handle the given context
   */
  canHandle(formData?: FormData | null): boolean;
}

/**
 * Context class that uses a strategy
 * This is the main interface that components interact with
 */
export class ExtractionContext {
  private strategy: IExtractionStrategy;

  constructor(strategy: IExtractionStrategy) {
    this.strategy = strategy;
  }

  /**
   * Switch strategy at runtime
   */
  setStrategy(strategy: IExtractionStrategy): void {
    console.log(`Switching extraction strategy to: ${strategy.getName()}`);
    this.strategy = strategy;
  }

  /**
   * Get current strategy
   */
  getStrategy(): IExtractionStrategy {
    return this.strategy;
  }

  /**
   * Execute extraction using current strategy
   */
  async executeExtraction(
    files: File[],
    ai: GoogleGenAI,
    model: string,
    formData?: FormData | null,
    onProgress?: (event: any) => void
  ): Promise<Record<string, string>> {
    console.log(`Using extraction strategy: ${this.strategy.getName()}`);
    return await this.strategy.extract(files, ai, model, formData, onProgress);
  }
}

/**
 * Auto-select appropriate strategy based on context
 */
export function selectStrategy(formData?: FormData | null, strategies: IExtractionStrategy[] = []): IExtractionStrategy {
  // Try to find a strategy that can handle this context
  for (const strategy of strategies) {
    if (strategy.canHandle(formData)) {
      console.log(`Auto-selected strategy: ${strategy.getName()}`);
      return strategy;
    }
  }

  // Fallback to dynamic strategy if available
  const dynamicStrategy = strategies.find(s => s.getName() === 'DynamicExtractionStrategy');
  if (dynamicStrategy) {
    return dynamicStrategy;
  }

  // Should never reach here if strategies are properly registered
  throw new Error('No suitable extraction strategy found');
}
