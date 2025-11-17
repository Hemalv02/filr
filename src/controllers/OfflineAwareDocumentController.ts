/**
 * OfflineAwareDocumentController
 *
 * Extends the DocumentController with offline processing capabilities.
 * Uses the ProcessingProxy to automatically queue documents when offline.
 *
 * Design Patterns:
 * - Proxy: Delegates to ProcessingProxy for offline handling
 * - Decorator: Wraps DocumentController with offline capabilities
 */

import { ProcessingProxySingleton } from '../lib/offline/ProcessingProxy';
import type { DocumentUploadModel, ProcessingResultModel } from '../models/DocumentModel';
import type { ProcessingResponse } from '../lib/offline/NetworkAwareState';

/**
 * Result type that can be either immediate processing or queued
 */
export type OfflineProcessingResult = ProcessingResultModel | ProcessingResponse;

/**
 * OfflineAwareDocumentController
 *
 * Drop-in replacement for DocumentController that handles offline scenarios
 */
export class OfflineAwareDocumentController {
  /**
   * Process documents with offline support
   *
   * If online: Processes immediately via DocumentController
   * If offline: Queues documents in IndexedDB for later sync
   *
   * @returns ProcessingResultModel if online, ProcessingResponse if offline/queued
   */
  static async processDocuments(
    documents: DocumentUploadModel[],
    apiKey: string,
    model: string,
    onProgress?: (event: any) => void
  ): Promise<OfflineProcessingResult> {
    const proxy = ProcessingProxySingleton.getInstance();

    console.log(
      `[OfflineAwareDocumentController] Processing ${documents.length} documents (status: ${proxy.getNetworkStatus()})`
    );

    const result = await proxy.processDocuments(documents, apiKey, model, onProgress);

    // Check if result is a ProcessingResponse (offline queue)
    if ('queued' in result) {
      console.log(
        `[OfflineAwareDocumentController] Documents queued: ${result.queued}`
      );
      return result as ProcessingResponse;
    }

    // Result is ProcessingResultModel (online processing)
    console.log('[OfflineAwareDocumentController] Documents processed online');
    return result as ProcessingResultModel;
  }

  /**
   * Check if currently online
   */
  static isOnline(): boolean {
    const proxy = ProcessingProxySingleton.getInstance();
    return proxy.isOnline();
  }

  /**
   * Check if currently offline
   */
  static isOffline(): boolean {
    const proxy = ProcessingProxySingleton.getInstance();
    return proxy.isOffline();
  }

  /**
   * Get network status
   */
  static getNetworkStatus(): 'online' | 'offline' {
    const proxy = ProcessingProxySingleton.getInstance();
    return proxy.getNetworkStatus();
  }
}

/**
 * Helper to check if result is a queued response
 */
export function isQueuedResponse(
  result: OfflineProcessingResult
): result is ProcessingResponse {
  return 'queued' in result;
}

/**
 * Helper to check if result is immediate processing
 */
export function isProcessingResult(
  result: OfflineProcessingResult
): result is ProcessingResultModel {
  return 'data' in result && !('queued' in result);
}
