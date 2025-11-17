/**
 * Offline Processing Module - Central Export
 *
 * This module provides comprehensive offline processing and synchronization
 * capabilities for the Filr extension.
 *
 * Design Patterns Implemented:
 * - Singleton: NetworkStatusManager, LocalDocumentStore, SyncManager
 * - Observer: Network status changes, sync events
 * - State: OnlineState/OfflineState for processing behavior
 * - Proxy: ProcessingProxy intercepts processing requests
 * - Memento: DocumentJob state preservation
 * - Facade: LocalDocumentStore simplifies IndexedDB
 */

// Core Components
export { NetworkStatusManager } from './NetworkStatusManager';
export type { NetworkStatus, NetworkStatusObserver } from './NetworkStatusManager';

export { LocalDocumentStore } from './LocalDocumentStore';
export type { JobQueryOptions, StorageStats } from './LocalDocumentStore';

export {
  DocumentJobFactory,
  DocumentJobOriginator,
  JobMementoCaretaker,
  DocumentJobSerializer,
} from './DocumentJob';
export type { DocumentJob, JobStatus, JobMetadata, JobMemento } from './DocumentJob';

// State Pattern
export {
  OnlineState,
  OfflineState,
  NetworkStateContextImpl,
} from './NetworkAwareState';
export type {
  NetworkAwareState,
  NetworkStateContext,
  ProcessingResponse,
} from './NetworkAwareState';

// Proxy Pattern
export { ProcessingProxy, ProcessingProxySingleton } from './ProcessingProxy';
export type { IDocumentProcessor } from './ProcessingProxy';

// Sync Manager
export { SyncManager } from './SyncManager';
export type {
  SyncEvent,
  SyncEventType,
  SyncObserver,
  SyncConfig,
} from './SyncManager';

// Notifications
export { OfflineNotifications, useOfflineNotifications } from './OfflineNotifications';
export type { Toast, ToastObserver } from './OfflineNotifications';

/**
 * Initialize offline processing subsystem
 *
 * This should be called once when the extension loads to set up
 * all offline processing components.
 */
export async function initializeOfflineProcessing(): Promise<void> {
  console.log('[OfflineProcessing] Initializing offline processing subsystem...');

  try {
    // Initialize LocalDocumentStore
    const localStore = LocalDocumentStore.getInstance();
    await localStore.initializeDB();

    // Cleanup any stuck jobs from previous session
    const cleanedUp = await localStore.cleanupStuckJobs(30);
    if (cleanedUp > 0) {
      console.log(`[OfflineProcessing] Cleaned up ${cleanedUp} stuck jobs from previous session`);
    }

    // Initialize NetworkStatusManager
    const networkManager = NetworkStatusManager.getInstance();
    console.log(`[OfflineProcessing] Network status: ${networkManager.getStatus()}`);

    // Initialize SyncManager
    const syncManager = SyncManager.getInstance();

    // If online, check for queued jobs and sync
    if (networkManager.isOnline()) {
      const stats = await localStore.getStorageStats();
      if (stats.queuedJobs > 0) {
        console.log(`[OfflineProcessing] Found ${stats.queuedJobs} queued jobs, starting sync...`);
        // Start sync after a short delay to ensure everything is ready
        setTimeout(() => {
          syncManager.startSync();
        }, 2000);
      }
    }

    // Initialize notifications
    OfflineNotifications.getInstance();

    console.log('[OfflineProcessing] Offline processing subsystem initialized successfully');
  } catch (error) {
    console.error('[OfflineProcessing] Failed to initialize offline processing:', error);
    throw error;
  }
}

/**
 * Cleanup offline processing subsystem
 *
 * This should be called when the extension is unloading (if needed).
 */
export function cleanupOfflineProcessing(): void {
  console.log('[OfflineProcessing] Cleaning up offline processing subsystem...');

  try {
    // Cleanup all singletons
    NetworkStatusManager.resetInstance();
    LocalDocumentStore.resetInstance();
    SyncManager.resetInstance();
    OfflineNotifications.resetInstance();
    ProcessingProxySingleton.resetInstance();

    console.log('[OfflineProcessing] Offline processing subsystem cleaned up');
  } catch (error) {
    console.error('[OfflineProcessing] Error during cleanup:', error);
  }
}

/**
 * Get offline processing statistics
 */
export async function getOfflineStats() {
  const localStore = LocalDocumentStore.getInstance();
  await localStore.initializeDB();
  return localStore.getStorageStats();
}
