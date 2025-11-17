/**
 * SyncManager - Orchestrates Offline Document Synchronization
 *
 * Manages the synchronization of queued documents when network becomes available.
 * Implements retry logic, error handling, and progress tracking.
 *
 * Design Patterns:
 * - Observer: Subscribes to network status changes
 * - Memento: Uses job state snapshots for retry logic
 * - Strategy: Different retry strategies (exponential backoff, fixed delay)
 */

import { DocumentController } from '../../controllers/DocumentController';
import type { ProcessingResultModel } from '../../models/DocumentModel';
import {
  DocumentJobOriginator,
  JobMementoCaretaker,
  type DocumentJob,
} from './DocumentJob';
import { LocalDocumentStore } from './LocalDocumentStore';
import { NetworkStatusManager, type NetworkStatus } from './NetworkStatusManager';

/**
 * Sync event types
 */
export type SyncEventType =
  | 'sync_started'
  | 'job_started'
  | 'job_progress'
  | 'job_completed'
  | 'job_failed'
  | 'sync_completed'
  | 'sync_failed';

/**
 * Sync event data
 */
export interface SyncEvent {
  type: SyncEventType;
  jobId?: string;
  fileName?: string;
  progress?: number;
  total?: number;
  error?: string;
  result?: ProcessingResultModel;
}

/**
 * Sync observer interface
 */
export interface SyncObserver {
  onSyncEvent(event: SyncEvent): void;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  maxRetries: number;
  retryDelayMs: number;
  useExponentialBackoff: boolean;
  parallelSync: boolean; // If false, processes jobs serially
  cleanupCompletedJobs: boolean;
}

/**
 * Default sync configuration
 */
const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxRetries: 3,
  retryDelayMs: 2000,
  useExponentialBackoff: true,
  parallelSync: false, // Serial processing to avoid rate limits
  cleanupCompletedJobs: true,
};

/**
 * SyncManager - Manages offline job synchronization
 */
export class SyncManager {
  private static instance: SyncManager | null = null;

  private localStore: LocalDocumentStore;
  private networkManager: NetworkStatusManager;
  private mementoCaretaker: JobMementoCaretaker;
  private observers: Set<SyncObserver> = new Set();
  private config: SyncConfig;

  private isSyncing = false;
  private unsubscribeNetwork?: () => void;

  private constructor(config: Partial<SyncConfig> = {}) {
    this.localStore = LocalDocumentStore.getInstance();
    this.networkManager = NetworkStatusManager.getInstance();
    this.mementoCaretaker = new JobMementoCaretaker();
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };

    // Subscribe to network status changes
    this.subscribeToNetworkChanges();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<SyncConfig>): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager(config);
    }
    return SyncManager.instance;
  }

  /**
   * Subscribe to network status changes
   */
  private subscribeToNetworkChanges(): void {
    this.unsubscribeNetwork = this.networkManager.subscribe({
      onStatusChange: (status: NetworkStatus) => {
        if (status === 'online') {
          console.log('[SyncManager] Network restored - initiating sync');
          // Delay sync by 1 second to ensure connection is stable
          setTimeout(() => {
            this.startSync();
          }, 1000);
        } else {
          console.log('[SyncManager] Network lost - sync disabled');
        }
      },
    });
  }

  /**
   * Subscribe to sync events
   */
  public subscribe(observer: SyncObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Notify observers of sync events
   */
  private notifyObservers(event: SyncEvent): void {
    this.observers.forEach(observer => {
      try {
        observer.onSyncEvent(event);
      } catch (error) {
        console.error('[SyncManager] Error notifying observer:', error);
      }
    });
  }

  /**
   * Start synchronization process
   */
  public async startSync(): Promise<void> {
    if (this.isSyncing) {
      console.log('[SyncManager] Sync already in progress, skipping');
      return;
    }

    if (!this.networkManager.isOnline()) {
      console.log('[SyncManager] Cannot sync while offline');
      return;
    }

    this.isSyncing = true;

    try {
      await this.localStore.initializeDB();

      // Cleanup stuck jobs first
      const cleanedUp = await this.localStore.cleanupStuckJobs(30);
      if (cleanedUp > 0) {
        console.log(`[SyncManager] Cleaned up ${cleanedUp} stuck jobs`);
      }

      // Get all queued jobs
      const queuedJobs = await this.localStore.getQueuedJobs();

      if (queuedJobs.length === 0) {
        console.log('[SyncManager] No queued jobs to sync');
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncManager] Starting sync for ${queuedJobs.length} queued jobs`);

      this.notifyObservers({
        type: 'sync_started',
        total: queuedJobs.length,
      });

      // Process jobs (serial or parallel based on config)
      if (this.config.parallelSync) {
        await this.syncJobsParallel(queuedJobs);
      } else {
        await this.syncJobsSerial(queuedJobs);
      }

      console.log('[SyncManager] Sync completed successfully');

      this.notifyObservers({
        type: 'sync_completed',
        total: queuedJobs.length,
      });

      // Cleanup completed jobs if configured
      if (this.config.cleanupCompletedJobs) {
        const deletedCount = await this.localStore.deleteCompletedJobs();
        console.log(`[SyncManager] Cleaned up ${deletedCount} completed jobs`);
      }
    } catch (error) {
      console.error('[SyncManager] Sync failed:', error);
      this.notifyObservers({
        type: 'sync_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync jobs serially (one at a time)
   */
  private async syncJobsSerial(jobs: DocumentJob[]): Promise<void> {
    let completed = 0;
    let failed = 0;

    for (const job of jobs) {
      const success = await this.syncJob(job, completed + 1, jobs.length);
      if (success) {
        completed++;
      } else {
        failed++;
      }
    }

    console.log(
      `[SyncManager] Serial sync complete: ${completed} succeeded, ${failed} failed`
    );
  }

  /**
   * Sync jobs in parallel (not recommended due to rate limits)
   */
  private async syncJobsParallel(jobs: DocumentJob[]): Promise<void> {
    const results = await Promise.allSettled(
      jobs.map((job, index) => this.syncJob(job, index + 1, jobs.length))
    );

    const completed = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - completed;

    console.log(
      `[SyncManager] Parallel sync complete: ${completed} succeeded, ${failed} failed`
    );
  }

  /**
   * Sync a single job with retry logic
   */
  private async syncJob(
    job: DocumentJob,
    current: number,
    total: number
  ): Promise<boolean> {
    console.log(`[SyncManager] Syncing job ${current}/${total}: ${job.fileName}`);

    this.notifyObservers({
      type: 'job_started',
      jobId: job.id,
      fileName: job.fileName,
      progress: current,
      total: total,
    });

    // Create originator for memento pattern
    const originator = new DocumentJobOriginator(job);

    // Save memento before attempting sync
    const memento = originator.createMemento();
    this.mementoCaretaker.saveMemento(job.id, memento);

    // Update job status to syncing
    await this.localStore.updateJobStatus(job.id, 'syncing');

    // Attempt to sync with retry logic
    let attempts = 0;
    let success = false;
    let lastError: string | undefined;

    while (attempts <= this.config.maxRetries && !success) {
      try {
        // Get API key and model from localStorage
        const apiKey = localStorage.getItem('gemini_api_key');
        const model = job.metadata?.apiModel || localStorage.getItem('gemini_model') || 'Gemini 2.0 Flash';

        if (!apiKey) {
          throw new Error('API key not found');
        }

        // Convert Blob back to File
        const file = new File([job.fileData], job.fileName, {
          type: job.fileType,
        });

        // Process document using DocumentController
        const result = await DocumentController.processDocuments(
          [
            {
              file: file,
              type: job.metadata?.processorType || 'unknown',
            },
          ],
          apiKey,
          model,
          (progressEvent) => {
            // Forward progress events
            this.notifyObservers({
              type: 'job_progress',
              jobId: job.id,
              fileName: job.fileName,
              progress: current,
              total: total,
            });
          }
        );

        // Success!
        success = true;
        console.log(`[SyncManager] Job ${job.id} completed successfully`);

        // Mark as completed
        await this.localStore.updateJobStatus(job.id, 'completed');

        this.notifyObservers({
          type: 'job_completed',
          jobId: job.id,
          fileName: job.fileName,
          progress: current,
          total: total,
          result: result,
        });

        return true;
      } catch (error) {
        attempts++;
        lastError = error instanceof Error ? error.message : 'Unknown error';

        console.error(
          `[SyncManager] Job ${job.id} attempt ${attempts} failed:`,
          lastError
        );

        if (attempts <= this.config.maxRetries) {
          // Calculate retry delay
          const delay = this.config.useExponentialBackoff
            ? this.config.retryDelayMs * Math.pow(2, attempts - 1)
            : this.config.retryDelayMs;

          console.log(`[SyncManager] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error(`[SyncManager] Job ${job.id} failed after ${attempts} attempts`);

    // Update job as failed
    originator.markAsFailed(lastError || 'Unknown error');
    await this.localStore.updateJob(originator.getJob());

    this.notifyObservers({
      type: 'job_failed',
      jobId: job.id,
      fileName: job.fileName,
      progress: current,
      total: total,
      error: lastError,
    });

    return false;
  }

  /**
   * Retry a specific failed job
   */
  public async retryJob(jobId: string): Promise<boolean> {
    const job = await this.localStore.getJob(jobId);

    if (!job) {
      console.error(`[SyncManager] Job not found: ${jobId}`);
      return false;
    }

    if (job.status !== 'failed') {
      console.error(`[SyncManager] Job ${jobId} is not in failed state`);
      return false;
    }

    // Reset to queued
    await this.localStore.updateJobStatus(jobId, 'queued');

    // Trigger sync
    if (this.networkManager.isOnline()) {
      await this.startSync();
    } else {
      console.log('[SyncManager] Job queued, will sync when online');
    }

    return true;
  }

  /**
   * Cancel a queued job
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    try {
      await this.localStore.deleteJob(jobId);
      this.mementoCaretaker.clearMementos(jobId);
      console.log(`[SyncManager] Job ${jobId} cancelled`);
      return true;
    } catch (error) {
      console.error(`[SyncManager] Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get sync status
   */
  public isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Get queue statistics
   */
  public async getQueueStats() {
    return this.localStore.getStorageStats();
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
    }
    this.observers.clear();
    this.mementoCaretaker.clearAll();
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (SyncManager.instance) {
      SyncManager.instance.cleanup();
      SyncManager.instance = null;
    }
  }
}

// Export singleton instance getter as default
export default SyncManager.getInstance;
