/**
 * Secure storage utilities using WXT Storage API
 * Provides encrypted, isolated storage for sensitive data like API keys
 * @see https://wxt.dev/guide/storage.html
 */

import { storage } from '@wxt-dev/storage';

/**
 * Define storage items with type safety and default values
 */
export const apiKeyStorage = storage.defineItem<string>('local:gemini_api_key', {
  fallback: '',
});

export const modelStorage = storage.defineItem<string>('local:gemini_model', {
  fallback: 'Gemini 2.0 Flash',
});

/**
 * Save Gemini API key to storage
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  await apiKeyStorage.setValue(apiKey);
}

/**
 * Get Gemini API key from storage
 * Returns null if not set (empty string is treated as not set)
 */
export async function getApiKey(): Promise<string | null> {
  const value = await apiKeyStorage.getValue();
  return value || null;
}

/**
 * Delete Gemini API key from storage
 */
export async function deleteApiKey(): Promise<void> {
  await apiKeyStorage.removeValue();
}

/**
 * Save Gemini model selection to storage
 */
export async function saveModel(model: string): Promise<void> {
  await modelStorage.setValue(model);
}

/**
 * Get Gemini model selection from storage
 */
export async function getModel(): Promise<string | null> {
  const value = await modelStorage.getValue();
  return value || null;
}

/**
 * Delete Gemini model selection from storage
 */
export async function deleteModel(): Promise<void> {
  await modelStorage.removeValue();
}

/**
 * Watch for API key changes
 */
export function watchApiKey(callback: (newValue: string | null, oldValue: string | null) => void) {
  return apiKeyStorage.watch(callback);
}

/**
 * Watch for model changes
 */
export function watchModel(callback: (newValue: string | null, oldValue: string | null) => void) {
  return modelStorage.watch(callback);
}

/**
 * Clear all storage data
 */
export async function clearAllStorage(): Promise<void> {
  await Promise.all([
    apiKeyStorage.removeValue(),
    modelStorage.removeValue(),
  ]);
}
