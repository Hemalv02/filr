# Offline Processing - API Reference & Usage Guide

**Complete API documentation for developers**

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Initialization](#initialization)
3. [Controllers API](#controllers-api)
4. [Network Management API](#network-management-api)
5. [Storage API](#storage-api)
6. [Synchronization API](#synchronization-api)
7. [Notifications API](#notifications-api)
8. [Job Management API](#job-management-api)
9. [React Hooks & Components](#react-hooks--components)
10. [Type Definitions](#type-definitions)
11. [Common Use Cases](#common-use-cases)
12. [Error Handling](#error-handling)

---

## Quick Start

### 1. Basic Usage

```typescript
import {
  OfflineAwareDocumentController,
  isQueuedResponse,
  isProcessingResult
} from './controllers/OfflineAwareDocumentController';

// Process documents (automatically handles offline/online)
const result = await OfflineAwareDocumentController.processDocuments(
  documents,     // DocumentUploadModel[]
  apiKey,        // string
  model,         // string
  onProgress     // optional callback
);

// Check result type
if (isQueuedResponse(result)) {
  // User is offline - documents queued
  showNotification(result.message);
  console.log(`Queued ${result.jobIds.length} jobs`);
} else if (isProcessingResult(result)) {
  // User is online - documents processed
  showResults(result.data);
}
```

### 2. Check Network Status

```typescript
import { NetworkStatusManager } from './lib/offline';

const networkManager = NetworkStatusManager.getInstance();

if (networkManager.isOffline()) {
  alert('You are offline. Documents will be queued.');
}
```

### 3. Monitor Sync Progress

```typescript
import { SyncManager } from './lib/offline';

const syncManager = SyncManager.getInstance();

syncManager.subscribe({
  onSyncEvent: (event) => {
    console.log(`Sync event: ${event.type}`, event);
  }
});
```

---

## Initialization

### `initializeOfflineProcessing()`

Initializes the entire offline processing subsystem.

**Import:**
```typescript
import { initializeOfflineProcessing } from './lib/offline';
```

**Signature:**
```typescript
function initializeOfflineProcessing(): Promise<void>
```

**Usage:**
```typescript
// In App.tsx or main component
useEffect(() => {
  const init = async () => {
    try {
      await initializeOfflineProcessing();
      console.log('Offline processing ready');
    } catch (error) {
      console.error('Initialization failed:', error);
    }
  };

  init();
}, []);
```

**What it does:**
1. Initializes IndexedDB
2. Cleans up stuck jobs from previous session
3. Starts NetworkStatusManager
4. Initializes SyncManager
5. Checks for queued jobs and starts sync if online
6. Initializes OfflineNotifications

**When to call:**
- Once when the app starts
- In the root component (App.tsx)
- Before any document processing

---

## Controllers API

### OfflineAwareDocumentController

The main controller for processing documents with offline support.

#### `processDocuments()`

Process documents with automatic offline queueing.

**Import:**
```typescript
import { OfflineAwareDocumentController } from './controllers/OfflineAwareDocumentController';
```

**Signature:**
```typescript
static async processDocuments(
  documents: DocumentUploadModel[],
  apiKey: string,
  model: string,
  onProgress?: (event: ProgressEvent) => void
): Promise<OfflineProcessingResult>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documents` | `DocumentUploadModel[]` | Yes | Array of documents to process |
| `apiKey` | `string` | Yes | Gemini API key |
| `model` | `string` | Yes | AI model to use (e.g., "Gemini 2.0 Flash") |
| `onProgress` | `(event: ProgressEvent) => void` | No | Progress callback |

**Returns:**

```typescript
type OfflineProcessingResult = ProcessingResultModel | ProcessingResponse

// If online:
interface ProcessingResultModel {
  data: ExtractedData;
  errors: string[];
  warnings: string[];
  processingTime: number;
  filesProcessed: number;
}

// If offline:
interface ProcessingResponse {
  success: boolean;
  message: string;
  queued: boolean;
  jobIds?: string[];
}
```

**Example:**

```typescript
// Basic usage
const result = await OfflineAwareDocumentController.processDocuments(
  documents,
  apiKey,
  model
);

// With progress tracking
const result = await OfflineAwareDocumentController.processDocuments(
  documents,
  apiKey,
  model,
  (event) => {
    console.log(`${event.status}: ${event.fileName}`);
    setProgress((event.current / event.total) * 100);
  }
);

// Handle result
if ('queued' in result) {
  // Offline scenario
  if (result.success) {
    alert(`${result.jobIds.length} documents queued for processing`);
  } else {
    alert(`Failed to queue: ${result.message}`);
  }
} else {
  // Online scenario
  navigateToResults(result.data);
}
```

**Type Guards:**

```typescript
import { isQueuedResponse, isProcessingResult } from './controllers/OfflineAwareDocumentController';

if (isQueuedResponse(result)) {
  // TypeScript knows result is ProcessingResponse
  console.log(result.jobIds);
}

if (isProcessingResult(result)) {
  // TypeScript knows result is ProcessingResultModel
  console.log(result.data);
}
```

#### `isOnline()`

Check if currently online.

**Signature:**
```typescript
static isOnline(): boolean
```

**Example:**
```typescript
if (OfflineAwareDocumentController.isOnline()) {
  console.log('Processing will happen immediately');
}
```

#### `isOffline()`

Check if currently offline.

**Signature:**
```typescript
static isOffline(): boolean
```

**Example:**
```typescript
if (OfflineAwareDocumentController.isOffline()) {
  alert('You are offline. Documents will be queued.');
}
```

#### `getNetworkStatus()`

Get current network status.

**Signature:**
```typescript
static getNetworkStatus(): 'online' | 'offline'
```

**Example:**
```typescript
const status = OfflineAwareDocumentController.getNetworkStatus();
console.log(`Network status: ${status}`);
```

---

## Network Management API

### NetworkStatusManager

Monitors and broadcasts network connectivity status.

**Import:**
```typescript
import { NetworkStatusManager } from './lib/offline';
```

**Get Instance:**
```typescript
const networkManager = NetworkStatusManager.getInstance();
```

### Methods

#### `subscribe(observer)`

Subscribe to network status changes.

**Signature:**
```typescript
subscribe(observer: NetworkStatusObserver): () => void

interface NetworkStatusObserver {
  onStatusChange(status: NetworkStatus): void;
}

type NetworkStatus = 'online' | 'offline';
```

**Returns:** Unsubscribe function

**Example:**

```typescript
// Subscribe
const unsubscribe = networkManager.subscribe({
  onStatusChange: (status) => {
    if (status === 'online') {
      console.log('Connection restored!');
      setOnlineStatus(true);
    } else {
      console.log('Connection lost');
      setOnlineStatus(false);
    }
  }
});

// Cleanup
return () => unsubscribe();
```

**React Hook Example:**

```typescript
import { NetworkStatusManager } from './lib/offline';
import { useState, useEffect } from 'react';

function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const manager = NetworkStatusManager.getInstance();

    const unsubscribe = manager.subscribe({
      onStatusChange: (status) => {
        setIsOnline(status === 'online');
      }
    });

    return unsubscribe;
  }, []);

  return isOnline;
}

// Usage in component
function MyComponent() {
  const isOnline = useNetworkStatus();

  return (
    <div>
      {!isOnline && <div className="offline-banner">You are offline</div>}
    </div>
  );
}
```

#### `getStatus()`

Get current network status.

**Signature:**
```typescript
getStatus(): NetworkStatus
```

**Example:**
```typescript
const status = networkManager.getStatus();
console.log(status); // 'online' or 'offline'
```

#### `isOnline()` / `isOffline()`

Boolean checks for network status.

**Signature:**
```typescript
isOnline(): boolean
isOffline(): boolean
```

**Example:**
```typescript
if (networkManager.isOnline()) {
  processImmediately();
} else {
  queueForLater();
}
```

---

## Storage API

### LocalDocumentStore

Manages document jobs in IndexedDB.

**Import:**
```typescript
import { LocalDocumentStore } from './lib/offline';
```

**Get Instance:**
```typescript
const store = LocalDocumentStore.getInstance();
await store.initializeDB(); // Must call before use
```

### Methods

#### `initializeDB()`

Initialize the IndexedDB database.

**Signature:**
```typescript
initializeDB(): Promise<void>
```

**Example:**
```typescript
const store = LocalDocumentStore.getInstance();
await store.initializeDB();
```

**Note:** Called automatically by `initializeOfflineProcessing()`, but you can call it manually if needed.

#### `addJob(job)`

Add a single job to the queue.

**Signature:**
```typescript
addJob(job: DocumentJob): Promise<void>
```

**Example:**
```typescript
import { DocumentJobFactory } from './lib/offline';

const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
const job = await DocumentJobFactory.createFromFile(file);

await store.addJob(job);
```

#### `addJobs(jobs)`

Add multiple jobs in a single transaction.

**Signature:**
```typescript
addJobs(jobs: DocumentJob[]): Promise<void>
```

**Example:**
```typescript
const jobs = await DocumentJobFactory.createFromFiles(files);
await store.addJobs(jobs);
```

#### `getJob(id)`

Retrieve a specific job by ID.

**Signature:**
```typescript
getJob(id: string): Promise<DocumentJob | null>
```

**Example:**
```typescript
const job = await store.getJob('job-uuid-123');
if (job) {
  console.log(`Status: ${job.status}`);
}
```

#### `getQueuedJobs()`

Get all jobs with status 'queued'.

**Signature:**
```typescript
getQueuedJobs(): Promise<DocumentJob[]>
```

**Example:**
```typescript
const queuedJobs = await store.getQueuedJobs();
console.log(`${queuedJobs.length} jobs waiting to sync`);
```

#### `getJobsByStatus(status)`

Get jobs filtered by status.

**Signature:**
```typescript
getJobsByStatus(status: JobStatus): Promise<DocumentJob[]>

type JobStatus = 'queued' | 'syncing' | 'completed' | 'failed';
```

**Example:**
```typescript
const failedJobs = await store.getJobsByStatus('failed');
failedJobs.forEach(job => {
  console.log(`Failed: ${job.fileName} - ${job.errorMessage}`);
});
```

#### `getAllJobs(options)`

Get all jobs with optional filtering and sorting.

**Signature:**
```typescript
getAllJobs(options?: JobQueryOptions): Promise<DocumentJob[]>

interface JobQueryOptions {
  status?: JobStatus;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'attempts';
  sortOrder?: 'asc' | 'desc';
}
```

**Example:**
```typescript
// Get 10 most recent jobs
const recentJobs = await store.getAllJobs({
  limit: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc'
});

// Get failed jobs, newest first
const failedJobs = await store.getAllJobs({
  status: 'failed',
  sortBy: 'updatedAt',
  sortOrder: 'desc'
});

// Pagination
const page2 = await store.getAllJobs({
  limit: 20,
  offset: 20
});
```

#### `updateJobStatus(id, status, errorMessage)`

Update a job's status.

**Signature:**
```typescript
updateJobStatus(
  id: string,
  status: JobStatus,
  errorMessage?: string
): Promise<void>
```

**Example:**
```typescript
// Mark as completed
await store.updateJobStatus(jobId, 'completed');

// Mark as failed with error
await store.updateJobStatus(
  jobId,
  'failed',
  'API key invalid'
);
```

#### `updateJob(job)`

Update an entire job.

**Signature:**
```typescript
updateJob(job: DocumentJob): Promise<void>
```

**Example:**
```typescript
const job = await store.getJob(jobId);
if (job) {
  job.attempts += 1;
  job.status = 'queued';
  await store.updateJob(job);
}
```

#### `deleteJob(id)`

Delete a specific job.

**Signature:**
```typescript
deleteJob(id: string): Promise<void>
```

**Example:**
```typescript
await store.deleteJob(jobId);
console.log('Job deleted');
```

#### `deleteCompletedJobs()`

Delete all completed jobs.

**Signature:**
```typescript
deleteCompletedJobs(): Promise<number>
```

**Returns:** Number of jobs deleted

**Example:**
```typescript
const deletedCount = await store.deleteCompletedJobs();
console.log(`Cleaned up ${deletedCount} completed jobs`);
```

#### `clearAllJobs()`

Delete all jobs from the queue.

**Signature:**
```typescript
clearAllJobs(): Promise<void>
```

**Example:**
```typescript
if (confirm('Delete all queued jobs?')) {
  await store.clearAllJobs();
}
```

**⚠️ Warning:** This is destructive and cannot be undone.

#### `getStorageStats()`

Get queue statistics and storage usage.

**Signature:**
```typescript
getStorageStats(): Promise<StorageStats>

interface StorageStats {
  totalJobs: number;
  queuedJobs: number;
  syncingJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalSize: number;          // bytes
  availableSpace?: number;    // bytes (if browser supports)
}
```

**Example:**
```typescript
const stats = await store.getStorageStats();

console.log(`Total jobs: ${stats.totalJobs}`);
console.log(`Queued: ${stats.queuedJobs}`);
console.log(`Failed: ${stats.failedJobs}`);
console.log(`Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);

if (stats.availableSpace) {
  console.log(`Available: ${(stats.availableSpace / 1024 / 1024).toFixed(2)} MB`);
}
```

#### `hasEnoughSpace(fileSize)`

Check if there's enough storage for a file.

**Signature:**
```typescript
hasEnoughSpace(fileSize: number): Promise<boolean>
```

**Example:**
```typescript
const file = new File(['content'], 'large-file.pdf');

if (await store.hasEnoughSpace(file.size)) {
  // Safe to queue
  await queueDocument(file);
} else {
  alert('Insufficient storage. Please clear completed jobs.');
}
```

**Note:** Requires at least 10MB buffer beyond the file size.

#### `cleanupStuckJobs(maxAgeMinutes)`

Reset jobs stuck in 'syncing' state.

**Signature:**
```typescript
cleanupStuckJobs(maxAgeMinutes: number = 30): Promise<number>
```

**Returns:** Number of jobs cleaned up

**Example:**
```typescript
// Reset jobs stuck for more than 30 minutes
const cleaned = await store.cleanupStuckJobs(30);
console.log(`Reset ${cleaned} stuck jobs`);

// More aggressive cleanup (10 minutes)
const cleaned = await store.cleanupStuckJobs(10);
```

**When to use:**
- Automatically called on app initialization
- Manually after detecting sync issues
- After browser crash recovery

---

## Synchronization API

### SyncManager

Orchestrates synchronization of queued jobs.

**Import:**
```typescript
import { SyncManager } from './lib/offline';
```

**Get Instance:**
```typescript
const syncManager = SyncManager.getInstance(config); // config optional
```

**Configuration:**
```typescript
interface SyncConfig {
  maxRetries: number;              // Default: 3
  retryDelayMs: number;            // Default: 2000
  useExponentialBackoff: boolean;  // Default: true
  parallelSync: boolean;           // Default: false
  cleanupCompletedJobs: boolean;   // Default: true
}

// Example with custom config
const syncManager = SyncManager.getInstance({
  maxRetries: 5,
  retryDelayMs: 3000,
  useExponentialBackoff: true,
  parallelSync: false,
  cleanupCompletedJobs: true
});
```

### Methods

#### `subscribe(observer)`

Subscribe to sync events.

**Signature:**
```typescript
subscribe(observer: SyncObserver): () => void

interface SyncObserver {
  onSyncEvent(event: SyncEvent): void;
}

interface SyncEvent {
  type: SyncEventType;
  jobId?: string;
  fileName?: string;
  progress?: number;
  total?: number;
  error?: string;
  result?: ProcessingResultModel;
}

type SyncEventType =
  | 'sync_started'
  | 'job_started'
  | 'job_progress'
  | 'job_completed'
  | 'job_failed'
  | 'sync_completed'
  | 'sync_failed';
```

**Example:**

```typescript
const unsubscribe = syncManager.subscribe({
  onSyncEvent: (event) => {
    switch (event.type) {
      case 'sync_started':
        console.log(`Starting sync of ${event.total} jobs`);
        break;

      case 'job_started':
        console.log(`Processing: ${event.fileName}`);
        break;

      case 'job_progress':
        console.log(`Progress: ${event.progress}/${event.total}`);
        break;

      case 'job_completed':
        console.log(`Completed: ${event.fileName}`);
        break;

      case 'job_failed':
        console.error(`Failed: ${event.fileName} - ${event.error}`);
        break;

      case 'sync_completed':
        console.log('All jobs synced!');
        break;

      case 'sync_failed':
        console.error(`Sync failed: ${event.error}`);
        break;
    }
  }
});

// Cleanup
return () => unsubscribe();
```

**React Hook Example:**

```typescript
function useSyncProgress() {
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const manager = SyncManager.getInstance();

    const unsubscribe = manager.subscribe({
      onSyncEvent: (event) => {
        switch (event.type) {
          case 'sync_started':
            setIsSyncing(true);
            setProgress({ current: 0, total: event.total || 0 });
            break;
          case 'job_progress':
          case 'job_completed':
            setProgress({ current: event.progress || 0, total: event.total || 0 });
            break;
          case 'sync_completed':
          case 'sync_failed':
            setIsSyncing(false);
            break;
        }
      }
    });

    return unsubscribe;
  }, []);

  return { progress, isSyncing };
}

// Usage
function SyncProgress() {
  const { progress, isSyncing } = useSyncProgress();

  if (!isSyncing) return null;

  return (
    <div>
      Syncing: {progress.current} / {progress.total}
      <progress value={progress.current} max={progress.total} />
    </div>
  );
}
```

#### `startSync()`

Manually trigger synchronization.

**Signature:**
```typescript
startSync(): Promise<void>
```

**Example:**
```typescript
// Manual sync button
async function handleSyncClick() {
  const manager = SyncManager.getInstance();

  if (manager.isSyncInProgress()) {
    alert('Sync already in progress');
    return;
  }

  try {
    await manager.startSync();
    alert('Sync completed successfully');
  } catch (error) {
    alert(`Sync failed: ${error.message}`);
  }
}
```

**Behavior:**
- Idempotent (safe to call multiple times)
- Returns immediately if sync already in progress
- Requires network to be online
- Processes all queued jobs
- Retries failed jobs according to config
- Cleans up completed jobs (if configured)

#### `retryJob(jobId)`

Retry a specific failed job.

**Signature:**
```typescript
retryJob(jobId: string): Promise<boolean>
```

**Returns:** `true` if job was queued for retry

**Example:**
```typescript
// Retry button for failed job
async function handleRetry(jobId: string) {
  const manager = SyncManager.getInstance();
  const success = await manager.retryJob(jobId);

  if (success) {
    alert('Job queued for retry');
  } else {
    alert('Job not found or not in failed state');
  }
}
```

**Requirements:**
- Job must exist
- Job status must be 'failed'
- Resets job to 'queued' status
- Triggers sync if online

#### `cancelJob(jobId)`

Cancel and delete a job.

**Signature:**
```typescript
cancelJob(jobId: string): Promise<boolean>
```

**Returns:** `true` if job was cancelled

**Example:**
```typescript
async function handleCancel(jobId: string) {
  if (!confirm('Cancel this job?')) return;

  const manager = SyncManager.getInstance();
  const success = await manager.cancelJob(jobId);

  if (success) {
    alert('Job cancelled');
  } else {
    alert('Failed to cancel job');
  }
}
```

#### `isSyncInProgress()`

Check if sync is currently running.

**Signature:**
```typescript
isSyncInProgress(): boolean
```

**Example:**
```typescript
const manager = SyncManager.getInstance();

if (manager.isSyncInProgress()) {
  console.log('Sync in progress, please wait...');
}
```

#### `getQueueStats()`

Get queue statistics.

**Signature:**
```typescript
getQueueStats(): Promise<StorageStats>
```

**Example:**
```typescript
const stats = await syncManager.getQueueStats();
console.log(`${stats.queuedJobs} jobs waiting to sync`);
```

---

## Notifications API

### OfflineNotifications

Manages toast notifications for offline events.

**Import:**
```typescript
import { OfflineNotifications } from './lib/offline';
```

**Get Instance:**
```typescript
const notifications = OfflineNotifications.getInstance();
```

### Methods

#### `subscribe(observer)`

Subscribe to toast notifications.

**Signature:**
```typescript
subscribe(observer: ToastObserver): () => void

interface ToastObserver {
  onToast(toast: Toast): void;
}

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;  // milliseconds, 0 = no auto-dismiss
  timestamp: Date;
}
```

**Example:**

```typescript
const unsubscribe = notifications.subscribe({
  onToast: (toast) => {
    console.log(`[${toast.type}] ${toast.title}: ${toast.message}`);

    // Add to UI toast queue
    addToastToUI(toast);
  }
});
```

**React Hook:**

```typescript
import { useOfflineNotifications } from './lib/offline';

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useOfflineNotifications((toast) => {
    setToasts(prev => [...prev, toast]);

    // Auto-remove after duration
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, toast.duration);
    }
  });

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, removeToast };
}
```

#### `showToast(params)`

Manually show a toast notification.

**Signature:**
```typescript
showToast(params: {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
}): void
```

**Example:**
```typescript
// Custom notification
notifications.showToast({
  type: 'success',
  title: 'Upload Complete',
  message: 'Your documents have been processed',
  duration: 5000
});

// Error that doesn't auto-dismiss
notifications.showToast({
  type: 'error',
  title: 'Processing Failed',
  message: 'API key is invalid',
  duration: 0  // Manual dismiss only
});
```

**Automatic Notifications:**

The system automatically shows toasts for:
- Network offline: Warning toast
- Network online: Success toast
- Sync started: Info toast
- Sync completed: Success toast
- Sync failed: Error toast
- Job failed: Error toast

---

## Job Management API

### DocumentJobFactory

Creates DocumentJob instances from files or documents.

**Import:**
```typescript
import { DocumentJobFactory } from './lib/offline';
```

### Methods

#### `createFromFile(file)`

Create a job from a File object.

**Signature:**
```typescript
static async createFromFile(file: File): Promise<DocumentJob>
```

**Example:**
```typescript
const file = document.getElementById('upload').files[0];
const job = await DocumentJobFactory.createFromFile(file);

console.log(job);
// {
//   id: 'uuid-123',
//   fileName: 'document.pdf',
//   fileType: 'application/pdf',
//   fileData: Blob,
//   status: 'queued',
//   attempts: 0,
//   createdAt: Date,
//   updatedAt: Date,
//   metadata: { originalFileName: 'document.pdf', fileSize: 12345 }
// }
```

#### `createFromDocumentUpload(doc)`

Create a job from a DocumentUploadModel.

**Signature:**
```typescript
static async createFromDocumentUpload(
  doc: DocumentUploadModel
): Promise<DocumentJob>
```

**Example:**
```typescript
const doc: DocumentUploadModel = {
  file: file,
  type: 'birthCertificate'
};

const job = await DocumentJobFactory.createFromDocumentUpload(doc);
// Includes processorType in metadata
```

#### `createFromFiles(files)`

Create multiple jobs from an array of files.

**Signature:**
```typescript
static async createFromFiles(files: File[]): Promise<DocumentJob[]>
```

**Example:**
```typescript
const files = Array.from(document.getElementById('upload').files);
const jobs = await DocumentJobFactory.createFromFiles(files);

console.log(`Created ${jobs.length} jobs`);
```

#### `createFromDocumentUploads(docs)`

Create multiple jobs from DocumentUploadModels.

**Signature:**
```typescript
static async createFromDocumentUploads(
  docs: DocumentUploadModel[]
): Promise<DocumentJob[]>
```

**Example:**
```typescript
const jobs = await DocumentJobFactory.createFromDocumentUploads(documents);
await localStore.addJobs(jobs);
```

### DocumentJobOriginator (Memento Pattern)

Manages job state preservation for retries.

**Import:**
```typescript
import { DocumentJobOriginator } from './lib/offline';
```

**Usage:**

```typescript
const originator = new DocumentJobOriginator(job);

// Save state before risky operation
const memento = originator.createMemento();

try {
  // Attempt operation
  await processJob(job);
} catch (error) {
  // Restore previous state
  originator.restoreFromMemento(memento);
}

// Get updated job
const updatedJob = originator.getJob();
```

### JobMementoCaretaker

Manages memento history for jobs.

**Import:**
```typescript
import { JobMementoCaretaker } from './lib/offline';
```

**Usage:**

```typescript
const caretaker = new JobMementoCaretaker();

// Save memento
const memento = originator.createMemento();
caretaker.saveMemento(job.id, memento);

// Restore latest
const latestMemento = caretaker.getLatestMemento(job.id);
if (latestMemento) {
  originator.restoreFromMemento(latestMemento);
}

// Get history
const history = caretaker.getAllMementos(job.id);
console.log(`${history.length} saved states`);

// Cleanup
caretaker.clearMementos(job.id);
```

---

## React Hooks & Components

### Pre-built Components

#### QueueStatus

Displays queue status and allows job management.

**Import:**
```typescript
import { QueueStatus } from './components/QueueStatus';
```

**Usage:**
```tsx
function App() {
  return (
    <div>
      <QueueStatus />
      {/* Your app content */}
    </div>
  );
}
```

**Features:**
- Auto-refreshes every 5 seconds
- Shows queue statistics
- Displays job list with status badges
- Sync progress bar
- Retry/Cancel buttons
- Manual sync button

**Props:** None (self-contained)

#### ToastContainer

Displays toast notifications.

**Import:**
```typescript
import { ToastContainer } from './components/ToastContainer';
```

**Usage:**
```tsx
function App() {
  return (
    <>
      <ToastContainer />
      {/* Your app content */}
    </>
  );
}
```

**Features:**
- Auto-dismiss with configurable duration
- Manual dismiss button
- Animated slide-in
- Color-coded by type
- Fixed position (top-right)

**Props:** None (subscribes to OfflineNotifications automatically)

### Custom Hooks

#### useNetworkStatus

Monitor network status in React components.

```typescript
function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const manager = NetworkStatusManager.getInstance();

    const unsubscribe = manager.subscribe({
      onStatusChange: (status) => {
        setIsOnline(status === 'online');
      }
    });

    return unsubscribe;
  }, []);

  return isOnline;
}

// Usage
function MyComponent() {
  const isOnline = useNetworkStatus();

  return <div>{isOnline ? 'Online' : 'Offline'}</div>;
}
```

#### useQueueStats

Get queue statistics in React components.

```typescript
function useQueueStats() {
  const [stats, setStats] = useState<StorageStats | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      const store = LocalDocumentStore.getInstance();
      await store.initializeDB();
      const data = await store.getStorageStats();
      setStats(data);
    };

    loadStats();

    // Refresh every 5 seconds
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return stats;
}

// Usage
function StatsDisplay() {
  const stats = useQueueStats();

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <div>Queued: {stats.queuedJobs}</div>
      <div>Failed: {stats.failedJobs}</div>
    </div>
  );
}
```

#### useSyncProgress

Track sync progress in React components.

```typescript
function useSyncProgress() {
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const manager = SyncManager.getInstance();

    const unsubscribe = manager.subscribe({
      onSyncEvent: (event) => {
        switch (event.type) {
          case 'sync_started':
            setIsSyncing(true);
            setProgress({ current: 0, total: event.total || 0 });
            break;
          case 'job_started':
          case 'job_progress':
          case 'job_completed':
            setProgress({
              current: event.progress || 0,
              total: event.total || 0
            });
            break;
          case 'sync_completed':
          case 'sync_failed':
            setIsSyncing(false);
            break;
        }
      }
    });

    return unsubscribe;
  }, []);

  return { progress, isSyncing };
}

// Usage
function SyncProgressBar() {
  const { progress, isSyncing } = useSyncProgress();

  if (!isSyncing) return null;

  const percentage = (progress.current / progress.total) * 100;

  return (
    <div>
      <div>Syncing: {progress.current} / {progress.total}</div>
      <progress value={percentage} max={100} />
    </div>
  );
}
```

---

## Type Definitions

### Core Types

```typescript
// Network Status
type NetworkStatus = 'online' | 'offline';

// Job Status
type JobStatus = 'queued' | 'syncing' | 'completed' | 'failed';

// Sync Event Types
type SyncEventType =
  | 'sync_started'
  | 'job_started'
  | 'job_progress'
  | 'job_completed'
  | 'job_failed'
  | 'sync_completed'
  | 'sync_failed';

// Toast Types
type ToastType = 'info' | 'success' | 'warning' | 'error';
```

### Interfaces

```typescript
// Document Job
interface DocumentJob {
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

interface JobMetadata {
  originalFileName: string;
  fileSize: number;
  processorType?: string;
  apiModel?: string;
  priority?: number;
}

// Query Options
interface JobQueryOptions {
  status?: JobStatus;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'attempts';
  sortOrder?: 'asc' | 'desc';
}

// Storage Stats
interface StorageStats {
  totalJobs: number;
  queuedJobs: number;
  syncingJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalSize: number;
  availableSpace?: number;
}

// Sync Config
interface SyncConfig {
  maxRetries: number;
  retryDelayMs: number;
  useExponentialBackoff: boolean;
  parallelSync: boolean;
  cleanupCompletedJobs: boolean;
}

// Sync Event
interface SyncEvent {
  type: SyncEventType;
  jobId?: string;
  fileName?: string;
  progress?: number;
  total?: number;
  error?: string;
  result?: ProcessingResultModel;
}

// Toast
interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

// Processing Response
interface ProcessingResponse {
  success: boolean;
  message: string;
  queued?: boolean;
  jobIds?: string[];
  result?: ProcessingResultModel;
}

// Job Memento
interface JobMemento {
  status: JobStatus;
  attempts: number;
  errorMessage?: string;
  timestamp: Date;
}
```

### Observer Interfaces

```typescript
interface NetworkStatusObserver {
  onStatusChange(status: NetworkStatus): void;
}

interface SyncObserver {
  onSyncEvent(event: SyncEvent): void;
}

interface ToastObserver {
  onToast(toast: Toast): void;
}
```

---

## Common Use Cases

### Use Case 1: Basic Offline Processing

```typescript
import { OfflineAwareDocumentController } from './controllers/OfflineAwareDocumentController';

async function handleUpload(files: File[]) {
  const documents = files.map(file => ({
    file,
    type: 'unknown' as const
  }));

  const apiKey = localStorage.getItem('gemini_api_key');
  const model = 'Gemini 2.0 Flash';

  const result = await OfflineAwareDocumentController.processDocuments(
    documents,
    apiKey,
    model
  );

  if ('queued' in result) {
    alert(`${result.jobIds.length} documents queued for processing when online`);
  } else {
    navigateToResults(result.data);
  }
}
```

### Use Case 2: Show Network Status Banner

```typescript
import { NetworkStatusManager } from './lib/offline';
import { useState, useEffect } from 'react';

function NetworkBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const manager = NetworkStatusManager.getInstance();

    return manager.subscribe({
      onStatusChange: (status) => setIsOnline(status === 'online')
    });
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-yellow-500 text-black p-2 text-center">
      You are offline. Documents will be queued for processing.
    </div>
  );
}
```

### Use Case 3: Manual Sync Button

```typescript
import { SyncManager, NetworkStatusManager } from './lib/offline';

function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const network = NetworkStatusManager.getInstance();
    const sync = SyncManager.getInstance();

    const unsubNetwork = network.subscribe({
      onStatusChange: (status) => setIsOnline(status === 'online')
    });

    const unsubSync = sync.subscribe({
      onSyncEvent: (event) => {
        setIsSyncing(
          event.type === 'sync_started' ||
          sync.isSyncInProgress()
        );
      }
    });

    return () => {
      unsubNetwork();
      unsubSync();
    };
  }, []);

  const handleSync = async () => {
    const manager = SyncManager.getInstance();
    await manager.startSync();
  };

  return (
    <button
      onClick={handleSync}
      disabled={!isOnline || isSyncing}
    >
      {isSyncing ? 'Syncing...' : 'Sync Now'}
    </button>
  );
}
```

### Use Case 4: Job List with Retry/Cancel

```typescript
import { LocalDocumentStore, SyncManager } from './lib/offline';
import { useState, useEffect } from 'react';

function JobList() {
  const [jobs, setJobs] = useState([]);

  const loadJobs = async () => {
    const store = LocalDocumentStore.getInstance();
    await store.initializeDB();
    const allJobs = await store.getAllJobs({
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    setJobs(allJobs.filter(j => j.status !== 'completed'));
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async (jobId) => {
    const manager = SyncManager.getInstance();
    await manager.retryJob(jobId);
    loadJobs();
  };

  const handleCancel = async (jobId) => {
    const manager = SyncManager.getInstance();
    await manager.cancelJob(jobId);
    loadJobs();
  };

  return (
    <div>
      {jobs.map(job => (
        <div key={job.id} className="job-item">
          <div>{job.fileName}</div>
          <div>Status: {job.status}</div>
          {job.errorMessage && <div>Error: {job.errorMessage}</div>}

          {job.status === 'failed' && (
            <button onClick={() => handleRetry(job.id)}>Retry</button>
          )}

          {(job.status === 'queued' || job.status === 'failed') && (
            <button onClick={() => handleCancel(job.id)}>Cancel</button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Use Case 5: Storage Management

```typescript
import { LocalDocumentStore } from './lib/offline';

async function checkStorage() {
  const store = LocalDocumentStore.getInstance();
  await store.initializeDB();

  const stats = await store.getStorageStats();

  console.log(`Queue Statistics:
    Total jobs: ${stats.totalJobs}
    Queued: ${stats.queuedJobs}
    Failed: ${stats.failedJobs}
    Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB
  `);

  if (stats.availableSpace) {
    const availableMB = stats.availableSpace / 1024 / 1024;
    console.log(`Available: ${availableMB.toFixed(2)} MB`);

    if (availableMB < 100) {
      console.warn('Low storage! Cleaning up...');
      const deleted = await store.deleteCompletedJobs();
      console.log(`Deleted ${deleted} completed jobs`);
    }
  }
}
```

### Use Case 6: Pre-upload Storage Check

```typescript
import { LocalDocumentStore } from './lib/offline';

async function handleFileSelect(files: File[]) {
  const store = LocalDocumentStore.getInstance();
  await store.initializeDB();

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  if (!(await store.hasEnoughSpace(totalSize))) {
    const stats = await store.getStorageStats();

    alert(`
      Insufficient storage space!

      Required: ${(totalSize / 1024 / 1024).toFixed(2)} MB
      Available: ${((stats.availableSpace || 0) / 1024 / 1024).toFixed(2)} MB

      Please clear completed jobs or reduce file size.
    `);

    return false;
  }

  // Safe to proceed
  return true;
}
```

---

## Error Handling

### Common Errors

#### IndexedDB Errors

```typescript
try {
  const store = LocalDocumentStore.getInstance();
  await store.initializeDB();
  await store.addJob(job);
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    console.error('Storage quota exceeded');
    // Cleanup or notify user
  } else if (error.name === 'ConstraintError') {
    console.error('Job with this ID already exists');
  } else {
    console.error('Database error:', error);
  }
}
```

#### Network Errors

```typescript
import { NetworkStatusManager } from './lib/offline';

const manager = NetworkStatusManager.getInstance();

if (manager.isOffline()) {
  throw new Error('Cannot perform this action while offline');
}

// Or check before operations
async function syncIfOnline() {
  if (manager.isOffline()) {
    console.log('Offline - sync will happen automatically when online');
    return;
  }

  const sync = SyncManager.getInstance();
  await sync.startSync();
}
```

#### Sync Errors

```typescript
import { SyncManager } from './lib/offline';

const manager = SyncManager.getInstance();

manager.subscribe({
  onSyncEvent: (event) => {
    if (event.type === 'job_failed') {
      console.error(`Job failed: ${event.fileName}`);
      console.error(`Error: ${event.error}`);

      // Log for debugging
      logError({
        jobId: event.jobId,
        fileName: event.fileName,
        error: event.error,
        timestamp: new Date()
      });
    }

    if (event.type === 'sync_failed') {
      console.error('Entire sync process failed');
      // Notify user or retry
    }
  }
});
```

### Best Practices

1. **Always initialize before use:**
```typescript
const store = LocalDocumentStore.getInstance();
await store.initializeDB();
```

2. **Check network status before critical operations:**
```typescript
const manager = NetworkStatusManager.getInstance();
if (manager.isOffline()) {
  // Handle offline case
}
```

3. **Subscribe in useEffect with cleanup:**
```typescript
useEffect(() => {
  const manager = SyncManager.getInstance();
  const unsubscribe = manager.subscribe({ onSyncEvent });
  return unsubscribe;
}, []);
```

4. **Handle both online and offline results:**
```typescript
const result = await OfflineAwareDocumentController.processDocuments(...);

if ('queued' in result) {
  // Offline
} else {
  // Online
}
```

5. **Periodic cleanup:**
```typescript
useEffect(() => {
  const cleanup = async () => {
    const store = LocalDocumentStore.getInstance();
    await store.cleanupStuckJobs(30);
    await store.deleteCompletedJobs();
  };

  cleanup();
  const interval = setInterval(cleanup, 60 * 60 * 1000); // Every hour
  return () => clearInterval(interval);
}, []);
```

---

## Complete Example: Integration

```typescript
// App.tsx
import { useEffect, useState } from 'react';
import { initializeOfflineProcessing } from './lib/offline';
import { QueueStatus } from './components/QueueStatus';
import { ToastContainer } from './components/ToastContainer';
import { OfflineAwareDocumentController } from './controllers/OfflineAwareDocumentController';
import { NetworkStatusManager } from './lib/offline';

function App() {
  const [isOnline, setIsOnline] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize offline processing
  useEffect(() => {
    const init = async () => {
      try {
        await initializeOfflineProcessing();
        setIsInitialized(true);
        console.log('Offline processing ready');
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };

    init();
  }, []);

  // Monitor network status
  useEffect(() => {
    const manager = NetworkStatusManager.getInstance();

    return manager.subscribe({
      onStatusChange: (status) => {
        setIsOnline(status === 'online');
      }
    });
  }, []);

  const handleUpload = async (files: File[]) => {
    const documents = files.map(file => ({
      file,
      type: 'unknown' as const
    }));

    const apiKey = localStorage.getItem('gemini_api_key');
    const model = 'Gemini 2.0 Flash';

    const result = await OfflineAwareDocumentController.processDocuments(
      documents,
      apiKey,
      model,
      (event) => {
        console.log(`Progress: ${event.fileName} - ${event.status}`);
      }
    );

    if ('queued' in result) {
      console.log('Documents queued for later processing');
    } else {
      console.log('Processing complete:', result.data);
    }
  };

  if (!isInitialized) {
    return <div>Initializing...</div>;
  }

  return (
    <>
      <ToastContainer />

      <div className="app">
        {!isOnline && (
          <div className="offline-banner">
            You are offline. Documents will be queued.
          </div>
        )}

        <QueueStatus />

        {/* Your app content */}
      </div>
    </>
  );
}

export default App;
```

---

## Next Steps

1. **Read the implementation docs**: [OFFLINE_PROCESSING_IMPLEMENTATION.md](./OFFLINE_PROCESSING_IMPLEMENTATION.md)
2. **Try the examples**: Copy and test the code examples above
3. **Integrate into your app**: Use OfflineAwareDocumentController in your upload flow
4. **Test offline scenarios**: Use browser DevTools to simulate offline mode
5. **Monitor the queue**: Use QueueStatus component to see queued jobs

---

**For more information:**
- [Implementation Documentation](./OFFLINE_PROCESSING_IMPLEMENTATION.md)
- [Usage Guide](./OFFLINE_USAGE_GUIDE.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)

---

**Version**: 1.0
**Last Updated**: January 2025
**Status**: Production Ready
