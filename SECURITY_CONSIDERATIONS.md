# Security Considerations for Offline Document Storage

## ⚠️ Important Privacy Notice

The offline queueing feature stores documents **locally on your device** in the browser's IndexedDB. This has security implications you should understand.

## What Gets Stored:

When you queue documents offline:
- ✅ **Document files** (PDFs, images with NID, passport, etc.)
- ✅ **Form data** (detected form fields)
- ✅ **Metadata** (filenames, timestamps, queue status)

All stored **unencrypted** in your browser's local storage.

## Security Risks:

### 1. Physical Access
- Anyone with access to your unlocked computer can view queued documents
- Can be accessed via Chrome DevTools → Application → IndexedDB
- Persists even after closing the browser

### 2. Shared Computers
- **DO NOT** use offline mode on:
  - Public computers (libraries, internet cafes)
  - Shared work computers
  - Any device you don't fully control

### 3. Data Persistence
- Documents remain in storage until:
  - Successfully processed and auto-deleted
  - Manually cleared
  - Browser cache cleared
  - Extension uninstalled

### 4. Forgotten Data
- Easy to forget documents are queued
- Could remain on device for extended periods
- Important when selling/disposing of computer

## Security Best Practices:

### For Users:

1. **Only use offline mode on personal, trusted devices**
2. **Process queued documents as soon as you're online**
3. **Clear browser data when disposing of device**
4. **Lock your computer when stepping away**
5. **Don't queue highly sensitive documents unless necessary**

### For Developers:

1. **Auto-cleanup** implemented (documents deleted after successful processing)
2. **Clear warnings** to users about offline storage
3. **Privacy disclosure** in extension description
4. **Consider encryption** for future versions

## Current Mitigations:

✅ **Same-Origin Policy**: Other websites/extensions can't access your data
✅ **Extension Isolation**: Chrome isolates extension storage
✅ **Auto-Cleanup**: Completed/failed documents auto-deleted
✅ **User Notification**: Clear alerts when documents are queued

## Future Security Enhancements:

### 1. Encryption at Rest
```javascript
// Encrypt files before storing
const encryptedData = await encrypt(fileData, userPassword);
await queue.queueDocuments(encryptedData);
```

### 2. Time-Based Expiry
```javascript
// Auto-delete queued docs after 24 hours
if (queuedDoc.queuedAt < Date.now() - 24*60*60*1000) {
  await queue.removeDocument(queuedDoc.id);
}
```

### 3. User Confirmation
```javascript
// Require explicit confirmation for sensitive docs
if (isHighlySecure) {
  const confirmed = confirm("This document contains sensitive data. Store offline?");
  if (!confirmed) return;
}
```

### 4. Session-Based Storage
```javascript
// Clear queue when browser closes
window.addEventListener('beforeunload', () => {
  queue.clearAll();
});
```

## Comparison with Alternatives:

### IndexedDB (Current):
- ✅ Works offline
- ✅ No server needed
- ✅ Fast access
- ❌ Stored in plaintext
- ❌ Accessible via DevTools
- ❌ Persists indefinitely

### Chrome Storage API:
- ✅ Extension-specific
- ✅ Syncs across devices (optional)
- ❌ Same security concerns
- ❌ Smaller storage limits

### Server-Side Queue:
- ✅ Not on local device
- ✅ Can encrypt in transit
- ❌ Requires internet to queue
- ❌ Defeats offline purpose
- ❌ Privacy concern (data on server)

## Recommendation:

### For Public Release:

**Add prominent warning in UI:**
```
⚠️ PRIVACY NOTICE
Documents queued offline are stored unencrypted on your device.
Only use this feature on your personal, secure computer.
```

### For Maximum Security:

**Disable offline mode** and show clear error:
```
Sorry, this operation requires an internet connection.
For security reasons, we don't store sensitive documents offline.
Please try again when online.
```

## Legal Considerations:

Depending on your jurisdiction, you may need to:
- 📋 Disclose data storage in privacy policy
- 📋 Get user consent for local storage
- 📋 Comply with GDPR/data protection laws
- 📋 Implement data deletion mechanisms

## Bottom Line:

**IndexedDB storage is secure against:**
- ✅ Other websites
- ✅ Other Chrome extensions (mostly)
- ✅ Network attacks (data never transmitted while offline)

**IndexedDB is NOT secure against:**
- ❌ Physical access to the device
- ❌ Malware on the system
- ❌ Forensic analysis of the hard drive

**Use offline mode responsibly and only on trusted devices.**
