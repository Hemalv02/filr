# Offline Feature Guide

## What Does the Offline Feature Do?

The offline functionality provides a safety net for document processing when internet connectivity is unreliable or unavailable.

### Key Features:

1. **Automatic Offline Detection**
   - The extension automatically detects when you lose internet connection
   - Visual indicators show your current connection status

2. **Document Queueing**
   - When offline, uploaded documents are saved locally in your browser's IndexedDB
   - Files are preserved even if you close the browser
   - Queue persists until processed successfully

3. **Automatic Processing When Online**
   - When connection is restored, queued documents are automatically processed
   - No need to re-upload documents
   - Sync happens in the background

4. **Data Loss Prevention**
   - Prevents losing uploaded documents if connection drops during upload
   - Stores document files, metadata, and form context locally
   - Ensures work isn't wasted

## Practical Benefits:

### For Users with Unstable Connections:
- **Rural/Remote Areas**: Upload documents even with spotty internet
- **Mobile Users**: Continue working when moving between WiFi/mobile data
- **Public WiFi**: Don't lose progress if connection drops

### For Batch Processing:
- Upload multiple documents while offline
- Process them all at once when connection returns
- Save time by not waiting for each upload

### For Data Security:
- Documents stored locally in your browser (not sent to any server while offline)
- Only uploaded to Gemini API when you're online
- You control when processing happens

## How It Works:

### When You're Online (Normal Flow):
```
1. Select documents → 2. Click Submit → 3. Immediate Processing → 4. Show Results
```

### When You're Offline (Queue Flow):
```
1. Select documents → 2. Click Submit → 3. Save to Local Queue → 4. Show "Queued" Message
5. When back online → 6. Auto-process from queue → 7. Show Results
```

## Technical Implementation:

1. **SimpleOfflineQueue**: Lightweight IndexedDB storage for document files
2. **NetworkStatusManager**: Monitors online/offline status
3. **Auto-sync**: Processes queued documents when connection restores

## User Experience:

- **Clear Indicators**: Status banner shows when you're offline
- **Toast Notifications**: Alerts when connection changes
- **Queue Status**: Shows how many documents are waiting to be processed
- **No Extra Steps**: Offline queueing happens automatically

## Example Scenario:

**Without Offline Feature:**
```
User uploads document → Connection drops → Error message → Lost work → Must re-upload
```

**With Offline Feature:**
```
User uploads document → Connection drops → Document queued locally →
Connection returns → Auto-processed → Results shown → Work saved!
```

## Why This Matters:

1. **Reliability**: Don't depend on constant internet connection
2. **Productivity**: Keep working regardless of network status
3. **User Experience**: Seamless handling of connection issues
4. **Data Safety**: Never lose uploaded documents

## Current Limitations:

- Documents can only be **stored** offline, not **processed**
  - Gemini API requires internet connection for AI processing
  - The feature queues documents for later processing, not offline AI

- Maximum Storage: Limited by browser's IndexedDB quota (typically 50MB+)

- No Manual Queue Management UI (yet)
  - Auto-sync happens automatically
  - Future update could add queue viewer/manager

## Future Enhancements:

1. **Queue Dashboard**: View and manage queued documents
2. **Retry Logic**: Auto-retry failed processing with exponential backoff
3. **Partial Sync**: Process documents individually with progress tracking
4. **Queue Limits**: Set maximum queue size and storage limits

---

**Bottom Line:** The offline feature ensures your work is never lost due to connectivity issues, making the extension usable even in challenging network conditions.
