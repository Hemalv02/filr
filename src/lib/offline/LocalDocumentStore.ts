/**
 * LocalDocumentStore - Facade Pattern for IndexedDB
 *
 * Provides a clean interface for storing and retrieving DocumentJobs
 * from IndexedDB. Hides the complexity of IndexedDB operations.
 *
 * Design Patterns:
 * - Facade: Simplifies IndexedDB complexity
 * - Singleton: Single source of truth for local storage
 */

import {
  DocumentJob,
  DocumentJobSerializer,
  type JobStatus,
} from './DocumentJob';

const DB_NAME = 'FilrDB';
const DB_VERSION = 1;
const STORE_NAME = 'document_jobs';

/**
 * Query options for retrieving jobs
 */
export interface JobQueryOptions {
  status?: JobStatus;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'attempts';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalJobs: number;
  queuedJobs: number;
  syncingJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalSize: number;
  availableSpace?: number;
}

/**
 * LocalDocumentStore - Manages DocumentJobs in IndexedDB
 */
export class LocalDocumentStore {
  private static instance: LocalDocumentStore | null = null;
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): LocalDocumentStore {
    if (!LocalDocumentStore.instance) {
      LocalDocumentStore.instance = new LocalDocumentStore();
    }
    return LocalDocumentStore.instance;
  }

  /**
   * Initialize IndexedDB database
   */
  public async initializeDB(): Promise<void> {
    if (this.isInitialized && this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[LocalDocumentStore] Failed to open database:', request.error);
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('[LocalDocumentStore] Database initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
          });

          // Create indexes
          objectStore.createIndex('status', 'status', { unique: false });
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
          objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          objectStore.createIndex('attempts', 'attempts', { unique: false });

          console.log('[LocalDocumentStore] Object store and indexes created');
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeDB();
    }
  }

  /**
   * Add a new job to the store
   */
  public async addJob(job: DocumentJob): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const serializedJob = DocumentJobSerializer.serialize(job);
      const request = store.add(serializedJob);

      request.onsuccess = () => {
        console.log(`[LocalDocumentStore] Job added: ${job.id} (${job.fileName})`);
        resolve();
      };

      request.onerror = () => {
        console.error('[LocalDocumentStore] Failed to add job:', request.error);
        reject(new Error(`Failed to add job: ${request.error}`));
      };
    });
  }

  /**
   * Add multiple jobs in a single transaction
   */
  public async addJobs(jobs: DocumentJob[]): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      let completed = 0;
      const errors: Error[] = [];

      jobs.forEach(job => {
        const serializedJob = DocumentJobSerializer.serialize(job);
        const request = store.add(serializedJob);

        request.onsuccess = () => {
          completed++;
          if (completed === jobs.length) {
            if (errors.length > 0) {
              reject(new Error(`Failed to add ${errors.length} jobs`));
            } else {
              console.log(`[LocalDocumentStore] ${jobs.length} jobs added`);
              resolve();
            }
          }
        };

        request.onerror = () => {
          errors.push(new Error(`Failed to add job ${job.id}: ${request.error}`));
          completed++;
          if (completed === jobs.length) {
            reject(new Error(`Failed to add ${errors.length} jobs`));
          }
        };
      });
    });
  }

  /**
   * Get a job by ID
   */
  public async getJob(id: string): Promise<DocumentJob | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          const job = DocumentJobSerializer.deserialize(request.result);
          resolve(job);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('[LocalDocumentStore] Failed to get job:', request.error);
        reject(new Error(`Failed to get job: ${request.error}`));
      };
    });
  }

  /**
   * Update job status
   */
  public async updateJobStatus(
    id: string,
    status: JobStatus,
    errorMessage?: string
  ): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // First, get the existing job
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        if (!getRequest.result) {
          reject(new Error(`Job not found: ${id}`));
          return;
        }

        const job = DocumentJobSerializer.deserialize(getRequest.result);
        job.status = status;
        job.updatedAt = new Date();

        if (errorMessage !== undefined) {
          job.errorMessage = errorMessage;
        }

        // Update the job
        const serializedJob = DocumentJobSerializer.serialize(job);
        const putRequest = store.put(serializedJob);

        putRequest.onsuccess = () => {
          console.log(`[LocalDocumentStore] Job ${id} status updated to: ${status}`);
          resolve();
        };

        putRequest.onerror = () => {
          console.error('[LocalDocumentStore] Failed to update job:', putRequest.error);
          reject(new Error(`Failed to update job: ${putRequest.error}`));
        };
      };

      getRequest.onerror = () => {
        console.error('[LocalDocumentStore] Failed to get job for update:', getRequest.error);
        reject(new Error(`Failed to get job for update: ${getRequest.error}`));
      };
    });
  }

  /**
   * Update entire job
   */
  public async updateJob(job: DocumentJob): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const serializedJob = DocumentJobSerializer.serialize(job);
      const request = store.put(serializedJob);

      request.onsuccess = () => {
        console.log(`[LocalDocumentStore] Job updated: ${job.id}`);
        resolve();
      };

      request.onerror = () => {
        console.error('[LocalDocumentStore] Failed to update job:', request.error);
        reject(new Error(`Failed to update job: ${request.error}`));
      };
    });
  }

  /**
   * Get queued jobs (status === 'queued')
   */
  public async getQueuedJobs(): Promise<DocumentJob[]> {
    return this.getJobsByStatus('queued');
  }

  /**
   * Get jobs by status
   */
  public async getJobsByStatus(status: JobStatus): Promise<DocumentJob[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll(status);

      request.onsuccess = () => {
        const jobs = request.result.map(data =>
          DocumentJobSerializer.deserialize(data)
        );
        resolve(jobs);
      };

      request.onerror = () => {
        console.error('[LocalDocumentStore] Failed to get jobs by status:', request.error);
        reject(new Error(`Failed to get jobs by status: ${request.error}`));
      };
    });
  }

  /**
   * Get all jobs with optional filtering and sorting
   */
  public async getAllJobs(options?: JobQueryOptions): Promise<DocumentJob[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let jobs = request.result.map(data =>
          DocumentJobSerializer.deserialize(data)
        );

        // Apply filters
        if (options?.status) {
          jobs = jobs.filter(job => job.status === options.status);
        }

        // Apply sorting
        if (options?.sortBy) {
          const sortKey = options.sortBy;
          const sortOrder = options.sortOrder || 'desc';
          jobs.sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortOrder === 'asc' ? comparison : -comparison;
          });
        }

        // Apply offset and limit
        if (options?.offset !== undefined) {
          jobs = jobs.slice(options.offset);
        }
        if (options?.limit !== undefined) {
          jobs = jobs.slice(0, options.limit);
        }

        resolve(jobs);
      };

      request.onerror = () => {
        console.error('[LocalDocumentStore] Failed to get all jobs:', request.error);
        reject(new Error(`Failed to get all jobs: ${request.error}`));
      };
    });
  }

  /**
   * Delete a job by ID
   */
  public async deleteJob(id: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`[LocalDocumentStore] Job deleted: ${id}`);
        resolve();
      };

      request.onerror = () => {
        console.error('[LocalDocumentStore] Failed to delete job:', request.error);
        reject(new Error(`Failed to delete job: ${request.error}`));
      };
    });
  }

  /**
   * Delete all completed jobs
   */
  public async deleteCompletedJobs(): Promise<number> {
    const completedJobs = await this.getJobsByStatus('completed');
    let deletedCount = 0;

    for (const job of completedJobs) {
      try {
        await this.deleteJob(job.id);
        deletedCount++;
      } catch (error) {
        console.error(`[LocalDocumentStore] Failed to delete job ${job.id}:`, error);
      }
    }

    console.log(`[LocalDocumentStore] Deleted ${deletedCount} completed jobs`);
    return deletedCount;
  }

  /**
   * Clear all jobs from the store
   */
  public async clearAllJobs(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[LocalDocumentStore] All jobs cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('[LocalDocumentStore] Failed to clear jobs:', request.error);
        reject(new Error(`Failed to clear jobs: ${request.error}`));
      };
    });
  }

  /**
   * Get storage statistics
   */
  public async getStorageStats(): Promise<StorageStats> {
    await this.ensureInitialized();

    const allJobs = await this.getAllJobs();

    const stats: StorageStats = {
      totalJobs: allJobs.length,
      queuedJobs: allJobs.filter(j => j.status === 'queued').length,
      syncingJobs: allJobs.filter(j => j.status === 'syncing').length,
      completedJobs: allJobs.filter(j => j.status === 'completed').length,
      failedJobs: allJobs.filter(j => j.status === 'failed').length,
      totalSize: allJobs.reduce((sum, job) => sum + job.fileData.size, 0),
    };

    // Try to get available storage space
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.usage) {
          stats.availableSpace = estimate.quota - estimate.usage;
        }
      } catch (error) {
        console.warn('[LocalDocumentStore] Could not estimate storage:', error);
      }
    }

    return stats;
  }

  /**
   * Check if there's enough storage space for a file
   */
  public async hasEnoughSpace(fileSize: number): Promise<boolean> {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) {
      // If we can't check, assume there's space
      return true;
    }

    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota && estimate.usage) {
        const availableSpace = estimate.quota - estimate.usage;
        // Require at least 10MB buffer
        const requiredSpace = fileSize + 10 * 1024 * 1024;
        return availableSpace >= requiredSpace;
      }
    } catch (error) {
      console.warn('[LocalDocumentStore] Could not check storage:', error);
    }

    return true;
  }

  /**
   * Cleanup stuck jobs (jobs in 'syncing' state for too long)
   */
  public async cleanupStuckJobs(maxAgeMinutes: number = 30): Promise<number> {
    await this.ensureInitialized();

    const syncingJobs = await this.getJobsByStatus('syncing');
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    let cleanedCount = 0;

    for (const job of syncingJobs) {
      if (job.updatedAt < cutoffTime) {
        // Reset to queued for retry
        await this.updateJobStatus(
          job.id,
          'queued',
          'Job was stuck in syncing state and has been reset'
        );
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(
        `[LocalDocumentStore] Cleaned up ${cleanedCount} stuck jobs (older than ${maxAgeMinutes} minutes)`
      );
    }

    return cleanedCount;
  }

  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('[LocalDocumentStore] Database connection closed');
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (LocalDocumentStore.instance) {
      LocalDocumentStore.instance.close();
      LocalDocumentStore.instance = null;
    }
  }
}

// Export singleton instance getter as default
export default LocalDocumentStore.getInstance;
