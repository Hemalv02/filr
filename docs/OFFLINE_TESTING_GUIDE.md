# Offline Feature - Testing Guide

**How to verify that the offline feature is working properly**

---

## Visual Indicators You'll See

The offline feature has **4 main visual indicators** so you always know what's happening:

### 1. **Network Status Banner** (Top of screen)
- **Orange banner** appears when you go offline
  - Shows: "You're Offline - Documents will be saved and uploaded automatically when you're back online"
  - If you have queued docs, shows count badge
- **Blue banner** appears when syncing
  - Shows: "Back Online • Syncing X queued documents..."

### 2. **Queue Status Card** (Main interface)
- Shows real-time statistics:
  - Total Jobs
  - Queued jobs (blue number)
  - Failed jobs (red number)
  - Total size
- Lists all queued documents with status badges:
  - **Blue "Queued"** - Waiting for connection
  - **Yellow "Syncing"** - Currently uploading
  - **Green "Completed"** - Successfully processed
  - **Red "Failed"** - Error occurred
- Shows sync progress bar when uploading
- **"Sync Now"** button when online

### 3. **Toast Notifications** (Top-right corner)
- **Warning toast**: "You are offline"
- **Success toast**: "Connection restored!"
- **Info toast**: "Starting sync..."
- **Success toast**: "All documents synced successfully!"
- **Error toast**: If sync fails

### 4. **Status Badges** (On each queued item)
- Color-coded badges show status at a glance
- Click **Retry** button on failed items
- Click **Cancel** button to remove from queue

---

## How to Test the Offline Feature

### Test 1: Basic Offline Queue

1. **Open your extension**
2. **Go offline**:
   - Press `F12` (open DevTools)
   - Go to **Network** tab
   - Change dropdown from "No throttling" to **"Offline"**
3. **Upload a document**
   - Select a file (PDF, image, etc.)
   - Click "Process Documents"
4. **✅ You should see**:
   - Orange "You're Offline" banner appears at top
   - Toast notification: "You are offline"
   - Queue Status card shows "1" in Queued count
   - Document listed with blue "Queued" badge
5. **Go back online**:
   - In DevTools Network tab, change back to **"Online"**
6. **✅ You should see**:
   - Blue "Back Online • Syncing..." banner
   - Toast: "Connection restored!"
   - Progress bar showing sync progress
   - Document badge changes: Queued → Syncing → Completed
   - Toast: "All documents synced successfully!"
   - Document disappears from queue (auto-deleted after success)

---

### Test 2: Multiple Documents While Offline

1. **Go offline** (F12 → Network → Offline)
2. **Upload 3-5 documents** one after another
3. **✅ You should see**:
   - Queue Status shows "5" queued
   - All 5 documents listed with "Queued" badges
   - Orange offline banner shows "5 queued" badge
4. **Go back online**
5. **✅ You should see**:
   - Progress bar: "Syncing... (1 / 5)", "(2 / 5)", etc.
   - Each document's badge changes as it processes
   - Toast notifications for each milestone

---

### Test 3: Failed Document Retry

1. **Go offline**
2. **Upload a corrupted or invalid file** (e.g., empty .txt file renamed to .pdf)
3. **Go online**
4. **✅ You should see**:
   - Document processes but shows red "Failed" badge
   - Error message displayed under the document
   - **"Retry"** button appears
5. **Click Retry button**
6. **✅ You should see**:
   - Badge changes to "Queued"
   - Automatically attempts to sync again
   - Shows progress

---

### Test 4: Cancel Queued Document

1. **Go offline**
2. **Upload a document**
3. **✅ You should see**: Document in queue with "Queued" badge
4. **Click the "Cancel" button** next to the document
5. **✅ You should see**:
   - Document immediately removed from queue
   - Queue count decreases
   - Toast notification confirms cancellation

---

### Test 5: Network Toggle (Realistic scenario)

1. **Start uploading a document**
2. **Go offline mid-process**
3. **✅ You should see**:
   - Orange banner appears immediately
   - Document added to queue
4. **Wait 30 seconds**
5. **Go online**
6. **✅ You should see**:
   - Automatic sync starts within 2-3 seconds
   - No manual action needed

---

### Test 6: Browser Restart with Queued Jobs

1. **Go offline**
2. **Upload 2-3 documents**
3. **Close the browser completely** (or close the extension)
4. **Reopen the browser/extension**
5. **✅ You should see**:
   - Queue Status still shows the 2-3 queued documents
   - Documents persisted in IndexedDB
6. **Go online**
7. **✅ You should see**:
   - Automatic sync starts
   - All queued documents process

---

## Keyboard Shortcuts for Testing

- **F12**: Open/close DevTools
- **Ctrl+R** / **Cmd+R**: Reload extension to test persistence

---

## What Each Visual Element Tells You

| Element | What It Means |
|---------|---------------|
| **Orange Banner** | You're offline, documents will queue |
| **Blue Banner** | Syncing in progress |
| **"X queued" badge** | Number of documents waiting to upload |
| **Blue "Queued" badge** | Document saved, waiting for connection |
| **Yellow "Syncing" badge** | Document currently being processed |
| **Green "Completed" badge** | Document processed successfully |
| **Red "Failed" badge** | Error occurred, needs attention |
| **Progress bar (0/5)** | Current upload progress |
| **Retry button** | Click to retry failed document |
| **Cancel button** | Click to remove from queue |
| **Sync Now button** | Manually trigger sync |

---

## Troubleshooting

### "I don't see the offline banner"
- Make sure you actually went offline (check DevTools Network tab)
- Refresh the page after going offline
- Check browser console for errors

### "Documents aren't syncing when I go online"
- Check Queue Status card - click "Sync Now" button
- Check browser console for API errors
- Verify your API key is set in Settings

### "Queue Status card doesn't appear"
- It only appears when there are queued jobs
- Try uploading a document while offline first

### "Completed documents stay in queue"
- Completed documents should auto-delete after 5 seconds
- If not, it's a bug - check console logs

---

## Expected Behavior Summary

✅ **Offline Upload**
- No errors
- Document queued automatically
- Visual feedback via banner + toast

✅ **Automatic Sync**
- Starts 2-3 seconds after going online
- No manual intervention needed
- Progress shown in real-time

✅ **Persistence**
- Queued documents survive browser restart
- Stored in IndexedDB (unlimited storage)
- Cleanup happens automatically

✅ **User Control**
- Manual sync button when needed
- Retry failed uploads
- Cancel unwanted uploads

---

## Developer Testing Checklist

- [ ] Offline upload shows orange banner
- [ ] Online sync shows blue banner
- [ ] Toast notifications appear for all events
- [ ] Queue Status card shows accurate counts
- [ ] Progress bar animates smoothly
- [ ] Status badges update in real-time
- [ ] Retry button works on failed items
- [ ] Cancel button removes items
- [ ] Sync Now button triggers manual sync
- [ ] Documents persist after browser restart
- [ ] Completed documents auto-delete
- [ ] Failed documents show error messages
- [ ] Multiple documents queue correctly
- [ ] Network toggle works mid-upload

---

## Quick Test Script

```bash
# 1. Go offline
F12 → Network → Offline

# 2. Upload document
Click "Process Documents"

# Expected: Orange banner + Queue card shows 1 queued

# 3. Go online
Network → Online

# Expected: Blue banner + Progress bar + Auto-sync

# 4. Verify completion
# Expected: Document disappears + Success toast
```

---

**All visual indicators work together to give users confidence that their work is safe!**
