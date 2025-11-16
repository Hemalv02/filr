/**
 * Mediator Pattern Implementation
 *
 * Defines an object that encapsulates how a set of objects interact.
 * Mediator promotes loose coupling by keeping objects from referring
 * to each other explicitly.
 */

import type { ExtractedData } from "../gemini";
import type { FormData, SourceDocumentList } from "../formExtraction";
import type { ProgressEvent } from "../observers/ProcessingObserver";
import type { PageType } from "../models/DocumentModel";

/**
 * Component interface - all components that use mediator implement this
 */
export interface MediatorComponent {
  setMediator(mediator: Mediator): void;
  getName(): string;
}

/**
 * Mediator interface
 */
export interface Mediator {
  notify(sender: MediatorComponent, event: string, data?: any): void;
  registerComponent(name: string, component: MediatorComponent): void;
  unregisterComponent(name: string): void;
}

/**
 * Concrete Mediator for Application
 */
export class AppMediator implements Mediator {
  private components: Map<string, MediatorComponent> = new Map();
  private eventLog: Array<{ sender: string; event: string; timestamp: number }> = [];

  /**
   * Register a component
   */
  registerComponent(name: string, component: MediatorComponent): void {
    this.components.set(name, component);
    component.setMediator(this);
    console.log(`[MEDIATOR] Registered component: ${name}`);
  }

  /**
   * Unregister a component
   */
  unregisterComponent(name: string): void {
    this.components.delete(name);
    console.log(`[MEDIATOR] Unregistered component: ${name}`);
  }

  /**
   * Central notification handler
   */
  notify(sender: MediatorComponent, event: string, data?: any): void {
    const senderName = sender.getName();

    // Log event
    this.eventLog.push({
      sender: senderName,
      event,
      timestamp: Date.now(),
    });

    console.log(`[MEDIATOR] Event "${event}" from ${senderName}`, data);

    // Route events to appropriate handlers
    this.handleEvent(senderName, event, data);
  }

  /**
   * Handle different events
   */
  private handleEvent(sender: string, event: string, data?: any): void {
    switch (event) {
      case "navigation:request":
        this.handleNavigationRequest(sender, data);
        break;

      case "processing:start":
        this.handleProcessingStart(sender, data);
        break;

      case "processing:complete":
        this.handleProcessingComplete(sender, data);
        break;

      case "processing:error":
        this.handleProcessingError(sender, data);
        break;

      case "form:detected":
        this.handleFormDetected(sender, data);
        break;

      case "form:filled":
        this.handleFormFilled(sender, data);
        break;

      case "settings:updated":
        this.handleSettingsUpdated(sender, data);
        break;

      case "data:updated":
        this.handleDataUpdated(sender, data);
        break;

      default:
        console.warn(`[MEDIATOR] Unhandled event: ${event}`);
    }
  }

  private handleNavigationRequest(sender: string, data: { target: PageType }): void {
    console.log(`[MEDIATOR] Navigation request to ${data.target}`);
    // Notify navigation controller
    const navComponent = this.components.get("navigation");
    if (navComponent) {
      (navComponent as any).navigate?.(data.target);
    }
  }

  private handleProcessingStart(sender: string, data: any): void {
    console.log("[MEDIATOR] Processing started");
    // Notify UI components to show loading state
    const uiComponent = this.components.get("ui");
    if (uiComponent) {
      (uiComponent as any).showLoading?.();
    }
  }

  private handleProcessingComplete(sender: string, data: ExtractedData): void {
    console.log("[MEDIATOR] Processing completed");
    // Notify data manager to store results
    const dataManager = this.components.get("dataManager");
    if (dataManager) {
      (dataManager as any).storeExtractedData?.(data);
    }

    // Notify UI to show results
    const uiComponent = this.components.get("ui");
    if (uiComponent) {
      (uiComponent as any).showResults?.(data);
    }
  }

  private handleProcessingError(sender: string, data: Error): void {
    console.error("[MEDIATOR] Processing error", data);
    // Notify error handler
    const errorHandler = this.components.get("errorHandler");
    if (errorHandler) {
      (errorHandler as any).handleError?.(data);
    }
  }

  private handleFormDetected(sender: string, data: { formData: FormData; sourceDocuments: SourceDocumentList }): void {
    console.log("[MEDIATOR] Form detected");
    // Notify data manager
    const dataManager = this.components.get("dataManager");
    if (dataManager) {
      (dataManager as any).storeFormData?.(data.formData, data.sourceDocuments);
    }
  }

  private handleFormFilled(sender: string, data: { filled: number; failed: number }): void {
    console.log(`[MEDIATOR] Form filled: ${data.filled} fields`);
    // Notify UI to show success message
    const uiComponent = this.components.get("ui");
    if (uiComponent) {
      (uiComponent as any).showNotification?.(`Filled ${data.filled} fields, ${data.failed} failed`);
    }
  }

  private handleSettingsUpdated(sender: string, data: any): void {
    console.log("[MEDIATOR] Settings updated");
    // Notify all components that might need to refresh
    this.components.forEach((component, name) => {
      if (name !== sender) {
        (component as any).onSettingsChanged?.(data);
      }
    });
  }

  private handleDataUpdated(sender: string, data: any): void {
    console.log("[MEDIATOR] Data updated");
    // Notify subscribers
    this.components.forEach((component, name) => {
      if (name !== sender) {
        (component as any).onDataChanged?.(data);
      }
    });
  }

  /**
   * Get event log
   */
  getEventLog(): Array<{ sender: string; event: string; timestamp: number }> {
    return [...this.eventLog];
  }

  /**
   * Clear event log
   */
  clearEventLog(): void {
    this.eventLog = [];
  }
}

/**
 * Example component implementations
 */

/**
 * Navigation component
 */
export class NavigationComponent implements MediatorComponent {
  private mediator?: Mediator;
  private currentPage: PageType = "home";

  getName(): string {
    return "navigation";
  }

  setMediator(mediator: Mediator): void {
    this.mediator = mediator;
  }

  navigate(target: PageType): void {
    console.log(`[NAV] Navigating to ${target}`);

    this.currentPage = target;

    // Notify mediator of navigation
    if (this.mediator) {
      this.mediator.notify(this, "navigation:complete", { page: target });
    }
  }

  requestNavigation(target: PageType): void {
    if (this.mediator) {
      this.mediator.notify(this, "navigation:request", { target });
    }
  }
}

/**
 * Data manager component
 */
export class DataManagerComponent implements MediatorComponent {
  private mediator?: Mediator;
  private extractedData: ExtractedData | null = null;
  private formData: FormData | null = null;

  getName(): string {
    return "dataManager";
  }

  setMediator(mediator: Mediator): void {
    this.mediator = mediator;
  }

  storeExtractedData(data: ExtractedData): void {
    console.log("[DATA] Storing extracted data");
    this.extractedData = data;

    if (this.mediator) {
      this.mediator.notify(this, "data:updated", { type: "extracted", data });
    }
  }

  storeFormData(formData: FormData, sourceDocuments: SourceDocumentList): void {
    console.log("[DATA] Storing form data");
    this.formData = formData;

    if (this.mediator) {
      this.mediator.notify(this, "data:updated", { type: "form", data: formData });
    }
  }

  getExtractedData(): ExtractedData | null {
    return this.extractedData;
  }

  getFormData(): FormData | null {
    return this.formData;
  }
}

/**
 * UI component
 */
export class UIComponent implements MediatorComponent {
  private mediator?: Mediator;

  getName(): string {
    return "ui";
  }

  setMediator(mediator: Mediator): void {
    this.mediator = mediator;
  }

  showLoading(): void {
    console.log("[UI] Showing loading state");
  }

  showResults(data: ExtractedData): void {
    console.log("[UI] Showing results");
  }

  showNotification(message: string): void {
    console.log(`[UI] Notification: ${message}`);
  }

  onSettingsChanged(settings: any): void {
    console.log("[UI] Settings changed, refreshing UI");
  }
}

/**
 * Processing component
 */
export class ProcessingComponent implements MediatorComponent {
  private mediator?: Mediator;

  getName(): string {
    return "processing";
  }

  setMediator(mediator: Mediator): void {
    this.mediator = mediator;
  }

  async startProcessing(files: File[], apiKey: string, model: string): Promise<void> {
    if (this.mediator) {
      this.mediator.notify(this, "processing:start", { fileCount: files.length });
    }

    try {
      // Process files...
      console.log("[PROCESSING] Starting document processing");

      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockData: Partial<ExtractedData> = {
        name_english: "Test User",
      };

      if (this.mediator) {
        this.mediator.notify(this, "processing:complete", mockData);
      }
    } catch (error) {
      if (this.mediator) {
        this.mediator.notify(this, "processing:error", error);
      }
    }
  }
}
