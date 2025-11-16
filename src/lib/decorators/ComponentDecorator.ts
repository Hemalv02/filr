/**
 * Decorator Pattern Implementation for Component Enhancement
 *
 * This implements the Decorator pattern to add functionality to components
 * dynamically without modifying their structure.
 */

import type { ExtractedData } from "../gemini";

/**
 * Base component interface that can be decorated
 */
export interface Component {
  execute(): void;
  getData(): any;
}

/**
 * Base decorator abstract class
 */
export abstract class ComponentDecorator implements Component {
  protected component: Component;

  constructor(component: Component) {
    this.component = component;
  }

  execute(): void {
    this.component.execute();
  }

  getData(): any {
    return this.component.getData();
  }
}

/**
 * Concrete decorator: Adds logging functionality
 */
export class LoggingDecorator extends ComponentDecorator {
  private logPrefix: string;

  constructor(component: Component, logPrefix: string = "[LOG]") {
    super(component);
    this.logPrefix = logPrefix;
  }

  execute(): void {
    console.log(`${this.logPrefix} Executing component...`);
    const startTime = performance.now();

    super.execute();

    const endTime = performance.now();
    console.log(`${this.logPrefix} Execution completed in ${(endTime - startTime).toFixed(2)}ms`);
  }

  getData(): any {
    const data = super.getData();
    console.log(`${this.logPrefix} Retrieved data:`, data);
    return data;
  }
}

/**
 * Concrete decorator: Adds validation functionality
 */
export class ValidationDecorator extends ComponentDecorator {
  private validator: (data: any) => boolean;
  private onValidationError?: (error: string) => void;

  constructor(
    component: Component,
    validator: (data: any) => boolean,
    onValidationError?: (error: string) => void
  ) {
    super(component);
    this.validator = validator;
    this.onValidationError = onValidationError;
  }

  execute(): void {
    // Validate before execution
    const data = this.component.getData();

    if (!this.validator(data)) {
      const error = "Validation failed before execution";
      console.error(error, data);
      if (this.onValidationError) {
        this.onValidationError(error);
      }
      return;
    }

    super.execute();
  }

  getData(): any {
    const data = super.getData();

    // Validate data
    if (!this.validator(data)) {
      console.warn("Retrieved data failed validation", data);
    }

    return data;
  }
}

/**
 * Concrete decorator: Adds caching functionality
 */
export class CachingDecorator extends ComponentDecorator {
  private cache: Map<string, any> = new Map();
  private cacheKey: string;
  private ttl: number; // Time to live in milliseconds

  constructor(component: Component, cacheKey: string, ttl: number = 60000) {
    super(component);
    this.cacheKey = cacheKey;
    this.ttl = ttl;
  }

  getData(): any {
    const cached = this.cache.get(this.cacheKey);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      console.log(`[CACHE HIT] Returning cached data for key: ${this.cacheKey}`);
      return cached.data;
    }

    console.log(`[CACHE MISS] Fetching fresh data for key: ${this.cacheKey}`);
    const data = super.getData();

    this.cache.set(this.cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  clearCache(): void {
    this.cache.delete(this.cacheKey);
    console.log(`[CACHE CLEAR] Cleared cache for key: ${this.cacheKey}`);
  }
}

/**
 * Concrete decorator: Adds retry functionality
 */
export class RetryDecorator extends ComponentDecorator {
  private maxRetries: number;
  private retryDelay: number;

  constructor(component: Component, maxRetries: number = 3, retryDelay: number = 1000) {
    super(component);
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  async execute(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        super.execute();
        return; // Success, exit
      } catch (error) {
        lastError = error as Error;
        console.warn(`[RETRY] Attempt ${attempt + 1}/${this.maxRetries + 1} failed:`, error);

        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error("All retry attempts failed");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Concrete decorator: Adds data transformation functionality
 */
export class TransformDecorator extends ComponentDecorator {
  private transformer: (data: any) => any;

  constructor(component: Component, transformer: (data: any) => any) {
    super(component);
    this.transformer = transformer;
  }

  getData(): any {
    const data = super.getData();
    const transformed = this.transformer(data);
    console.log("[TRANSFORM] Data transformed", { original: data, transformed });
    return transformed;
  }
}

/**
 * Data processor component (concrete component)
 */
export class DataProcessor implements Component {
  private data: any;

  constructor(data: any) {
    this.data = data;
  }

  execute(): void {
    console.log("Processing data...");
    // Simulate processing
  }

  getData(): any {
    return this.data;
  }

  setData(data: any): void {
    this.data = data;
  }
}

/**
 * Extracted data processor with validation
 */
export class ExtractedDataProcessor implements Component {
  private data: Partial<ExtractedData>;

  constructor(data: Partial<ExtractedData>) {
    this.data = data;
  }

  execute(): void {
    console.log("Processing extracted data...");
    // Clean up empty fields
    Object.keys(this.data).forEach(key => {
      if (this.data[key as keyof ExtractedData] === "" ||
          this.data[key as keyof ExtractedData] === null) {
        delete this.data[key as keyof ExtractedData];
      }
    });
  }

  getData(): Partial<ExtractedData> {
    return this.data;
  }
}

/**
 * Builder for creating decorated components
 */
export class DecoratorBuilder {
  private component: Component;

  constructor(component: Component) {
    this.component = component;
  }

  withLogging(prefix: string = "[LOG]"): DecoratorBuilder {
    this.component = new LoggingDecorator(this.component, prefix);
    return this;
  }

  withValidation(
    validator: (data: any) => boolean,
    onError?: (error: string) => void
  ): DecoratorBuilder {
    this.component = new ValidationDecorator(this.component, validator, onError);
    return this;
  }

  withCaching(cacheKey: string, ttl: number = 60000): DecoratorBuilder {
    this.component = new CachingDecorator(this.component, cacheKey, ttl);
    return this;
  }

  withTransform(transformer: (data: any) => any): DecoratorBuilder {
    this.component = new TransformDecorator(this.component, transformer);
    return this;
  }

  build(): Component {
    return this.component;
  }
}

/**
 * Example usage:
 *
 * const processor = new DataProcessor(myData);
 *
 * const decorated = new DecoratorBuilder(processor)
 *   .withLogging("[PROCESSOR]")
 *   .withValidation((data) => data !== null)
 *   .withCaching("myDataKey", 30000)
 *   .build();
 *
 * decorated.execute();
 * const result = decorated.getData();
 */
