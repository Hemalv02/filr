/**
 * Command Pattern Implementation
 *
 * Encapsulates requests as objects, allowing parameterization of clients
 * with different requests, queuing of requests, and undoable operations.
 */

import type { ExtractedData } from "../gemini";
import type { FormData } from "../formExtraction";
import type { DocumentUploadModel } from "../models/DocumentModel";

/**
 * Base Command interface
 */
export interface Command {
  execute(): Promise<void> | void;
  undo(): Promise<void> | void;
  canUndo(): boolean;
  getDescription(): string;
}

/**
 * Abstract base command with common functionality
 */
export abstract class BaseCommand implements Command {
  protected executed: boolean = false;

  abstract execute(): Promise<void> | void;
  abstract undo(): Promise<void> | void;

  canUndo(): boolean {
    return this.executed;
  }

  abstract getDescription(): string;
}

/**
 * Command to process documents
 */
export class ProcessDocumentsCommand extends BaseCommand {
  private documents: DocumentUploadModel[];
  private apiKey: string;
  private model: string;
  private onSuccess: (data: ExtractedData) => void;
  private onError: (error: Error) => void;
  private result: ExtractedData | null = null;

  constructor(
    documents: DocumentUploadModel[],
    apiKey: string,
    model: string,
    onSuccess: (data: ExtractedData) => void,
    onError: (error: Error) => void
  ) {
    super();
    this.documents = documents;
    this.apiKey = apiKey;
    this.model = model;
    this.onSuccess = onSuccess;
    this.onError = onError;
  }

  async execute(): Promise<void> {
    try {
      console.log(`[COMMAND] Executing: ${this.getDescription()}`);

      const { ProcessorChain } = await import("../processors/ProcessorChain");
      const files = this.documents.filter(d => d.file !== null).map(d => d.file!);

      const chain = ProcessorChain.createOptimizedForFiles(files);
      const result = await chain.processDocuments(files, this.apiKey, this.model);

      this.result = result.data;
      this.executed = true;
      this.onSuccess(result.data);

      console.log(`[COMMAND] Completed: ${this.getDescription()}`);
    } catch (error) {
      console.error(`[COMMAND] Failed: ${this.getDescription()}`, error);
      this.onError(error as Error);
      throw error;
    }
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) {
      console.warn("[COMMAND] Cannot undo - not executed");
      return;
    }
    console.log(`[COMMAND] Undoing: ${this.getDescription()}`);
    this.result = null;
    this.executed = false;
  }

  getDescription(): string {
    return `Process ${this.documents.filter(d => d.file).length} documents`;
  }
}

/**
 * Command to fill form
 */
export class FillFormCommand extends BaseCommand {
  private formData: FormData;
  private extractedData: ExtractedData;
  private onSuccess: (result: any) => void;
  private onError: (error: Error) => void;
  private previousValues: Map<string, string> = new Map();

  constructor(
    formData: FormData,
    extractedData: ExtractedData,
    onSuccess: (result: any) => void,
    onError: (error: Error) => void
  ) {
    super();
    this.formData = formData;
    this.extractedData = extractedData;
    this.onSuccess = onSuccess;
    this.onError = onError;
  }

  async execute(): Promise<void> {
    try {
      console.log(`[COMMAND] Executing: ${this.getDescription()}`);

      const { executeAutoFill } = await import("../formFiller");

      // Save current form values for undo
      await this.saveCurrentValues();

      const result = await executeAutoFill(this.formData, this.extractedData);
      this.executed = true;
      this.onSuccess(result);

      console.log(`[COMMAND] Completed: ${this.getDescription()}`);
    } catch (error) {
      console.error(`[COMMAND] Failed: ${this.getDescription()}`, error);
      this.onError(error as Error);
      throw error;
    }
  }

  private async saveCurrentValues(): Promise<void> {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: (formData) => {
        const values = new Map<string, string>();
        formData.inputs.forEach((field: any) => {
          const element = document.getElementById(field.input_field_id) as HTMLInputElement;
          if (element) {
            values.set(field.input_field_id, element.value);
          }
        });
        return Array.from(values.entries());
      },
      args: [this.formData],
    });

    if (results && results[0]) {
      this.previousValues = new Map(results[0].result as [string, string][]);
    }
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) {
      console.warn("[COMMAND] Cannot undo - not executed");
      return;
    }

    console.log(`[COMMAND] Undoing: ${this.getDescription()}`);

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: (previousValues) => {
        previousValues.forEach(([id, value]: [string, string]) => {
          const element = document.getElementById(id) as HTMLInputElement;
          if (element) {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      },
      args: [Array.from(this.previousValues.entries())],
    });

    this.executed = false;
  }

  getDescription(): string {
    return `Fill ${this.formData.inputs.length} form fields`;
  }
}

/**
 * Command to save settings
 */
export class SaveSettingsCommand extends BaseCommand {
  private apiKey: string;
  private model: string;
  private previousApiKey: string | null = null;
  private previousModel: string | null = null;

  constructor(apiKey: string, model: string) {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  execute(): void {
    console.log(`[COMMAND] Executing: ${this.getDescription()}`);

    // Save previous values for undo
    this.previousApiKey = localStorage.getItem("gemini_api_key");
    this.previousModel = localStorage.getItem("gemini_model");

    // Save new values
    localStorage.setItem("gemini_api_key", this.apiKey);
    localStorage.setItem("gemini_model", this.model);

    this.executed = true;
    console.log(`[COMMAND] Completed: ${this.getDescription()}`);
  }

  undo(): void {
    if (!this.canUndo()) {
      console.warn("[COMMAND] Cannot undo - not executed");
      return;
    }

    console.log(`[COMMAND] Undoing: ${this.getDescription()}`);

    if (this.previousApiKey !== null) {
      localStorage.setItem("gemini_api_key", this.previousApiKey);
    }
    if (this.previousModel !== null) {
      localStorage.setItem("gemini_model", this.previousModel);
    }

    this.executed = false;
  }

  getDescription(): string {
    return "Save settings";
  }
}

/**
 * Command to clear documents
 */
export class ClearDocumentsCommand extends BaseCommand {
  private documents: DocumentUploadModel[];
  private setDocuments: (docs: DocumentUploadModel[]) => void;
  private previousState: DocumentUploadModel[] = [];

  constructor(
    documents: DocumentUploadModel[],
    setDocuments: (docs: DocumentUploadModel[]) => void
  ) {
    super();
    this.documents = documents;
    this.setDocuments = setDocuments;
  }

  execute(): void {
    console.log(`[COMMAND] Executing: ${this.getDescription()}`);

    // Save previous state
    this.previousState = JSON.parse(JSON.stringify(this.documents));

    // Clear all files
    const cleared = this.documents.map(doc => ({ ...doc, file: null }));
    this.setDocuments(cleared);

    this.executed = true;
    console.log(`[COMMAND] Completed: ${this.getDescription()}`);
  }

  undo(): void {
    if (!this.canUndo()) {
      console.warn("[COMMAND] Cannot undo - not executed");
      return;
    }

    console.log(`[COMMAND] Undoing: ${this.getDescription()}`);
    this.setDocuments(this.previousState);
    this.executed = false;
  }

  getDescription(): string {
    return "Clear all documents";
  }
}

/**
 * Command Invoker - Manages command execution and history
 */
export class CommandInvoker {
  private history: Command[] = [];
  private currentIndex: number = -1;

  /**
   * Execute a command and add to history
   */
  async execute(command: Command): Promise<void> {
    await command.execute();

    // Remove any commands after current index (for redo)
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Add command to history
    this.history.push(command);
    this.currentIndex++;

    console.log(`[INVOKER] Command executed. History: ${this.history.length}, Index: ${this.currentIndex}`);
  }

  /**
   * Undo last command
   */
  async undo(): Promise<void> {
    if (!this.canUndo()) {
      console.warn("[INVOKER] Cannot undo - no commands in history");
      return;
    }

    const command = this.history[this.currentIndex];
    await command.undo();
    this.currentIndex--;

    console.log(`[INVOKER] Command undone. Index: ${this.currentIndex}`);
  }

  /**
   * Redo previously undone command
   */
  async redo(): Promise<void> {
    if (!this.canRedo()) {
      console.warn("[INVOKER] Cannot redo - no commands to redo");
      return;
    }

    this.currentIndex++;
    const command = this.history[this.currentIndex];
    await command.execute();

    console.log(`[INVOKER] Command redone. Index: ${this.currentIndex}`);
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex >= 0 && this.history[this.currentIndex]?.canUndo();
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get command history
   */
  getHistory(): string[] {
    return this.history.map(cmd => cmd.getDescription());
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.currentIndex = -1;
    console.log("[INVOKER] History cleared");
  }
}
