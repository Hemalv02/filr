# Offline Processing and Synchronization - Implementation Documentation

## Executive Summary

This document provides comprehensive documentation for the **Offline Processing and Synchronization** feature implemented in the Filr browser extension. This feature enables users to queue document processing requests when offline and automatically synchronizes them when the connection is restored.

**Status**: ✅ **IMPLEMENTED AND INTEGRATED**

**Implementation Date**: January 2025

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Design Patterns Used](#design-patterns-used)
3. [Component Reference](#component-reference)
4. [Integration Guide](#integration-guide)
5. [API Documentation](#api-documentation)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [Future Enhancements](#future-enhancements)

---

## Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │ QueueStatus  │  │ ToastContainer│  │  App Components    │  │
│  │  Component   │  │   Component   │  │  (Upload, Results) │  │
│  └──────────────┘  └───────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CONTROLLER LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      OfflineAwareDocumentController (NEW)                │  │
│  │  Wraps DocumentController with offline capabilities      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       PROXY LAYER                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             ProcessingProxy (Singleton)                   │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │         NetworkStateContext (State Pattern)        │  │  │
│  │  │  ┌──────────────┐        ┌──────────────┐         │  │  │
│  │  │  │ OnlineState  │        │ OfflineState │         │  │  │
│  │  │  └──────────────┘        └──────────────┘         │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                                      │
          │ Online                               │ Offline
          ↓                                      ↓
┌──────────────────────┐            ┌───────────────────────────┐
│ DocumentController   │            │  LocalDocumentStore       │
│ (Immediate Process)  │            │  (Queue in IndexedDB)     │
└──────────────────────┘            └───────────────────────────┘
                                                 │
                                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SYNCHRONIZATION LAYER                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                SyncManager (Singleton)                    │  │
│  │  • Monitors NetworkStatusManager                         │  │
│  │  • Processes queued jobs when online                     │  │
│  │  • Implements retry logic with Memento pattern           │  │
│  │  • Notifies observers of sync progress                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           OfflineNotifications (Singleton)                │  │
│  │  • Subscribes to network changes                         │  │
│  │  • Subscribes to sync events                             │  │
│  │  • Publishes Toast notifications to UI                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       STORAGE LAYER                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │   IndexedDB    │  │  DocumentJob   │  │  JobMemento      │ │
│  │  (FilrDB)      │  │   (Originator) │  │  (Caretaker)     │ │
│  └────────────────┘  └────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         NetworkStatusManager (Singleton + Observer)       │  │
│  │  • Monitors browser online/offline events                │  │
│  │  • Notifies all subscribers of status changes            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow Diagrams

#### Online Request Flow

```
User Uploads Document
        ↓
OfflineAwareDocumentController.processDocuments()
        ↓
ProcessingProxy.processDocuments()
        ↓
NetworkStateContext.currentState = OnlineState
        ↓
OnlineState.handleProcessingRequest()
        ↓
Returns { queued: false }
        ↓
ProcessingProxy delegates to DocumentController
        ↓
DocumentController processes immediately
        ↓
Returns ProcessingResultModel
        ↓
User sees results
```

#### Offline Request Flow

```
User Uploads Document (Offline)
        ↓
OfflineAwareDocumentController.processDocuments()
        ↓
ProcessingProxy.processDocuments()
        ↓
NetworkStateContext.currentState = OfflineState
        ↓
OfflineState.handleProcessingRequest()
        ↓
LocalDocumentStore.addJobs()
        ↓
Jobs saved to IndexedDB
        ↓
Returns { queued: true, jobIds: [...] }
        ↓
User sees "Documents queued" toast
```

#### Sync Flow (When Reconnected)

```
Browser Detects Network Online
        ↓
NetworkStatusManager.handleOnline()
        ↓
Notifies all subscribers
        ↓
SyncManager receives notification
        ↓
SyncManager.startSync()
        ↓
LocalDocumentStore.getQueuedJobs()
        ↓
For each job:
    │
    ├─ Create JobMemento (snapshot state)
    ├─ Update status to 'syncing'
    ├─ Convert Blob to File
    ├─ Call DocumentController.processDocuments()
    ├─ On Success:
    │   ├─ Update status to 'completed'
    │   └─ Notify observers
    └─ On Failure:
        ├─ Retry with exponential backoff (max 3 attempts)
        ├─ If all retries fail:
        │   ├─ Update status to 'failed'
        │   └─ Save error message
        └─ Notify observers
        ↓
Cleanup completed jobs (if configured)
        ↓
User sees "Sync completed" toast
```

---

## Design Patterns Used

### 1. **Singleton Pattern**

**Files**:
- `NetworkStatusManager.ts`
- `LocalDocumentStore.ts`
- `SyncManager.ts`
- `ProcessingProxySingleton`
- `OfflineNotifications.ts`

**Purpose**: Ensure only one instance of critical services exists throughout the application lifecycle.

**Example**:
```typescript
// NetworkStatusManager
private static instance: NetworkStatusManager | null = null;

public static getInstance(): NetworkStatusManager {
  if (!NetworkStatusManager.instance) {
    NetworkStatusManager.instance = new NetworkStatusManager();
  }
  return NetworkStatusManager.instance;
}
```

### 2. **Observer Pattern**

**Files**:
- `NetworkStatusManager.ts` (publishes network status changes)
- `SyncManager.ts` (publishes sync events)
- `OfflineNotifications.ts` (publishes toast notifications)

**Purpose**: Decouple components by allowing them to subscribe to events without tight coupling.

**Example**:
```typescript
// NetworkStatusManager
private observers: Set<NetworkStatusObserver> = new Set();

public subscribe(observer: NetworkStatusObserver): () => void {
  this.observers.add(observer);
  observer.onStatusChange(this.currentStatus); // Immediate notification
  return () => this.observers.delete(observer); // Unsubscribe function
}

private notifyObservers(): void {
  this.observers.forEach(observer => {
    observer.onStatusChange(this.currentStatus);
  });
}
```

### 3. **State Pattern**

**Files**:
- `NetworkAwareState.ts`

**Purpose**: Change application behavior based on network connectivity without conditional logic scattered everywhere.

**States**:
- `OnlineState`: Processes documents immediately
- `OfflineState`: Queues documents in IndexedDB

**Example**:
```typescript
interface NetworkAwareState {
  handleProcessingRequest(
    context: NetworkStateContext,
    documents: DocumentUploadModel[],
    apiKey: string,
    model: string
  ): Promise<ProcessingResponse>;

  onEnter(context: NetworkStateContext): void;
  onExit(context: NetworkStateContext): void;
}

class OnlineState implements NetworkAwareState {
  async handleProcessingRequest(...) {
    // Delegate to real controller for immediate processing
    return { success: true, queued: false };
  }
}

class OfflineState implements NetworkAwareState {
  async handleProcessingRequest(...) {
    // Queue documents in IndexedDB
    await localStore.addJobs(jobs);
    return { success: true, queued: true, jobIds: [...] };
  }
}
```

### 4. **Proxy Pattern**

**Files**:
- `ProcessingProxy.ts`

**Purpose**: Provide a surrogate for DocumentController that intelligently routes requests based on network status.

**Example**:
```typescript
class ProcessingProxy implements IDocumentProcessor {
  async processDocuments(...) {
    // Delegate to current state (online/offline)
    const response = await this.networkContext.currentState.handleProcessingRequest(...);

    if (response.queued) {
      return response; // Queued offline
    } else {
      // Process online via real controller
      return await this.realController.processDocuments(...);
    }
  }
}
```

### 5. **Memento Pattern**

**Files**:
- `DocumentJob.ts`

**Purpose**: Preserve and restore job state for retry logic, especially when sync fails.

**Components**:
- **Originator**: `DocumentJobOriginator`
- **Memento**: `JobMemento`
- **Caretaker**: `JobMementoCaretaker`

**Example**:
```typescript
// Save state before sync attempt
const originator = new DocumentJobOriginator(job);
const memento = originator.createMemento();
caretaker.saveMemento(job.id, memento);

// ... attempt sync ...

// Restore state on failure
originator.restoreFromMemento(memento);
```

### 6. **Facade Pattern**

**Files**:
- `LocalDocumentStore.ts`

**Purpose**: Simplify IndexedDB complexity with a clean, easy-to-use interface.

**Example**:
```typescript
class LocalDocumentStore {
  async addJob(job: DocumentJob): Promise<void> {
    // Hides complexity of IndexedDB transactions
    const transaction = this.db.transaction(['document_jobs'], 'readwrite');
    const store = transaction.objectStore('document_jobs');
    // ... complex IndexedDB code ...
  }

  async getQueuedJobs(): Promise<DocumentJob[]> {
    // Simple interface, complex implementation
  }
}
```

### 7. **Factory Pattern**

**Files**:
- `DocumentJob.ts` (`DocumentJobFactory`)

**Purpose**: Create DocumentJob instances from various sources (File, DocumentUploadModel).

**Example**:
```typescript
class DocumentJobFactory {
  static async createFromFile(file: File): Promise<DocumentJob> {
    return {
      id: this.generateUUID(),
      fileName: file.name,
      fileData: file,
      status: 'queued',
      // ...
    };
  }

  static async createFromDocumentUploads(docs: DocumentUploadModel[]): Promise<DocumentJob[]> {
    return Promise.all(docs.map(doc => this.createFromDocumentUpload(doc)));
  }
}
```

---

## Component Reference

### Core Components

#### 1. NetworkStatusManager

**Location**: `src/lib/offline/NetworkStatusManager.ts`

**Responsibility**: Monitor browser online/offline status and notify subscribers.

**Key Methods**:
```typescript
getInstance(): NetworkStatusManager
subscribe(observer: NetworkStatusObserver): () => void
getStatus(): NetworkStatus
isOnline(): boolean
isOffline(): boolean
```

**Usage**:
```typescript
const networkManager = NetworkStatusManager.getInstance();

const unsubscribe = networkManager.subscribe({
  onStatusChange: (status) => {
    console.log(`Network is now: ${status}`);
  }
});

// Later cleanup
unsubscribe();
```

---

#### 2. LocalDocumentStore

**Location**: `src/lib/offline/LocalDocumentStore.ts`

**Responsibility**: Manage DocumentJobs in IndexedDB with a clean API.

**Key Methods**:
```typescript
getInstance(): LocalDocumentStore
initializeDB(): Promise<void>
addJob(job: DocumentJob): Promise<void>
addJobs(jobs: DocumentJob[]): Promise<void>
getJob(id: string): Promise<DocumentJob | null>
getQueuedJobs(): Promise<DocumentJob[]>
updateJobStatus(id: string, status: JobStatus, errorMessage?: string): Promise<void>
getStorageStats(): Promise<StorageStats>
cleanupStuckJobs(maxAgeMinutes: number): Promise<number>
```

**IndexedDB Schema**:
```typescript
Database: FilrDB
Version: 1

ObjectStore: document_jobs
  Key: id (string, UUID)
  Indexes:
    - status (for fast querying)
    - createdAt
    - updatedAt
    - attempts

Data Structure:
{
  id: string,
  fileName: string,
  fileType: string,
  fileData: Blob,
  status: 'queued' | 'syncing' | 'completed' | 'failed',
  attempts: number,
  errorMessage?: string,
  createdAt: Date (ISO string in DB),
  updatedAt: Date (ISO string in DB),
  metadata?: {
    originalFileName: string,
    fileSize: number,
    processorType?: string,
    apiModel?: string
  }
}
```

---

#### 3. ProcessingProxy

**Location**: `src/lib/offline/ProcessingProxy.ts`

**Responsibility**: Intercept processing requests and route based on network status.

**Key Methods**:
```typescript
getInstance(): ProcessingProxy (singleton)
processDocuments(...): Promise<ProcessingResultModel | ProcessingResponse>
isOnline(): boolean
getNetworkStatus(): 'online' | 'offline'
```

**Usage**:
```typescript
const proxy = ProcessingProxySingleton.getInstance();

const result = await proxy.processDocuments(documents, apiKey, model, onProgress);

if ('queued' in result) {
  // Offline - documents queued
  console.log(`Queued ${result.jobIds.length} jobs`);
} else {
  // Online - immediate processing
  console.log(`Processed ${result.filesProcessed} files`);
}
```

---

#### 4. SyncManager

**Location**: `src/lib/offline/SyncManager.ts`

**Responsibility**: Orchestrate synchronization of queued jobs when network is restored.

**Key Methods**:
```typescript
getInstance(config?: Partial<SyncConfig>): SyncManager
startSync(): Promise<void>
retryJob(jobId: string): Promise<boolean>
cancelJob(jobId: string): Promise<boolean>
subscribe(observer: SyncObserver): () => void
isSyncInProgress(): boolean
getQueueStats(): Promise<StorageStats>
```

**Configuration**:
```typescript
interface SyncConfig {
  maxRetries: number;              // Default: 3
  retryDelayMs: number;            // Default: 2000
  useExponentialBackoff: boolean;  // Default: true
  parallelSync: boolean;           // Default: false (serial to avoid rate limits)
  cleanupCompletedJobs: boolean;   // Default: true
}
```

**Sync Events**:
```typescript
type SyncEventType =
  | 'sync_started'      // Sync process started
  | 'job_started'       // Individual job processing started
  | 'job_progress'      // Progress update for job
  | 'job_completed'     // Job completed successfully
  | 'job_failed'        // Job failed after retries
  | 'sync_completed'    // All jobs synced
  | 'sync_failed';      // Sync process failed

interface SyncEvent {
  type: SyncEventType;
  jobId?: string;
  fileName?: string;
  progress?: number;
  total?: number;
  error?: string;
}
```

---

#### 5. OfflineNotifications

**Location**: `src/lib/offline/OfflineNotifications.ts`

**Responsibility**: Provide user feedback for offline events via toasts.

**Key Methods**:
```typescript
getInstance(): OfflineNotifications
subscribe(observer: ToastObserver): () => void
showToast(params: { type, title, message, duration? }): void
```

**Toast Types**:
- `info`: Informational messages (blue)
- `success`: Success messages (green)
- `warning`: Warnings (yellow)
- `error`: Errors (red)

**Automatic Notifications**:
- "You are offline" when network is lost
- "Connection restored" when network is back
- "Syncing X documents" when sync starts
- "Sync completed" when sync finishes
- Individual job failures

---

### UI Components

#### 1. QueueStatus

**Location**: `src/components/QueueStatus.tsx`

**Responsibility**: Display queued jobs and allow user management (retry/cancel).

**Features**:
- Shows queue statistics (total, queued, failed)
- Lists all active jobs with status badges
- Real-time sync progress bar
- Retry button for failed jobs
- Cancel button for queued/failed jobs
- Manual sync button when online

**Auto-refresh**: Every 5 seconds

---

#### 2. ToastContainer

**Location**: `src/components/ToastContainer.tsx`

**Responsibility**: Display toast notifications from OfflineNotifications.

**Features**:
- Auto-dismiss with configurable duration
- Manual dismiss button
- Animated slide-in from right
- Different colors per type
- Stacks multiple toasts
- Fixed position (top-right)

---

### Controllers

#### OfflineAwareDocumentController

**Location**: `src/controllers/OfflineAwareDocumentController.ts`

**Responsibility**: Wrapper for DocumentController with offline capabilities.

**Key Methods**:
```typescript
static async processDocuments(
  documents: DocumentUploadModel[],
  apiKey: string,
  model: string,
  onProgress?: (event: any) => void
): Promise<OfflineProcessingResult>

static isOnline(): boolean
static getNetworkStatus(): 'online' | 'offline'
```

**Return Type**:
```typescript
type OfflineProcessingResult = ProcessingResultModel | ProcessingResponse;

// Check result type:
if (isQueuedResponse(result)) {
  // Offline - queued
} else if (isProcessingResult(result)) {
  // Online - processed
}
```

---

## Integration Guide

### Step 1: Initialize Offline Processing

Add initialization in your main App component:

```typescript
// src/App.tsx

import { initializeOfflineProcessing } from './lib/offline';

useEffect(() => {
  const initOffline = async () => {
    try {
      await initializeOfflineProcessing();
      console.log('[App] Offline processing initialized');
    } catch (error) {
      console.error('[App] Failed to initialize offline processing:', error);
    }
  };

  initOffline();
}, []);
```

### Step 2: Add UI Components

```typescript
// src/App.tsx

import { QueueStatus } from './components/QueueStatus';
import { ToastContainer } from './components/ToastContainer';

return (
  <>
    <ToastContainer />
    <div className="app-container">
      <QueueStatus />
      {/* Your app content */}
    </div>
  </>
);
```

### Step 3: Use OfflineAwareDocumentController

#### Option A: Replace DocumentController calls

```typescript
// Before:
import { DocumentController } from './controllers/DocumentController';
const result = await DocumentController.processDocuments(docs, apiKey, model);

// After:
import { OfflineAwareDocumentController, isQueuedResponse } from './controllers/OfflineAwareDocumentController';

const result = await OfflineAwareDocumentController.processDocuments(
  docs,
  apiKey,
  model,
  onProgress
);

if (isQueuedResponse(result)) {
  // Documents queued - show message to user
  console.log(`${result.message}`);
  // Don't navigate to results - stay on upload page
} else {
  // Documents processed - show results
  onProcessComplete(result.data);
}
```

#### Option B: Use ProcessingProxy directly

```typescript
import { ProcessingProxySingleton } from './lib/offline/ProcessingProxy';

const proxy = ProcessingProxySingleton.getInstance();
const result = await proxy.processDocuments(docs, apiKey, model, onProgress);

if ('queued' in result) {
  // Queued
} else {
  // Processed
}
```

### Step 4: Handle Offline State in UI

```typescript
import { NetworkStatusManager } from './lib/offline/NetworkStatusManager';

const [isOnline, setIsOnline] = useState(true);

useEffect(() => {
  const networkManager = NetworkStatusManager.getInstance();

  const unsubscribe = networkManager.subscribe({
    onStatusChange: (status) => {
      setIsOnline(status === 'online');
    }
  });

  return unsubscribe;
}, []);

// In render:
{!isOnline && (
  <div className="offline-banner">
    You are offline. Documents will be queued for processing.
  </div>
)}
```

---

## API Documentation

### Complete API Reference

#### NetworkStatusManager

```typescript
class NetworkStatusManager {
  static getInstance(): NetworkStatusManager;

  subscribe(observer: NetworkStatusObserver): () => void;
  unsubscribe(observer: NetworkStatusObserver): void;
  getStatus(): NetworkStatus; // 'online' | 'offline'
  isOnline(): boolean;
  isOffline(): boolean;
  cleanup(): void;
  static resetInstance(): void; // For testing
}

interface NetworkStatusObserver {
  onStatusChange(status: NetworkStatus): void;
}
```

#### LocalDocumentStore

```typescript
class LocalDocumentStore {
  static getInstance(): LocalDocumentStore;

  initializeDB(): Promise<void>;
  addJob(job: DocumentJob): Promise<void>;
  addJobs(jobs: DocumentJob[]): Promise<void>;
  getJob(id: string): Promise<DocumentJob | null>;
  updateJobStatus(id: string, status: JobStatus, errorMessage?: string): Promise<void>;
  updateJob(job: DocumentJob): Promise<void>;
  getQueuedJobs(): Promise<DocumentJob[]>;
  getJobsByStatus(status: JobStatus): Promise<DocumentJob[]>;
  getAllJobs(options?: JobQueryOptions): Promise<DocumentJob[]>;
  deleteJob(id: string): Promise<void>;
  deleteCompletedJobs(): Promise<number>;
  clearAllJobs(): Promise<void>;
  getStorageStats(): Promise<StorageStats>;
  hasEnoughSpace(fileSize: number): Promise<boolean>;
  cleanupStuckJobs(maxAgeMinutes: number): Promise<number>;
  close(): void;
  static resetInstance(): void;
}

interface JobQueryOptions {
  status?: JobStatus;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'attempts';
  sortOrder?: 'asc' | 'desc';
}

interface StorageStats {
  totalJobs: number;
  queuedJobs: number;
  syncingJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalSize: number;
  availableSpace?: number;
}
```

#### DocumentJob & Related

```typescript
interface DocumentJob {
  id: string;
  fileName: string;
  fileType: string;
  fileData: Blob;
  status: 'queued' | 'syncing' | 'completed' | 'failed';
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

class DocumentJobFactory {
  static async createFromFile(file: File): Promise<DocumentJob>;
  static async createFromDocumentUpload(doc: DocumentUploadModel): Promise<DocumentJob>;
  static async createFromFiles(files: File[]): Promise<DocumentJob[]>;
  static async createFromDocumentUploads(docs: DocumentUploadModel[]): Promise<DocumentJob[]>;
}

class DocumentJobOriginator {
  constructor(job: DocumentJob);
  createMemento(): JobMemento;
  restoreFromMemento(memento: JobMemento): void;
  getJob(): DocumentJob;
  updateStatus(status: JobStatus, errorMessage?: string): void;
  incrementAttempts(): void;
  markAsFailed(errorMessage: string): void;
  markAsCompleted(): void;
  resetToQueued(): void;
}

interface JobMemento {
  status: JobStatus;
  attempts: number;
  errorMessage?: string;
  timestamp: Date;
}

class JobMementoCaretaker {
  saveMemento(jobId: string, memento: JobMemento): void;
  getLatestMemento(jobId: string): JobMemento | null;
  getAllMementos(jobId: string): JobMemento[];
  clearMementos(jobId: string): void;
  clearAll(): void;
}
```

#### ProcessingProxy

```typescript
class ProcessingProxy implements IDocumentProcessor {
  processDocuments(
    documents: DocumentUploadModel[],
    apiKey: string,
    model: string,
    onProgress?: (event: any) => void
  ): Promise<ProcessingResultModel | ProcessingResponse>;

  isOnline(): boolean;
  isOffline(): boolean;
  getNetworkStatus(): 'online' | 'offline';
  getNetworkContext(): NetworkStateContextImpl;
  cleanup(): void;
}

class ProcessingProxySingleton {
  static getInstance(): ProcessingProxy;
  static resetInstance(): void;
}

interface ProcessingResponse {
  success: boolean;
  message: string;
  queued?: boolean;
  jobIds?: string[];
  result?: ProcessingResultModel;
}
```

#### SyncManager

```typescript
class SyncManager {
  static getInstance(config?: Partial<SyncConfig>): SyncManager;

  subscribe(observer: SyncObserver): () => void;
  startSync(): Promise<void>;
  retryJob(jobId: string): Promise<boolean>;
  cancelJob(jobId: string): Promise<boolean>;
  isSyncInProgress(): boolean;
  getQueueStats(): Promise<StorageStats>;
  cleanup(): void;
  static resetInstance(): void;
}

interface SyncConfig {
  maxRetries: number;
  retryDelayMs: number;
  useExponentialBackoff: boolean;
  parallelSync: boolean;
  cleanupCompletedJobs: boolean;
}

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
```

#### OfflineNotifications

```typescript
class OfflineNotifications {
  static getInstance(): OfflineNotifications;

  subscribe(observer: ToastObserver): () => void;
  unsubscribe(observer: ToastObserver): void;
  showToast(params: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    duration?: number;
  }): void;
  cleanup(): void;
  static resetInstance(): void;
}

interface ToastObserver {
  onToast(toast: Toast): void;
}

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

function useOfflineNotifications(onToast: (toast: Toast) => void): OfflineNotifications;
```

#### Module Exports

```typescript
// src/lib/offline/index.ts

export {
  NetworkStatusManager,
  LocalDocumentStore,
  ProcessingProxy,
  ProcessingProxySingleton,
  SyncManager,
  OfflineNotifications,
  DocumentJobFactory,
  DocumentJobOriginator,
  JobMementoCaretaker,
  OnlineState,
  OfflineState,
  NetworkStateContextImpl,
};

export async function initializeOfflineProcessing(): Promise<void>;
export function cleanupOfflineProcessing(): void;
export async function getOfflineStats(): Promise<StorageStats>;
```

---

## Testing Guide

### Manual Testing Scenarios

#### Scenario 1: Queue Documents Offline

**Steps**:
1. Open browser DevTools → Network tab
2. Set throttling to "Offline"
3. Upload documents in Filr
4. Verify: Toast shows "You are offline. Your documents have been queued."
5. Verify: QueueStatus component shows queued documents
6. Check IndexedDB: Open Application tab → IndexedDB → FilrDB → document_jobs
7. Verify jobs are stored with status "queued"

**Expected**:
- Documents stored in IndexedDB
- UI shows queue status
- No errors in console

#### Scenario 2: Auto-Sync When Reconnected

**Steps**:
1. Queue documents while offline (Scenario 1)
2. Set throttling back to "Online"
3. Verify: Toast shows "Connection restored. Synchronizing X queued documents."
4. Verify: QueueStatus shows sync progress
5. Verify: Toast shows "Sync completed"
6. Check IndexedDB: Jobs should be marked "completed" or deleted

**Expected**:
- All queued jobs processed
- Sync progress visible
- Success notifications shown

#### Scenario 3: Failed Job Retry

**Steps**:
1. Queue a document offline
2. Modify API key to be invalid (Settings)
3. Go online
4. Sync will fail
5. Verify: Job marked as "failed" with error message
6. Click "Retry" button in QueueStatus
7. Fix API key
8. Job should process successfully

**Expected**:
- Failed jobs show error message
- Retry functionality works
- Fixed jobs complete successfully

#### Scenario 4: Storage Limits

**Steps**:
1. Upload very large files (>50MB total)
2. Go offline
3. Try to queue documents
4. Verify: System checks available storage
5. If low: Warning toast shown

**Expected**:
- Storage check prevents overflow
- User warned of low storage

#### Scenario 5: Browser Close During Sync

**Steps**:
1. Queue 5 documents offline
2. Go online to trigger sync
3. During sync, close browser tab
4. Reopen extension
5. Check jobs: Any stuck in "syncing" state should be reset to "queued"

**Expected**:
- Stuck jobs cleaned up on next load
- Jobs requeued for retry

### Unit Testing

#### Test NetworkStatusManager

```typescript
import { NetworkStatusManager } from './lib/offline/NetworkStatusManager';

describe('NetworkStatusManager', () => {
  afterEach(() => {
    NetworkStatusManager.resetInstance();
  });

  test('should be singleton', () => {
    const instance1 = NetworkStatusManager.getInstance();
    const instance2 = NetworkStatusManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should notify subscribers', () => {
    const manager = NetworkStatusManager.getInstance();
    const observer = jest.fn();

    manager.subscribe({ onStatusChange: observer });

    // Simulate network change
    window.dispatchEvent(new Event('offline'));

    expect(observer).toHaveBeenCalledWith('offline');
  });
});
```

#### Test LocalDocumentStore

```typescript
import { LocalDocumentStore } from './lib/offline/LocalDocumentStore';
import { DocumentJobFactory } from './lib/offline/DocumentJob';

describe('LocalDocumentStore', () => {
  let store: LocalDocumentStore;

  beforeEach(async () => {
    store = LocalDocumentStore.getInstance();
    await store.initializeDB();
    await store.clearAllJobs();
  });

  afterEach(() => {
    store.close();
    LocalDocumentStore.resetInstance();
  });

  test('should add and retrieve job', async () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const job = await DocumentJobFactory.createFromFile(file);

    await store.addJob(job);

    const retrieved = await store.getJob(job.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.fileName).toBe('test.pdf');
  });

  test('should get queued jobs', async () => {
    const file1 = new File(['test1'], 'test1.pdf', { type: 'application/pdf' });
    const file2 = new File(['test2'], 'test2.pdf', { type: 'application/pdf' });

    const job1 = await DocumentJobFactory.createFromFile(file1);
    const job2 = await DocumentJobFactory.createFromFile(file2);

    await store.addJobs([job1, job2]);

    const queued = await store.getQueuedJobs();
    expect(queued).toHaveLength(2);
  });

  test('should update job status', async () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const job = await DocumentJobFactory.createFromFile(file);

    await store.addJob(job);
    await store.updateJobStatus(job.id, 'completed');

    const updated = await store.getJob(job.id);
    expect(updated!.status).toBe('completed');
  });
});
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Jobs Not Syncing

**Symptoms**: Jobs remain in "queued" state even when online

**Possible Causes**:
1. Network status not detected correctly
2. SyncManager not initialized
3. API key missing or invalid

**Debug Steps**:
```typescript
// Check network status
const networkManager = NetworkStatusManager.getInstance();
console.log('Network status:', networkManager.getStatus());

// Check if sync is running
const syncManager = SyncManager.getInstance();
console.log('Sync in progress:', syncManager.isSyncInProgress());

// Check queue
const store = LocalDocumentStore.getInstance();
const queued = await store.getQueuedJobs();
console.log('Queued jobs:', queued);

// Manual trigger sync
await syncManager.startSync();
```

**Solutions**:
- Verify API key in Settings
- Check browser console for errors
- Manually trigger sync with "Sync Now" button

---

#### Issue 2: IndexedDB Not Initialized

**Symptoms**: Error "Database not initialized"

**Cause**: `initializeDB()` not called

**Solution**:
```typescript
const store = LocalDocumentStore.getInstance();
await store.initializeDB();
```

---

#### Issue 3: Toast Notifications Not Showing

**Symptoms**: No toasts appear for offline/online events

**Cause**: ToastContainer not added to UI

**Solution**:
```typescript
// Ensure ToastContainer is rendered in App.tsx
import { ToastContainer } from './components/ToastContainer';

return (
  <>
    <ToastContainer />
    {/* ... rest of app */}
  </>
);
```

---

#### Issue 4: Jobs Stuck in "Syncing" State

**Symptoms**: Jobs show "syncing" status indefinitely

**Cause**: Browser closed during sync, or sync crashed

**Solution**:
```typescript
// Cleanup is automatic on next load via initializeOfflineProcessing()
// Manual cleanup:
const store = LocalDocumentStore.getInstance();
const cleanedUp = await store.cleanupStuckJobs(30); // 30 minutes
console.log(`Cleaned up ${cleanedUp} stuck jobs`);
```

---

#### Issue 5: Storage Quota Exceeded

**Symptoms**: "Insufficient storage space" error

**Cause**: Too many queued jobs or large files

**Solution**:
```typescript
// Check storage stats
const stats = await store.getStorageStats();
console.log('Total size:', stats.totalSize / (1024 * 1024), 'MB');
console.log('Available space:', stats.availableSpace / (1024 * 1024), 'MB');

// Delete completed jobs
const deleted = await store.deleteCompletedJobs();
console.log(`Deleted ${deleted} completed jobs`);

// Or clear all (use with caution!)
// await store.clearAllJobs();
```

---

## Future Enhancements

### Planned Features

1. **Priority Queue**
   - Allow users to set priority for jobs
   - Process high-priority jobs first
   - UI to reorder queue

2. **Batch Operations**
   - "Retry All Failed" button
   - "Cancel All" button
   - Bulk job management

3. **Sync Scheduling**
   - Option to sync only on WiFi
   - Schedule sync for specific times
   - Pause/resume sync manually

4. **Advanced Retry Strategies**
   - Configurable retry strategies per job type
   - Circuit breaker pattern for repeated failures
   - Rate limiting awareness

5. **Conflict Resolution**
   - Detect duplicate jobs
   - Merge strategies for partial results
   - User prompts for conflicts

6. **Offline Analytics**
   - Track queue statistics over time
   - Success/failure rates
   - Average sync time

7. **Export/Import Queue**
   - Export queue to JSON
   - Import queue from another device
   - Backup/restore functionality

8. **Service Worker Integration**
   - Background sync API
   - Sync even when extension is closed
   - Periodic background sync

9. **Multi-Device Sync**
   - Cloud-based queue storage
   - Sync queue across devices
   - Collaborative processing

10. **Enhanced Notifications**
    - Browser push notifications
    - Email notifications for sync completion
    - Webhook support for integrations

---

## Appendix

### File Structure

```
filr/
├── src/
│   ├── lib/
│   │   └── offline/
│   │       ├── index.ts                       # Main export
│   │       ├── NetworkStatusManager.ts        # Singleton + Observer
│   │       ├── LocalDocumentStore.ts          # Facade for IndexedDB
│   │       ├── DocumentJob.ts                 # Models + Memento + Factory
│   │       ├── NetworkAwareState.ts           # State pattern
│   │       ├── ProcessingProxy.ts             # Proxy pattern
│   │       ├── SyncManager.ts                 # Sync orchestration
│   │       └── OfflineNotifications.ts        # Notification system
│   ├── components/
│   │   ├── QueueStatus.tsx                    # Queue UI
│   │   └── ToastContainer.tsx                 # Toast notifications
│   ├── controllers/
│   │   └── OfflineAwareDocumentController.ts  # Controller wrapper
│   └── App.tsx                                # Integration point
└── OFFLINE_PROCESSING_IMPLEMENTATION.md       # This document
```

### Dependencies

**No new external dependencies required!**

All functionality uses:
- Browser APIs: `indexedDB`, `navigator.onLine`, `window.addEventListener`
- Existing React/TypeScript infrastructure
- Existing design patterns from the codebase

### Performance Considerations

**IndexedDB Operations**:
- Batch operations when possible
- Use indexes for queries
- Async operations don't block UI

**Memory Management**:
- Files stored as Blobs (not loaded into memory until needed)
- Cleanup completed jobs automatically
- Limit queue size if needed

**Network Efficiency**:
- Serial sync to avoid rate limits
- Exponential backoff for retries
- Configurable batch sizes

---

## Conclusion

The Offline Processing and Synchronization feature is **fully implemented** and ready for use. It provides:

✅ **Robust offline support** with automatic queuing
✅ **Intelligent synchronization** with retry logic
✅ **User-friendly interface** with real-time feedback
✅ **Enterprise design patterns** for maintainability
✅ **Zero external dependencies** using browser APIs
✅ **Comprehensive error handling** and recovery

The implementation is production-ready and follows all best practices for browser extensions and offline-first applications.

---

**Document Version**: 1.0
**Last Updated**: January 2025
**Maintainer**: Filr Development Team
