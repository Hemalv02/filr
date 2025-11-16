/**
 * Decorator Pattern for Document Processors
 *
 * Decorates document processors with additional functionality
 * like logging, metrics, and performance monitoring.
 */

import type { DocumentProcessor, ProcessorResult } from "../processors/DocumentProcessor";
import type { ExtractedData } from "../gemini";
import type { GoogleGenAI } from "@google/genai";

/**
 * Abstract decorator for DocumentProcessor
 */
export abstract class ProcessorDecorator {
  protected processor: DocumentProcessor;

  constructor(processor: DocumentProcessor) {
    this.processor = processor;
  }

  // Delegate to wrapped processor
  setNext(processor: DocumentProcessor): DocumentProcessor {
    return this.processor.setNext(processor);
  }

  async handle(
    file: File,
    accumulatedData: Partial<ExtractedData>,
    ai: GoogleGenAI,
    model: string
  ): Promise<ProcessorResult> {
    return await this.processor.handle(file, accumulatedData, ai, model);
  }
}

/**
 * Logging decorator for processors
 */
export class LoggingProcessorDecorator extends ProcessorDecorator {
  async handle(
    file: File,
    accumulatedData: Partial<ExtractedData>,
    ai: GoogleGenAI,
    model: string
  ): Promise<ProcessorResult> {
    console.log(`[${this.processor.constructor.name}] Processing file: ${file.name}`);
    const startTime = performance.now();

    const result = await super.handle(file, accumulatedData, ai, model);

    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);

    console.log(`[${this.processor.constructor.name}] Completed in ${duration}ms`);
    console.log(`[${this.processor.constructor.name}] Errors: ${result.errors.length}, Warnings: ${result.warnings.length}`);

    return result;
  }
}

/**
 * Metrics decorator for processors
 */
export class MetricsProcessorDecorator extends ProcessorDecorator {
  private static metrics: Map<string, {
    count: number;
    totalTime: number;
    errors: number;
    successes: number;
  }> = new Map();

  async handle(
    file: File,
    accumulatedData: Partial<ExtractedData>,
    ai: GoogleGenAI,
    model: string
  ): Promise<ProcessorResult> {
    const processorName = this.processor.constructor.name;
    const startTime = performance.now();

    const result = await super.handle(file, accumulatedData, ai, model);

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Update metrics
    if (!MetricsProcessorDecorator.metrics.has(processorName)) {
      MetricsProcessorDecorator.metrics.set(processorName, {
        count: 0,
        totalTime: 0,
        errors: 0,
        successes: 0,
      });
    }

    const metrics = MetricsProcessorDecorator.metrics.get(processorName)!;
    metrics.count++;
    metrics.totalTime += duration;

    if (result.errors.length > 0) {
      metrics.errors++;
    } else {
      metrics.successes++;
    }

    return result;
  }

  static getMetrics(processorName?: string): any {
    if (processorName) {
      const metrics = this.metrics.get(processorName);
      if (!metrics) return null;

      return {
        ...metrics,
        averageTime: metrics.totalTime / metrics.count,
        successRate: (metrics.successes / metrics.count) * 100,
      };
    }

    // Return all metrics
    const allMetrics: any = {};
    this.metrics.forEach((value, key) => {
      allMetrics[key] = {
        ...value,
        averageTime: value.totalTime / value.count,
        successRate: (value.successes / value.count) * 100,
      };
    });

    return allMetrics;
  }

  static resetMetrics(): void {
    this.metrics.clear();
  }
}

/**
 * Rate limiting decorator for processors
 */
export class RateLimitProcessorDecorator extends ProcessorDecorator {
  private lastCallTime: number = 0;
  private minInterval: number;

  constructor(processor: DocumentProcessor, minIntervalMs: number = 1000) {
    super(processor);
    this.minInterval = minIntervalMs;
  }

  async handle(
    file: File,
    accumulatedData: Partial<ExtractedData>,
    ai: GoogleGenAI,
    model: string
  ): Promise<ProcessorResult> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    if (timeSinceLastCall < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastCall;
      console.log(`[RATE LIMIT] Waiting ${waitTime}ms before processing`);
      await this.sleep(waitTime);
    }

    this.lastCallTime = Date.now();
    return await super.handle(file, accumulatedData, ai, model);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Sanitization decorator for processors
 */
export class SanitizationProcessorDecorator extends ProcessorDecorator {
  async handle(
    file: File,
    accumulatedData: Partial<ExtractedData>,
    ai: GoogleGenAI,
    model: string
  ): Promise<ProcessorResult> {
    const result = await super.handle(file, accumulatedData, ai, model);

    // Sanitize extracted data
    const sanitized = this.sanitizeData(result.data);

    return {
      ...result,
      data: sanitized,
    };
  }

  private sanitizeData(data: Partial<ExtractedData>): Partial<ExtractedData> {
    const sanitized: Partial<ExtractedData> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "string") {
        // Trim whitespace
        let cleaned = value.trim();

        // Remove multiple spaces
        cleaned = cleaned.replace(/\s+/g, " ");

        // Remove null bytes
        cleaned = cleaned.replace(/\0/g, "");

        sanitized[key as keyof ExtractedData] = cleaned;
      } else {
        sanitized[key as keyof ExtractedData] = value;
      }
    }

    return sanitized;
  }
}
