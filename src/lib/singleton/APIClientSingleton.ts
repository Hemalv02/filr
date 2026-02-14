/**
 * Singleton Pattern Implementation
 *
 * Ensures only one instance of the API client exists throughout the application.
 * Provides global access point to the Gemini API client.
 */

import { GoogleGenAI } from "@google/genai";
import { ApiKeyManager } from "../secureStorage";

/**
 * Singleton API Client Manager
 */
export class APIClientSingleton {
  private static instance: APIClientSingleton;
  private client: GoogleGenAI | null = null;
  private apiKey: string | null = null;

  /**
   * Private constructor prevents direct instantiation
   */
  private constructor() {
    // Private constructor ensures singleton
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): APIClientSingleton {
    if (!APIClientSingleton.instance) {
      APIClientSingleton.instance = new APIClientSingleton();
      console.log("[SINGLETON] APIClientSingleton instance created");
    }
    return APIClientSingleton.instance;
  }

  /**
   * Initialize or update the API client with a new key
   */
  public initializeClient(apiKey: string): GoogleGenAI {
    if (!apiKey) {
      throw new Error("API key is required");
    }

    // Only create new client if key has changed
    if (this.apiKey !== apiKey || !this.client) {
      console.log("[SINGLETON] Initializing new API client");
      this.apiKey = apiKey;
      this.client = new GoogleGenAI({ apiKey });
    }

    return this.client;
  }

  /**
   * Get the current client instance
   */
  public getClient(): GoogleGenAI {
    if (!this.client) {
      throw new Error("API client not initialized. Call initializeClient() first.");
    }
    return this.client;
  }

  /**
   * Check if client is initialized
   */
  public isInitialized(): boolean {
    return this.client !== null;
  }

  /**
   * Get current API key (for validation)
   */
  public getApiKey(): string | null {
    return this.apiKey;
  }

  /**
   * Clear the client (for logout or key change)
   */
  public clearClient(): void {
    console.log("[SINGLETON] Clearing API client");
    this.client = null;
    this.apiKey = null;
  }

  /**
   * Prevent cloning of singleton
   */
  private clone(): APIClientSingleton {
    throw new Error("Cannot clone singleton instance");
  }
}

/**
 * Singleton for application settings
 */
export class SettingsSingleton {
  private static instance: SettingsSingleton;
  private settings: Map<string, any> = new Map();

  /**
   * Private constructor
   */
  private constructor() {
    this.loadFromStorage();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SettingsSingleton {
    if (!SettingsSingleton.instance) {
      SettingsSingleton.instance = new SettingsSingleton();
      console.log("[SINGLETON] SettingsSingleton instance created");
    }
    return SettingsSingleton.instance;
  }

  /**
   * Load settings from localStorage
   */
  private loadFromStorage(): void {
    try {
      // Load API key from secure storage (in-memory cache)
      const apiKey = ApiKeyManager.getInstance().getApiKey();
      if (apiKey) {
        this.settings.set("gemini_api_key", apiKey);
      }

      // Load non-sensitive settings from localStorage
      const keys = ["gemini_model", "theme"];
      keys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          this.settings.set(key, value);
        }
      });
      console.log("[SINGLETON] Settings loaded from storage");
    } catch (error) {
      console.error("[SINGLETON] Failed to load settings:", error);
    }
  }

  /**
   * Get a setting value
   */
  public get(key: string): any {
    return this.settings.get(key);
  }

  /**
   * Set a setting value
   */
  public set(key: string, value: any): void {
    this.settings.set(key, value);
    try {
      if (key === "gemini_api_key") {
        ApiKeyManager.getInstance().setApiKey(value);
      } else {
        localStorage.setItem(key, value);
      }
      console.log(`[SINGLETON] Setting saved: ${key}`);
    } catch (error) {
      console.error(`[SINGLETON] Failed to save setting ${key}:`, error);
    }
  }

  /**
   * Get all settings
   */
  public getAll(): Record<string, any> {
    const allSettings: Record<string, any> = {};
    this.settings.forEach((value, key) => {
      allSettings[key] = value;
    });
    return allSettings;
  }

  /**
   * Clear all settings
   */
  public clearAll(): void {
    this.settings.clear();
    try {
      localStorage.clear();
      console.log("[SINGLETON] All settings cleared");
    } catch (error) {
      console.error("[SINGLETON] Failed to clear settings:", error);
    }
  }

  /**
   * Check if a setting exists
   */
  public has(key: string): boolean {
    return this.settings.has(key);
  }
}

/**
 * Singleton for metrics collection
 */
export class MetricsSingleton {
  private static instance: MetricsSingleton;
  private metrics: Map<string, any> = new Map();
  private startTime: number;

  /**
   * Private constructor
   */
  private constructor() {
    this.startTime = Date.now();
    console.log("[SINGLETON] MetricsSingleton instance created");
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MetricsSingleton {
    if (!MetricsSingleton.instance) {
      MetricsSingleton.instance = new MetricsSingleton();
    }
    return MetricsSingleton.instance;
  }

  /**
   * Record a metric
   */
  public record(key: string, value: any): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key).push({
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Increment a counter
   */
  public increment(key: string, amount: number = 1): void {
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + amount);
  }

  /**
   * Get a metric
   */
  public get(key: string): any {
    return this.metrics.get(key);
  }

  /**
   * Get all metrics
   */
  public getAll(): Record<string, any> {
    const allMetrics: Record<string, any> = {};
    this.metrics.forEach((value, key) => {
      allMetrics[key] = value;
    });
    return allMetrics;
  }

  /**
   * Get uptime in seconds
   */
  public getUptime(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * Clear all metrics
   */
  public clear(): void {
    this.metrics.clear();
    console.log("[SINGLETON] Metrics cleared");
  }

  /**
   * Export metrics as JSON
   */
  public export(): string {
    return JSON.stringify({
      uptime: this.getUptime(),
      metrics: this.getAll(),
      timestamp: new Date().toISOString(),
    }, null, 2);
  }
}
