/**
 * FormCache - Smart caching for detected forms and required documents
 *
 * Prevents redundant API calls by caching form detection results.
 * Uses URL + form HTML hash to identify unique forms.
 */

import type { FormData, SourceDocumentList } from './formExtraction';

interface CachedFormData {
  identifier: string; // Unique ID for this form (URL + hash)
  url: string; // Page URL where form was detected
  formHash: string; // Hash of form HTML structure
  formData: FormData; // Detected form fields
  sourceDocuments: SourceDocumentList; // Required documents
  cachedAt: number; // Timestamp when cached
  lastAccessedAt: number; // Last time user accessed this cache
}

const CACHE_KEY = 'filr_form_cache';
const CACHE_EXPIRY_DAYS = 7; // Cache expires after 7 days

/**
 * Generate a simple hash from a string
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate unique identifier for current page and form
 */
export async function generateFormIdentifier(): Promise<{ identifier: string; url: string; formHash: string }> {
  // Get current tab's URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';

  // Get form HTML from page
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab!.id! },
    func: () => {
      // Find all forms on page
      const forms = Array.from(document.querySelectorAll('form'));

      if (forms.length === 0) {
        return '';
      }

      // Get HTML of all forms combined
      const formsHTML = forms.map(form => {
        // Get a simplified version of form structure
        const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
        return inputs.map(input => {
          const el = input as HTMLInputElement;
          return `${el.name}:${el.type}:${el.id}`;
        }).join('|');
      }).join('||');

      return formsHTML;
    },
  });

  const formHTML = result.result || '';
  const formHash = simpleHash(url + formHTML);
  const identifier = `${simpleHash(url)}_${formHash}`;

  return { identifier, url, formHash };
}

/**
 * Save form detection results to cache
 */
export async function cacheFormData(
  formData: FormData,
  sourceDocuments: SourceDocumentList
): Promise<void> {
  const { identifier, url, formHash } = await generateFormIdentifier();

  const cached: CachedFormData = {
    identifier,
    url,
    formHash,
    formData,
    sourceDocuments,
    cachedAt: Date.now(),
    lastAccessedAt: Date.now(),
  };

  localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  console.log('[FormCache] Cached form data:', identifier);
}

/**
 * Get cached form data for current page
 */
export async function getCachedFormData(): Promise<CachedFormData | null> {
  const cachedJSON = localStorage.getItem(CACHE_KEY);
  if (!cachedJSON) {
    console.log('[FormCache] No cached form data found');
    return null;
  }

  try {
    const cached: CachedFormData = JSON.parse(cachedJSON);

    // Check if cache is expired (7 days)
    const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - cached.cachedAt > expiryTime) {
      console.log('[FormCache] Cache expired (older than 7 days)');
      clearFormCache();
      return null;
    }

    // Update last accessed time
    cached.lastAccessedAt = Date.now();
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));

    console.log('[FormCache] Found cached form data:', cached.identifier);
    return cached;
  } catch (error) {
    console.error('[FormCache] Error reading cache:', error);
    clearFormCache();
    return null;
  }
}

/**
 * Check if cached form matches current page
 */
export async function isCachedFormCurrent(): Promise<boolean> {
  const cached = await getCachedFormData();
  if (!cached) return false;

  const { identifier } = await generateFormIdentifier();
  const matches = cached.identifier === identifier;

  console.log('[FormCache] Cache match:', matches ? 'YES' : 'NO');
  return matches;
}

/**
 * Clear form cache
 */
export function clearFormCache(): void {
  localStorage.removeItem(CACHE_KEY);
  console.log('[FormCache] Cache cleared');
}

/**
 * Get cache info for UI display
 */
export async function getCacheInfo(): Promise<{
  exists: boolean;
  isCurrent: boolean;
  url?: string;
  cachedAt?: Date;
  formFieldCount?: number;
  documentCount?: number;
} | null> {
  const cached = await getCachedFormData();
  if (!cached) {
    return { exists: false, isCurrent: false };
  }

  const isCurrent = await isCachedFormCurrent();

  return {
    exists: true,
    isCurrent,
    url: cached.url,
    cachedAt: new Date(cached.cachedAt),
    formFieldCount: cached.formData.inputs?.length || 0,
    documentCount: cached.sourceDocuments.source_documents?.length || 0,
  };
}
