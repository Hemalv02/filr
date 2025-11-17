/**
 * NetworkAwareState - State Pattern for Offline/Online Processing
 *
 * Implements the State pattern to handle document processing differently
 * based on network connectivity status.
 *
 * Design Patterns:
 * - State: Different behavior based on online/offline state
 * - Strategy: Different processing strategies for different network states
 */

import type { DocumentUploadModel } from '../../models/DocumentModel';
import type { ProcessingResultModel } from '../../models/DocumentModel';
import { DocumentJobFactory } from './DocumentJob';
import { LocalDocumentStore } from './LocalDocumentStore';
import { NetworkStatusManager, type NetworkStatus } from './NetworkStatusManager';

/**
 * Interface for network-aware processing states
 */
export interface NetworkAwareState {
  /**
   * Handle document processing request
   */
  handleProcessingRequest(
    context: NetworkStateContext,
    documents: DocumentUploadModel[],
    apiKey: string,
    model: string
  ): Promise<ProcessingResponse>;

  /**
   * Get current state name
   */
  getStateName(): NetworkStatus;

  /**
   * Called when entering this state
   */
  onEnter(context: NetworkStateContext): void;

  /**
   * Called when exiting this state
   */
  onExit(context: NetworkStateContext): void;
}

/**
 * Response from processing request
 */
export interface ProcessingResponse {
  success: boolean;
  message: string;
  queued?: boolean;
  jobIds?: string[];
  result?: ProcessingResultModel;
}

/**
 * Context for network state management
 */
export interface NetworkStateContext {
  currentState: NetworkAwareState;
  networkStatus: NetworkStatus;
  onStateChange?: (newState: NetworkAwareState) => void;
  onJobsQueued?: (jobCount: number) => void;
  onProcessingComplete?: (result: ProcessingResultModel) => void;
}

/**
 * OnlineState - Processes documents immediately via API
 */
export class OnlineState implements NetworkAwareState {
  public getStateName(): NetworkStatus {
    return 'online';
  }

  public onEnter(context: NetworkStateContext): void {
    console.log('[OnlineState] Entered online state');
  }

  public onExit(context: NetworkStateContext): void {
    console.log('[OnlineState] Exiting online state');
  }

  public async handleProcessingRequest(
    context: NetworkStateContext,
    documents: DocumentUploadModel[],
    apiKey: string,
    model: string
  ): Promise<ProcessingResponse> {
    console.log(
      `[OnlineState] Processing ${documents.length} documents immediately (online)`
    );

    // In online state, we don't queue - we return a response indicating
    // the caller should process directly via DocumentController
    return {
      success: true,
      message: `Processing ${documents.length} documents online`,
      queued: false,
    };
  }
}

/**
 * OfflineState - Queues documents for later processing
 */
export class OfflineState implements NetworkAwareState {
  private localStore: LocalDocumentStore;

  constructor() {
    this.localStore = LocalDocumentStore.getInstance();
  }

  public getStateName(): NetworkStatus {
    return 'offline';
  }

  public onEnter(context: NetworkStateContext): void {
    console.log('[OfflineState] Entered offline state - queueing enabled');
  }

  public onExit(context: NetworkStateContext): void {
    console.log('[OfflineState] Exiting offline state');
  }

  public async handleProcessingRequest(
    context: NetworkStateContext,
    documents: DocumentUploadModel[],
    apiKey: string,
    model: string
  ): Promise<ProcessingResponse> {
    console.log(
      `[OfflineState] Queueing ${documents.length} documents for later processing (offline)`
    );

    try {
      // Ensure IndexedDB is initialized
      await this.localStore.initializeDB();

      // Check storage space for all files
      const totalSize = documents.reduce((sum, doc) => sum + doc.file.size, 0);
      const hasSpace = await this.localStore.hasEnoughSpace(totalSize);

      if (!hasSpace) {
        return {
          success: false,
          message:
            'Insufficient storage space. Please clear some space and try again.',
          queued: false,
        };
      }

      // Create jobs from documents
      const jobs = await DocumentJobFactory.createFromDocumentUploads(documents);

      // Add metadata for API settings
      jobs.forEach(job => {
        job.metadata = {
          ...job.metadata,
          apiModel: model,
        };
      });

      // Store jobs in IndexedDB
      await this.localStore.addJobs(jobs);

      // Notify context
      if (context.onJobsQueued) {
        context.onJobsQueued(jobs.length);
      }

      console.log(`[OfflineState] Successfully queued ${jobs.length} jobs`);

      return {
        success: true,
        message: `${documents.length} documents queued for processing. They will be processed automatically when connection is restored.`,
        queued: true,
        jobIds: jobs.map(j => j.id),
      };
    } catch (error) {
      console.error('[OfflineState] Failed to queue documents:', error);
      return {
        success: false,
        message: `Failed to queue documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queued: false,
      };
    }
  }
}

/**
 * NetworkStateContext implementation
 */
export class NetworkStateContextImpl implements NetworkStateContext {
  public currentState: NetworkAwareState;
  public networkStatus: NetworkStatus;
  public onStateChange?: (newState: NetworkAwareState) => void;
  public onJobsQueued?: (jobCount: number) => void;
  public onProcessingComplete?: (result: ProcessingResultModel) => void;

  private networkManager: NetworkStatusManager;
  private unsubscribe?: () => void;

  constructor() {
    this.networkManager = NetworkStatusManager.getInstance();
    this.networkStatus = this.networkManager.getStatus();

    // Initialize with appropriate state
    this.currentState =
      this.networkStatus === 'online' ? new OnlineState() : new OfflineState();

    // Subscribe to network status changes
    this.subscribeToNetworkChanges();

    // Call onEnter for initial state
    this.currentState.onEnter(this);
  }

  /**
   * Subscribe to network status changes
   */
  private subscribeToNetworkChanges(): void {
    this.unsubscribe = this.networkManager.subscribe({
      onStatusChange: (status: NetworkStatus) => {
        this.handleNetworkStatusChange(status);
      },
    });
  }

  /**
   * Handle network status change
   */
  private handleNetworkStatusChange(newStatus: NetworkStatus): void {
    if (newStatus === this.networkStatus) {
      return; // No change
    }

    console.log(
      `[NetworkStateContext] Network status changed: ${this.networkStatus} -> ${newStatus}`
    );

    this.networkStatus = newStatus;

    // Call onExit on current state
    this.currentState.onExit(this);

    // Transition to new state
    const newState = newStatus === 'online' ? new OnlineState() : new OfflineState();
    this.currentState = newState;

    // Call onEnter on new state
    this.currentState.onEnter(this);

    // Notify observers
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  /**
   * Transition to a specific state (manual override)
   */
  public transitionTo(newState: NetworkAwareState): void {
    if (newState.getStateName() === this.currentState.getStateName()) {
      return; // Already in this state
    }

    console.log(
      `[NetworkStateContext] Manual state transition: ${this.currentState.getStateName()} -> ${newState.getStateName()}`
    );

    this.currentState.onExit(this);
    this.currentState = newState;
    this.networkStatus = newState.getStateName();
    this.currentState.onEnter(this);

    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  /**
   * Get current network status
   */
  public getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  /**
   * Check if currently online
   */
  public isOnline(): boolean {
    return this.networkStatus === 'online';
  }

  /**
   * Check if currently offline
   */
  public isOffline(): boolean {
    return this.networkStatus === 'offline';
  }

  /**
   * Cleanup subscriptions
   */
  public cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
