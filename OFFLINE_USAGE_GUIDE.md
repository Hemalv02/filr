# Offline Processing - Quick Start Guide

## For Developers

### 1. Initialization

The offline processing system is automatically initialized when the app starts (already integrated in `App.tsx`):

```typescript
import { initializeOfflineProcessing } from './lib/offline';

useEffect(() => {
  initializeOfflineProcessing();
}, []);
```

### 2. Using Offline-Aware Processing

**Option A: Use the OfflineAwareDocumentController** (Recommended)

```typescript
import {
  OfflineAwareDocumentController,
  isQueuedResponse,
  isProcessingResult
} from './controllers/OfflineAwareDocumentController';

const handleUpload = async (documents) => {
  const result = await OfflineAwareDocumentController.processDocuments(
    documents,
    apiKey,
    model,
    onProgress
  );

  if (isQueuedResponse(result)) {
    // User is offline - documents queued
    alert(result.message);
    console.log(`Queued ${result.jobIds.length} jobs`);
    // Don't navigate away - user should see queue status
  } else if (isProcessingResult(result)) {
    // User is online - processing complete
    navigateToResults(result.data);
  }
};
```

**Option B: Check network status first**

```typescript
import { NetworkStatusManager } from './lib/offline/NetworkStatusManager';
import { OfflineAwareDocumentController } from './controllers/OfflineAwareDocumentController';

if (OfflineAwareDocumentController.isOffline()) {
  // Show warning to user
  console.log('You are offline - documents will be queued');
}

// Then process as normal
const result = await OfflineAwareDocumentController.processDocuments(...);
```

### 3. Displaying Queue Status

The `QueueStatus` component is already integrated in `App.tsx`. It will automatically:
- Show when there are queued jobs
- Display sync progress
- Allow retry/cancel actions
- Auto-refresh every 5 seconds

### 4. Custom Sync Configuration

```typescript
import { SyncManager } from './lib/offline/SyncManager';

// Initialize with custom config
const syncManager = SyncManager.getInstance({
  maxRetries: 5,              // Default: 3
  retryDelayMs: 3000,         // Default: 2000
  useExponentialBackoff: true,// Default: true
  parallelSync: false,        // Default: false (recommended)
  cleanupCompletedJobs: true, // Default: true
});
```

### 5. Subscribing to Events

**Network Status Changes:**

```typescript
import { NetworkStatusManager } from './lib/offline/NetworkStatusManager';

const networkManager = NetworkStatusManager.getInstance();

const unsubscribe = networkManager.subscribe({
  onStatusChange: (status) => {
    if (status === 'offline') {
      console.log('Network lost - queueing enabled');
    } else {
      console.log('Network restored - syncing...');
    }
  }
});

// Cleanup
return () => unsubscribe();
```

**Sync Events:**

```typescript
import { SyncManager } from './lib/offline/SyncManager';

const syncManager = SyncManager.getInstance();

const unsubscribe = syncManager.subscribe({
  onSyncEvent: (event) => {
    switch (event.type) {
      case 'sync_started':
        console.log(`Syncing ${event.total} jobs`);
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
    }
  }
});

// Cleanup
return () => unsubscribe();
```

### 6. Manual Operations

**Trigger sync manually:**

```typescript
import { SyncManager } from './lib/offline/SyncManager';

const syncManager = SyncManager.getInstance();
await syncManager.startSync();
```

**Retry a specific job:**

```typescript
const success = await syncManager.retryJob(jobId);
```

**Cancel a job:**

```typescript
const success = await syncManager.cancelJob(jobId);
```

**Get queue statistics:**

```typescript
import { LocalDocumentStore } from './lib/offline/LocalDocumentStore';

const store = LocalDocumentStore.getInstance();
await store.initializeDB();

const stats = await store.getStorageStats();
console.log(`Queued: ${stats.queuedJobs}`);
console.log(`Failed: ${stats.failedJobs}`);
console.log(`Total size: ${stats.totalSize / (1024 * 1024)} MB`);
```

**Cleanup completed jobs:**

```typescript
const deletedCount = await store.deleteCompletedJobs();
console.log(`Deleted ${deletedCount} completed jobs`);
```

**Cleanup stuck jobs:**

```typescript
const cleanedUp = await store.cleanupStuckJobs(30); // 30 minutes
console.log(`Reset ${cleanedUp} stuck jobs`);
```

---

## For End Users

### What Happens When You're Offline?

1. **Upload documents as usual** - The extension will detect you're offline
2. **See "Queued" notification** - Your documents are saved locally and will process when you're back online
3. **Continue using the app** - You can close the browser or continue working
4. **Automatic sync** - When your connection is restored, documents will automatically start processing
5. **Get results** - You'll see a "Sync completed" notification when all documents are processed

### Managing Queued Documents

The **Queue Status** panel shows all queued documents. You can:
- See how many documents are waiting
- View sync progress in real-time
- **Retry** failed documents
- **Cancel** documents you no longer need
- **Sync Now** to manually trigger processing

### What If Processing Fails?

If a document fails to process:
1. It will be retried automatically (up to 3 times)
2. If all retries fail, it will be marked as "Failed"
3. You'll see the error message in the queue
4. Click **Retry** to try again
5. Or **Cancel** to remove it from the queue

### Storage Considerations

- Queued documents are stored in your browser's local storage
- Large files may use significant storage space
- The system will warn you if storage is low
- Completed documents are automatically cleaned up

---

## Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| Jobs not syncing | Check API key in Settings, click "Sync Now" |
| "Database not initialized" error | Refresh the page |
| No toast notifications | Check if ToastContainer is rendered |
| Jobs stuck in "syncing" | Refresh - automatic cleanup will reset them |
| Storage quota exceeded | Delete completed jobs or clear queue |
| Network status not detected | Check browser permissions |

---

## Architecture Summary

```
User Upload → OfflineAwareDocumentController → ProcessingProxy
                                                      │
                        ┌─────────────────────────────┴────────────────────────┐
                        │                                                      │
                  [Online State]                                        [Offline State]
                        │                                                      │
                        ↓                                                      ↓
              DocumentController                               LocalDocumentStore
              (Process Immediately)                            (Queue in IndexedDB)
                                                                               │
                                                                               ↓
                                                                When network restored:
                                                                      SyncManager
                                                                           │
                                                                           ↓
                                                               Process via DocumentController
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/offline/index.ts` | Main export, initialization |
| `src/lib/offline/NetworkStatusManager.ts` | Network monitoring |
| `src/lib/offline/LocalDocumentStore.ts` | IndexedDB operations |
| `src/lib/offline/ProcessingProxy.ts` | Request routing |
| `src/lib/offline/SyncManager.ts` | Sync orchestration |
| `src/lib/offline/OfflineNotifications.ts` | Toast notifications |
| `src/components/QueueStatus.tsx` | Queue UI |
| `src/components/ToastContainer.tsx` | Toast UI |
| `src/controllers/OfflineAwareDocumentController.ts` | Controller wrapper |

---

## Design Patterns Used

1. **Singleton** - Single instances of managers
2. **Observer** - Event notifications
3. **State** - Online/Offline behavior
4. **Proxy** - Request interception
5. **Memento** - Job state preservation
6. **Facade** - IndexedDB simplification
7. **Factory** - Job creation

---

## Next Steps

1. **Test offline functionality** - Try uploading while offline
2. **Monitor the queue** - Watch sync progress
3. **Customize sync config** - Adjust retry settings if needed
4. **Add custom handlers** - Subscribe to events for custom logic

For detailed documentation, see `OFFLINE_PROCESSING_IMPLEMENTATION.md`.
