/**
 * ProcessingProxy - Proxy Pattern for Offline-Aware Document Processing
 *
 * Intercepts document processing requests and delegates them based on
 * network status (online = immediate processing, offline = queue).
 *
 * Design Patterns:
 * - Proxy: Provides a surrogate/placeholder for DocumentController
 * - Facade: Simplifies the offline/online decision logic
 */

import { DocumentController } from '../../controllers/DocumentController';
import type {
  DocumentUploadModel,
  ProcessingResultModel,
} from '../../models/DocumentModel';
import {
  NetworkStateContextImpl,
  type ProcessingResponse,
} from './NetworkAwareState';

/**
 * Interface for document processing
 * Both the real DocumentController and ProcessingProxy implement this
 */
export interface IDocumentProcessor {
  processDocuments(
    documents: DocumentUploadModel[],
    apiKey: string,
    model: string,
    onProgress?: (event: any) => void
  ): Promise<ProcessingResultModel | ProcessingResponse>;
}

/**
 * ProcessingProxy - Intelligently routes processing requests
 */
export class ProcessingProxy implements IDocumentProcessor {
  private networkContext: NetworkStateContextImpl;
  private realController: typeof DocumentController;

  constructor() {
    this.networkContext = new NetworkStateContextImpl();
    this.realController = DocumentController;

    // Set up state change listener
    this.networkContext.onStateChange = (newState) => {
      console.log(
        `[ProcessingProxy] Network state changed to: ${newState.getStateName()}`
      );
    };
  }

  /**
   * Process documents - delegates based on network status
   */
  public async processDocuments(
    documents: DocumentUploadModel[],
    apiKey: string,
    model: string,
    onProgress?: (event: any) => void
  ): Promise<ProcessingResultModel | ProcessingResponse> {
    console.log(
      `[ProcessingProxy] Processing request for ${documents.length} documents (status: ${this.networkContext.getNetworkStatus()})`
    );

    // Delegate to current state
    const response = await this.networkContext.currentState.handleProcessingRequest(
      this.networkContext,
      documents,
      apiKey,
      model
    );

    if (response.queued) {
      // Documents were queued for offline processing
      console.log(
        `[ProcessingProxy] Documents queued: ${response.jobIds?.length || 0} jobs`
      );
      return response;
    } else {
      // Online - process immediately using real DocumentController
      console.log('[ProcessingProxy] Processing documents online (delegating to DocumentController)');

      try {
        const result = await this.realController.processDocuments(
          documents,
          apiKey,
          model,
          onProgress
        );

        console.log('[ProcessingProxy] Online processing completed successfully');
        return result;
      } catch (error) {
        console.error('[ProcessingProxy] Online processing failed:', error);
        throw error;
      }
    }
  }

  /**
   * Check if currently online
   */
  public isOnline(): boolean {
    return this.networkContext.isOnline();
  }

  /**
   * Check if currently offline
   */
  public isOffline(): boolean {
    return this.networkContext.isOffline();
  }

  /**
   * Get current network status
   */
  public getNetworkStatus(): 'online' | 'offline' {
    return this.networkContext.getNetworkStatus();
  }

  /**
   * Get the network context (for advanced usage)
   */
  public getNetworkContext(): NetworkStateContextImpl {
    return this.networkContext;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.networkContext.cleanup();
  }
}

/**
 * Singleton instance of ProcessingProxy
 * Use this to ensure a single proxy instance across the app
 */
export class ProcessingProxySingleton {
  private static instance: ProcessingProxy | null = null;

  public static getInstance(): ProcessingProxy {
    if (!ProcessingProxySingleton.instance) {
      ProcessingProxySingleton.instance = new ProcessingProxy();
    }
    return ProcessingProxySingleton.instance;
  }

  public static resetInstance(): void {
    if (ProcessingProxySingleton.instance) {
      ProcessingProxySingleton.instance.cleanup();
      ProcessingProxySingleton.instance = null;
    }
  }
}

// Export default as singleton getter
export default ProcessingProxySingleton.getInstance;
