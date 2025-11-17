/**
 * DocumentJob - Memento Pattern Implementation
 *
 * Represents a document processing job that can be queued, synced, and retried.
 * Implements Memento pattern for state preservation and restoration.
 *
 * Design Patterns:
 * - Memento: Can save and restore job state for retry logic
 */

import type { DocumentUploadModel } from '../../models/DocumentModel';

export type JobStatus = 'queued' | 'syncing' | 'completed' | 'failed';

/**
 * Core DocumentJob interface
 */
export interface DocumentJob {
  id: string;
  fileName: string;
  fileType: string;
  fileData: Blob;
  status: JobStatus;
  attempts: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: JobMetadata;
}

/**
 * Optional metadata for job tracking
 */
export interface JobMetadata {
  originalFileName: string;
  fileSize: number;
  processorType?: string;
  apiModel?: string;
  priority?: number;
}

/**
 * Memento: Stores the state of a DocumentJob
 */
export interface JobMemento {
  status: JobStatus;
  attempts: number;
  errorMessage?: string;
  timestamp: Date;
}

/**
 * DocumentJobOriginator - Creates and manages DocumentJob state
 * Implements Memento pattern for state preservation
 */
export class DocumentJobOriginator {
  private job: DocumentJob;

  constructor(job: DocumentJob) {
    this.job = { ...job };
  }

  /**
   * Create a memento of the current job state
   */
  public createMemento(): JobMemento {
    return {
      status: this.job.status,
      attempts: this.job.attempts,
      errorMessage: this.job.errorMessage,
      timestamp: new Date(),
    };
  }

  /**
   * Restore job state from a memento
   */
  public restoreFromMemento(memento: JobMemento): void {
    this.job.status = memento.status;
    this.job.attempts = memento.attempts;
    this.job.errorMessage = memento.errorMessage;
    this.job.updatedAt = new Date();
  }

  /**
   * Get the current job
   */
  public getJob(): DocumentJob {
    return { ...this.job };
  }

  /**
   * Update job status
   */
  public updateStatus(status: JobStatus, errorMessage?: string): void {
    this.job.status = status;
    this.job.errorMessage = errorMessage;
    this.job.updatedAt = new Date();
  }

  /**
   * Increment attempt counter
   */
  public incrementAttempts(): void {
    this.job.attempts += 1;
    this.job.updatedAt = new Date();
  }

  /**
   * Mark job as failed
   */
  public markAsFailed(errorMessage: string): void {
    this.job.status = 'failed';
    this.job.errorMessage = errorMessage;
    this.job.updatedAt = new Date();
  }

  /**
   * Mark job as completed
   */
  public markAsCompleted(): void {
    this.job.status = 'completed';
    this.job.errorMessage = undefined;
    this.job.updatedAt = new Date();
  }

  /**
   * Reset job to queued state (for retry)
   */
  public resetToQueued(): void {
    this.job.status = 'queued';
    this.job.errorMessage = undefined;
    this.job.updatedAt = new Date();
  }
}

/**
 * JobMementoCaretaker - Manages mementos for job history
 */
export class JobMementoCaretaker {
  private mementos: Map<string, JobMemento[]> = new Map();

  /**
   * Save a memento for a job
   */
  public saveMemento(jobId: string, memento: JobMemento): void {
    if (!this.mementos.has(jobId)) {
      this.mementos.set(jobId, []);
    }
    this.mementos.get(jobId)!.push(memento);
  }

  /**
   * Get the most recent memento for a job
   */
  public getLatestMemento(jobId: string): JobMemento | null {
    const jobMementos = this.mementos.get(jobId);
    if (!jobMementos || jobMementos.length === 0) {
      return null;
    }
    return jobMementos[jobMementos.length - 1];
  }

  /**
   * Get all mementos for a job
   */
  public getAllMementos(jobId: string): JobMemento[] {
    return this.mementos.get(jobId) || [];
  }

  /**
   * Clear mementos for a job
   */
  public clearMementos(jobId: string): void {
    this.mementos.delete(jobId);
  }

  /**
   * Clear all mementos
   */
  public clearAll(): void {
    this.mementos.clear();
  }
}

/**
 * Factory for creating DocumentJobs from uploaded files
 */
export class DocumentJobFactory {
  /**
   * Create a DocumentJob from a File object
   */
  public static async createFromFile(file: File): Promise<DocumentJob> {
    return {
      id: this.generateUUID(),
      fileName: file.name,
      fileType: file.type,
      fileData: file,
      status: 'queued',
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        originalFileName: file.name,
        fileSize: file.size,
      },
    };
  }

  /**
   * Create a DocumentJob from a DocumentUploadModel
   */
  public static async createFromDocumentUpload(
    doc: DocumentUploadModel
  ): Promise<DocumentJob> {
    return {
      id: this.generateUUID(),
      fileName: doc.file.name,
      fileType: doc.file.type,
      fileData: doc.file,
      status: 'queued',
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        originalFileName: doc.file.name,
        fileSize: doc.file.size,
        processorType: doc.type,
      },
    };
  }

  /**
   * Create multiple jobs from files
   */
  public static async createFromFiles(files: File[]): Promise<DocumentJob[]> {
    return Promise.all(files.map(file => this.createFromFile(file)));
  }

  /**
   * Create multiple jobs from DocumentUploadModels
   */
  public static async createFromDocumentUploads(
    docs: DocumentUploadModel[]
  ): Promise<DocumentJob[]> {
    return Promise.all(docs.map(doc => this.createFromDocumentUpload(doc)));
  }

  /**
   * Generate a UUID for job IDs
   */
  private static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/**
 * Utility for serializing/deserializing jobs to/from IndexedDB
 */
export class DocumentJobSerializer {
  /**
   * Prepare job for storage (convert dates to strings)
   */
  public static serialize(job: DocumentJob): any {
    return {
      ...job,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      // fileData (Blob) is stored as-is by IndexedDB
    };
  }

  /**
   * Restore job from storage (convert strings to dates)
   */
  public static deserialize(data: any): DocumentJob {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  /**
   * Convert job to a plain object (for debugging)
   */
  public static toPlainObject(job: DocumentJob): any {
    return {
      ...job,
      fileData: `[Blob: ${job.fileType}, ${(job.fileData.size / 1024).toFixed(2)}KB]`,
    };
  }
}
