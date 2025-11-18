/**
 * Simple Offline Queue for Document Processing
 *
 * Provides a lightweight offline queue that works with the existing
 * document processing flow (Files + FormData)
 */

import type { FormData as AppFormData } from '../formExtraction';

const DB_NAME = 'FilrOfflineQueue';
const DB_VERSION = 1;
const STORE_NAME = 'queued_documents';

export interface QueuedDocument {
  id: string;
  files: {
    name: string;
    type: string;
    size: number;
    data: ArrayBuffer;
  }[];
  formData: AppFormData | null;
  queuedAt: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
}

class SimpleOfflineQueue {
  private static instance: SimpleOfflineQueue | null = null;
  private db: IDBDatabase | null = null;

  private constructor() {}

  public static getInstance(): SimpleOfflineQueue {
    if (!SimpleOfflineQueue.instance) {
      SimpleOfflineQueue.instance = new SimpleOfflineQueue();
    }
    return SimpleOfflineQueue.instance;
  }

  /**
   * Initialize the database
   */
  public async initDB(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[SimpleOfflineQueue] Database initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
          });

          objectStore.createIndex('status', 'status', { unique: false });
          objectStore.createIndex('queuedAt', 'queuedAt', { unique: false });

          console.log('[SimpleOfflineQueue] Object store created');
        }
      };
    });
  }

  /**
   * Queue documents for later processing
   */
  public async queueDocuments(
    files: File[],
    formData: AppFormData | null
  ): Promise<string> {
    await this.initDB();

    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Convert files to storable format
    const fileDataPromises = files.map(async (file) => {
      const buffer = await file.arrayBuffer();
      return {
        name: file.name,
        type: file.type,
        size: file.size,
        data: buffer,
      };
    });

    const fileData = await Promise.all(fileDataPromises);

    const queuedDoc: QueuedDocument = {
      id,
      files: fileData,
      formData,
      queuedAt: Date.now(),
      status: 'queued',
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(queuedDoc);

      request.onsuccess = () => {
        console.log(`[SimpleOfflineQueue] Queued ${files.length} documents with ID: ${id}`);
        resolve(id);
      };

      request.onerror = () => {
        reject(new Error(`Failed to queue documents: ${request.error}`));
      };
    });
  }

  /**
   * Get all queued documents
   */
  public async getQueuedDocuments(): Promise<QueuedDocument[]> {
    await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('queued');

      request.onsuccess = () => {
        resolve(request.result as QueuedDocument[]);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get queued documents: ${request.error}`));
      };
    });
  }

  /**
   * Get queue count
   */
  public async getQueueCount(): Promise<number> {
    const queued = await this.getQueuedDocuments();
    return queued.length;
  }

  /**
   * Update document status
   */
  public async updateStatus(
    id: string,
    status: QueuedDocument['status'],
    error?: string
  ): Promise<void> {
    await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const doc = getRequest.result as QueuedDocument;
        if (!doc) {
          reject(new Error(`Document not found: ${id}`));
          return;
        }

        doc.status = status;
        if (error) doc.error = error;

        const updateRequest = store.put(doc);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Remove a document from queue
   */
  public async removeDocument(id: string): Promise<void> {
    await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`[SimpleOfflineQueue] Removed document: ${id}`);
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to remove document: ${request.error}`));
      };
    });
  }

  /**
   * Clear all completed/failed documents
   */
  public async clearCompleted(): Promise<number> {
    await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const docs = request.result as QueuedDocument[];
        const toDelete = docs.filter(
          (doc) => doc.status === 'completed' || doc.status === 'failed'
        );

        let deleted = 0;
        toDelete.forEach((doc) => {
          store.delete(doc.id);
          deleted++;
        });

        console.log(`[SimpleOfflineQueue] Cleared ${deleted} completed/failed documents`);
        resolve(deleted);
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear completed: ${request.error}`));
      };
    });
  }

  /**
   * Security: Clear expired documents (older than 24 hours)
   * This prevents sensitive documents from persisting too long
   */
  public async clearExpired(maxAgeHours: number = 24): Promise<number> {
    await this.initDB();

    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    const cutoffTime = Date.now() - maxAge;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const docs = request.result as QueuedDocument[];
        const toDelete = docs.filter((doc) => doc.queuedAt < cutoffTime);

        let deleted = 0;
        toDelete.forEach((doc) => {
          store.delete(doc.id);
          deleted++;
        });

        if (deleted > 0) {
          console.log(
            `[SimpleOfflineQueue] 🔒 Security: Cleared ${deleted} expired documents (older than ${maxAgeHours}h)`
          );
        }

        resolve(deleted);
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear expired: ${request.error}`));
      };
    });
  }

  /**
   * Security: Clear ALL documents from queue
   * Use this for emergency cleanup or when user logs out
   */
  public async clearAll(): Promise<number> {
    await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        const count = countRequest.result;
        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
          console.log(`[SimpleOfflineQueue] 🔒 Security: Cleared ALL ${count} documents`);
          resolve(count);
        };

        clearRequest.onerror = () => {
          reject(new Error(`Failed to clear all: ${clearRequest.error}`));
        };
      };

      countRequest.onerror = () => {
        reject(new Error(`Failed to count documents: ${countRequest.error}`));
      };
    });
  }
}

export default SimpleOfflineQueue.getInstance;
