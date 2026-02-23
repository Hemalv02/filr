/**
 * Secure Storage for sensitive data (API keys)
 *
 * Uses AES-256-GCM encryption via Web Crypto API to encrypt sensitive
 * values before storing them in localStorage. The encryption key is
 * derived using PBKDF2 from an application secret + random salt,
 * ensuring stored data is never in plain text.
 */

const APP_SECRET = "filr-chrome-ext-v1-key-protection";
const ENCRYPTED_KEY_STORAGE = "gemini_api_key_enc";
const LEGACY_KEY_STORAGE = "gemini_api_key";

/**
 * Derive an AES-256-GCM key from the app secret and a random salt using PBKDF2
 */
async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(APP_SECRET),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext value using AES-256-GCM
 * Returns format: salt(base64):iv(base64):ciphertext(base64)
 */
async function encryptValue(plaintext: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(salt);

  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  const saltB64 = btoa(String.fromCharCode(...salt));
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

  return `${saltB64}:${ivB64}:${ctB64}`;
}

/**
 * Decrypt a stored value encrypted with encryptValue()
 */
async function decryptValue(stored: string): Promise<string> {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }

  const [saltB64, ivB64, ctB64] = parts;
  const salt = new Uint8Array(
    atob(saltB64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
  const iv = new Uint8Array(
    atob(ivB64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
  const ct = new Uint8Array(
    atob(ctB64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );

  const key = await deriveKey(salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Singleton manager for secure API key storage.
 *
 * - Encrypts the API key with AES-256-GCM before storing in localStorage
 * - Caches the decrypted key in memory for synchronous access
 * - Handles migration from legacy plaintext storage
 */
export class ApiKeyManager {
  private static instance: ApiKeyManager;
  private cachedKey: string | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }

  /**
   * Initialize the manager: decrypt stored key and migrate from plaintext if needed.
   * Call this once at app startup before any component reads the API key.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const encryptedKey = localStorage.getItem(ENCRYPTED_KEY_STORAGE);
      const legacyKey = localStorage.getItem(LEGACY_KEY_STORAGE);

      if (encryptedKey) {
        this.cachedKey = await decryptValue(encryptedKey);
        if (legacyKey) {
          localStorage.removeItem(LEGACY_KEY_STORAGE);
        }
      } else if (legacyKey) {
        console.log("[SecureStorage] Migrating API key from plaintext to encrypted storage");
        await this.setApiKey(legacyKey);
        localStorage.removeItem(LEGACY_KEY_STORAGE);
      }
    } catch (error) {
      console.error("[SecureStorage] Failed to initialize:", error);
      const legacyKey = localStorage.getItem(LEGACY_KEY_STORAGE);
      if (legacyKey) {
        this.cachedKey = legacyKey;
      }
    }

    this.initialized = true;
  }

  /**
   * Get the API key synchronously from the in-memory cache.
   * Before initialization completes, falls back to legacy plaintext key.
   */
  getApiKey(): string | null {
    if (this.cachedKey) return this.cachedKey;

    if (!this.initialized) {
      return localStorage.getItem(LEGACY_KEY_STORAGE);
    }

    return null;
  }

  /**
   * Store the API key securely (encrypted with AES-256-GCM).
   */
  async setApiKey(key: string): Promise<void> {
    const encrypted = await encryptValue(key);
    localStorage.setItem(ENCRYPTED_KEY_STORAGE, encrypted);
    localStorage.removeItem(LEGACY_KEY_STORAGE);
    this.cachedKey = key;
  }

  /**
   * Clear the stored API key from both encrypted and legacy storage.
   */
  clearApiKey(): void {
    localStorage.removeItem(ENCRYPTED_KEY_STORAGE);
    localStorage.removeItem(LEGACY_KEY_STORAGE);
    this.cachedKey = null;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
