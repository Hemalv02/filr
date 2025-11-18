# How to Use Offline Processing - Developer Guide

**Simple, practical guide to get offline processing working in your app.**

---

## 1. Turn It On (Already Done!)

The offline processing is **already initialized** in `App.tsx`. It turns on automatically when the app starts.

```typescript
// Already in App.tsx - you don't need to do this again
useEffect(() => {
  initializeOfflineProcessing();
}, []);
```

✅ **You're done with setup!** The system is active and monitoring network status.

---

## 2. How to Use It

### Option A: Automatic (Recommended)

Replace your document processing code with this:

```typescript
// BEFORE (old way):
import { DocumentController } from './controllers/DocumentController';
const result = await DocumentController.processDocuments(documents, apiKey, model);

// AFTER (offline-aware way):
import {
  OfflineAwareDocumentController,
  isQueuedResponse
} from './controllers/OfflineAwareDocumentController';

const result = await OfflineAwareDocumentController.processDocuments(
  documents,
  apiKey,
  model
);

// Handle the result
if (isQueuedResponse(result)) {
  // User is offline - documents were queued
  alert(result.message); // Shows "Documents queued for processing..."
} else {
  // User is online - documents were processed
  showResults(result.data); // Your existing results page
}
```

**That's it!** The controller automatically:
- ✅ Detects if you're offline
- ✅ Queues documents in IndexedDB if offline
- ✅ Processes immediately if online
- ✅ Auto-syncs when connection returns

### Option B: Check Network First

If you want to warn users before they upload:

```typescript
import { OfflineAwareDocumentController } from './controllers/OfflineAwareDocumentController';

function handleUpload() {
  // Check if offline
  if (OfflineAwareDocumentController.isOffline()) {
    alert('You are offline. Documents will be queued.');
  }

  // Then process normally
  const result = await OfflineAwareDocumentController.processDocuments(...);
}
```

---

## 3. UI Components (Already Added!)

Two UI components are already in `App.tsx`:

### QueueStatus Component
Shows queued documents with retry/cancel buttons.

```typescript
// Already added in App.tsx
<QueueStatus />
```

**Shows:**
- Number of queued/failed jobs
- List of documents waiting to sync
- Retry button for failed jobs
- Cancel button for queued jobs
- Sync progress bar

### ToastContainer Component
Shows notifications for offline/online events.

```typescript
// Already added in App.tsx
<ToastContainer />
```

**Shows notifications for:**
- "You are offline" when network is lost
- "Connection restored" when back online
- "Syncing X documents..." when sync starts
- "Sync completed" when done
- Errors for failed jobs

---

## 4. Common Scenarios

### Scenario 1: User Uploads While Offline

```typescript
// Your existing upload code
const result = await OfflineAwareDocumentController.processDocuments(
  documents,
  apiKey,
  model
);

if (isQueuedResponse(result)) {
  // Don't navigate to results page
  // Stay on upload page and show message
  console.log(`Queued ${result.jobIds.length} documents`);
  // User will see toast: "Documents queued for processing"
} else {
  // Navigate to results as normal
  navigateToResults(result.data);
}
```

### Scenario 2: Show Network Status

```typescript
import { NetworkStatusManager } from './lib/offline';

const networkManager = NetworkStatusManager.getInstance();

// Check once
if (networkManager.isOffline()) {
  showOfflineBanner();
}

// Monitor continuously
networkManager.subscribe({
  onStatusChange: (status) => {
    if (status === 'offline') {
      showOfflineBanner();
    } else {
      hideOfflineBanner();
    }
  }
});
```

### Scenario 3: Manual Sync Button

```typescript
import { SyncManager } from './lib/offline';

async function handleSyncClick() {
  const syncManager = SyncManager.getInstance();
  await syncManager.startSync();
  alert('Sync complete!');
}

<button onClick={handleSyncClick}>Sync Now</button>
```

### Scenario 4: Show Queue Count

```typescript
import { LocalDocumentStore } from './lib/offline';

async function getQueueCount() {
  const store = LocalDocumentStore.getInstance();
  await store.initializeDB();

  const stats = await store.getStorageStats();
  return stats.queuedJobs; // Number of queued documents
}

// Use in UI
const count = await getQueueCount();
if (count > 0) {
  showBadge(count); // Show badge with number
}
```

---

## 5. What Happens Automatically

### When User Goes Offline:
1. ✅ System detects network loss
2. ✅ Toast shows: "You are offline"
3. ✅ Next upload automatically queues documents
4. ✅ QueueStatus component shows queued docs

### When User Comes Back Online:
1. ✅ System detects network restoration
2. ✅ Toast shows: "Connection restored. Syncing X documents..."
3. ✅ Auto-starts processing queued documents
4. ✅ Shows progress in QueueStatus
5. ✅ Retries failed jobs (up to 3 times)
6. ✅ Toast shows: "Sync completed"
7. ✅ Cleans up completed jobs

### You Don't Need to Do Anything!
The sync happens automatically in the background.

---

## 6. Testing

### Test Offline Mode:
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Set throttling to "Offline"
4. Try uploading documents
5. See them appear in QueueStatus component
6. Set throttling back to "Online"
7. Watch them auto-sync

### Test Failed Jobs:
1. Queue documents while offline
2. Change API key to something invalid
3. Go online
4. Jobs will fail and show error message
5. Fix API key
6. Click "Retry" in QueueStatus
7. Jobs should succeed

---

## 7. Configuration (Optional)

You can customize sync behavior:

```typescript
import { SyncManager } from './lib/offline';

// Initialize with custom config
const syncManager = SyncManager.getInstance({
  maxRetries: 5,              // Default: 3
  retryDelayMs: 3000,         // Default: 2000ms
  useExponentialBackoff: true,// Default: true
  parallelSync: false,        // Default: false (recommended)
  cleanupCompletedJobs: true, // Default: true
});
```

---

## 8. Troubleshooting

### Jobs Not Syncing?
```typescript
// Manual sync
const syncManager = SyncManager.getInstance();
await syncManager.startSync();
```

### Check Queue:
```typescript
const store = LocalDocumentStore.getInstance();
await store.initializeDB();

const queued = await store.getQueuedJobs();
console.log(`${queued.length} jobs in queue`);
```

### Clear Everything:
```typescript
const store = LocalDocumentStore.getInstance();
await store.clearAllJobs(); // ⚠️ Deletes all queued jobs!
```

### Reset Stuck Jobs:
```typescript
const store = LocalDocumentStore.getInstance();
const cleaned = await store.cleanupStuckJobs(30); // Reset jobs stuck for 30+ min
console.log(`Reset ${cleaned} stuck jobs`);
```

---

## 9. Key Files

| File | What It Does |
|------|--------------|
| `OfflineAwareDocumentController.ts` | Main controller - use this instead of DocumentController |
| `QueueStatus.tsx` | UI component showing queue |
| `ToastContainer.tsx` | UI component showing notifications |
| `App.tsx` | Initialization happens here |

---

## 10. Quick Reference

### Import What You Need:
```typescript
// For processing documents
import {
  OfflineAwareDocumentController,
  isQueuedResponse
} from './controllers/OfflineAwareDocumentController';

// For checking network status
import { NetworkStatusManager } from './lib/offline';

// For manual sync
import { SyncManager } from './lib/offline';

// For queue management
import { LocalDocumentStore } from './lib/offline';

// For UI components (already in App.tsx)
import { QueueStatus } from './components/QueueStatus';
import { ToastContainer } from './components/ToastContainer';
```

### Process Documents:
```typescript
const result = await OfflineAwareDocumentController.processDocuments(
  documents,
  apiKey,
  model
);

if (isQueuedResponse(result)) {
  // Offline - queued
} else {
  // Online - processed
}
```

### Check Network:
```typescript
if (OfflineAwareDocumentController.isOffline()) {
  // Show warning
}
```

### Manual Sync:
```typescript
await SyncManager.getInstance().startSync();
```

---

## That's It!

**The feature is already working.** Just replace `DocumentController` with `OfflineAwareDocumentController` in your upload code and you're done.

Everything else (queueing, syncing, notifications) happens automatically.

---

## Need More Details?

- **API Reference**: `OFFLINE_API_REFERENCE.md` - Complete API documentation
- **Architecture**: `OFFLINE_PROCESSING_IMPLEMENTATION.md` - How it works internally
- **Examples**: `OFFLINE_USAGE_GUIDE.md` - More code examples

---

**Questions?** Check the troubleshooting section or the API reference.
