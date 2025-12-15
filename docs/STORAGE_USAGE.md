# Storage Usage Guide

## Quick Reference

### Import Storage Functions
```typescript
import { saveApiKey, getApiKey, saveModel, getModel } from './lib/storage';
```

### Save Data
```typescript
// Save API key
await saveApiKey('your-api-key-here');

// Save model preference
await saveModel('Gemini 2.5 Flash');
```

### Retrieve Data
```typescript
// Get API key
const apiKey = await getApiKey(); // Returns string | null

// Get model
const model = await getModel(); // Returns string | null (defaults to "Gemini 2.0 Flash")
```

### Delete Data
```typescript
import { deleteApiKey, deleteModel, clearAllStorage } from './lib/storage';

// Delete API key only
await deleteApiKey();

// Delete model only
await deleteModel();

// Clear everything
await clearAllStorage();
```

### Watch for Changes (Advanced)
```typescript
import { watchApiKey, watchModel } from './lib/storage';

// Watch API key changes
const unwatchApiKey = watchApiKey((newValue, oldValue) => {
  console.log('API key changed:', { newValue, oldValue });
});

// Watch model changes
const unwatchModel = watchModel((newValue, oldValue) => {
  console.log('Model changed:', { newValue, oldValue });
});

// Stop watching
unwatchApiKey();
unwatchModel();
```

## Direct Storage Item Access (Advanced)

If you need more control, use the storage items directly:

```typescript
import { apiKeyStorage, modelStorage } from './lib/storage';

// All operations available
await apiKeyStorage.setValue('key');
const key = await apiKeyStorage.getValue();
await apiKeyStorage.removeValue();
const unwatch = apiKeyStorage.watch((newValue, oldValue) => { ... });

// Same for modelStorage
await modelStorage.setValue('Gemini 2.5 Pro');
const model = await modelStorage.getValue();
```

## Storage Keys

All keys are prefixed with `local:` to use Chrome's local storage:

- `local:gemini_api_key` - Stores the Gemini API key
- `local:gemini_model` - Stores the selected Gemini model

## Type Safety

All storage functions are fully typed:

```typescript
// Type-safe values
const apiKey: string | null = await getApiKey();
const model: string | null = await getModel();

// Type-safe watchers
watchApiKey((newValue: string | null, oldValue: string | null) => {
  // TypeScript knows the types!
});
```

## Best Practices

### 1. Always Check for Null
```typescript
const apiKey = await getApiKey();
if (!apiKey) {
  alert("Please configure your API key in settings");
  return;
}
// Use apiKey safely
```

### 2. Use Async/Await
```typescript
// ✅ Good
async function handleSubmit() {
  const apiKey = await getApiKey();
  // ...
}

// ❌ Bad - Won't work
function handleSubmit() {
  const apiKey = getApiKey(); // This returns a Promise!
  // ...
}
```

### 3. Batch Operations When Possible
```typescript
// ✅ Good - Parallel operations
const [apiKey, model] = await Promise.all([
  getApiKey(),
  getModel()
]);

// ⚠️ Less efficient - Sequential operations
const apiKey = await getApiKey();
const model = await getModel();
```

### 4. Handle Errors
```typescript
try {
  await saveApiKey(newApiKey);
  console.log('API key saved successfully');
} catch (error) {
  console.error('Failed to save API key:', error);
  alert('Failed to save settings. Please try again.');
}
```

## Migration from localStorage

If you're migrating code from `localStorage`:

### Before (localStorage)
```typescript
// Get
const apiKey = localStorage.getItem('gemini_api_key');

// Set
localStorage.setItem('gemini_api_key', value);

// Remove
localStorage.removeItem('gemini_api_key');
```

### After (WXT Storage)
```typescript
// Get
const apiKey = await getApiKey();

// Set
await saveApiKey(value);

// Remove
await deleteApiKey();
```

**Key differences:**
1. All operations are now **async** (must use `await`)
2. Functions must be `async` to use storage
3. No more string keys - use the wrapper functions
4. Better type safety

## Testing Storage

### In Browser DevTools Console
```javascript
// Check stored values
chrome.storage.local.get(['local:gemini_api_key', 'local:gemini_model'], (result) => {
  console.log('Stored data:', result);
});

// Clear all storage
chrome.storage.local.clear(() => {
  console.log('Storage cleared');
});
```

### In Extension Code
```typescript
// Debug: Log current values
const apiKey = await getApiKey();
const model = await getModel();
console.log('Current storage:', { apiKey, model });
```

## Security Notes

✅ **Secure:** Data stored in `chrome.storage.local` is:
- Encrypted at rest by Chrome
- Isolated from web pages (XSS protection)
- Only accessible by your extension

❌ **Not secure enough for production:** Consider:
- Moving API keys to a backend server
- Using OAuth with server-side key management
- Adding user authentication

## Troubleshooting

### Storage not persisting?
Check that `'storage'` permission is in `wxt.config.ts`:
```typescript
permissions: ['scripting', 'tabs', 'storage']
```

### Values always null?
Make sure you're using `await`:
```typescript
const apiKey = await getApiKey(); // ✅ Correct
const apiKey = getApiKey(); // ❌ Wrong - returns Promise
```

### Import errors?
Verify `@wxt-dev/storage` is installed:
```bash
pnpm add @wxt-dev/storage
```

## Reference Links

- [WXT Storage Documentation](https://wxt.dev/guide/storage.html)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [`@wxt-dev/storage` on npm](https://www.npmjs.com/package/@wxt-dev/storage)
