/**
 * Encryption utilities for TOON file protection
 *
 * Uses AES-256-GCM via Web Crypto API for strong encryption.
 * Passwords are stretched using PBKDF2 with 100k iterations.
 * Each encryption uses a unique random salt and IV.
 *
 * Maintains backward compatibility: can decrypt legacy V1 (XOR) files,
 * but always encrypts with the new V2 (AES-GCM) format.
 */

// ─── AES-GCM helpers ────────────────────────────────────────────────

/**
 * Derive an AES-256-GCM CryptoKey from a user password + salt via PBKDF2
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
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

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Encrypt plaintext with AES-256-GCM derived from a password.
 * Returns: saltHex:ivHex:ciphertextBase64
 */
async function aesGcmEncrypt(
  plaintext: string,
  password: string
): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error("Password cannot be empty");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassword(password, salt);

  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  return `${toHex(salt)}:${toHex(iv)}:${ctB64}`;
}

/**
 * Decrypt ciphertext produced by aesGcmEncrypt()
 */
async function aesGcmDecrypt(
  stored: string,
  password: string
): Promise<string> {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const [saltHex, ivHex, ctB64] = parts;
  const salt = fromHex(saltHex);
  const iv = fromHex(ivHex);
  const ct = new Uint8Array(
    atob(ctB64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );

  const key = await deriveKeyFromPassword(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource
  );

  return new TextDecoder().decode(decrypted);
}

// ─── Legacy XOR helpers (decryption only, for backward compat) ──────

function xorDecryptLegacy(text: string, password: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const charCode =
      text.charCodeAt(i) ^ password.charCodeAt(i % password.length);
    result += String.fromCharCode(charCode);
  }
  return result;
}

function decryptFromBase64Legacy(
  base64Text: string,
  password: string
): string {
  const encrypted = atob(base64Text);
  return xorDecryptLegacy(encrypted, password);
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Check if content is encrypted (V1 XOR or V2 AES-GCM)
 */
export function isEncrypted(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed.startsWith("# ENCRYPTED_TOON_V1") ||
    trimmed.startsWith("# ENCRYPTED_TOON_V2")
  );
}

/**
 * Evaluate password strength
 */
export function getPasswordStrength(
  password: string
): "weak" | "medium" | "strong" {
  if (!password) return "weak";

  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return "weak";
  if (score <= 4) return "medium";
  return "strong";
}

/**
 * Encrypt TOON file content with AES-256-GCM.
 * The password is stretched via PBKDF2 (100k iterations).
 */
export async function encryptToonContent(
  toonContent: string,
  password: string
): Promise<string> {
  const encrypted = await aesGcmEncrypt(toonContent, password);
  return `# ENCRYPTED_TOON_V2\n# AES-256-GCM encrypted – do not edit manually\n\n${encrypted}`;
}

/**
 * Decrypt TOON file content.
 * Supports both V2 (AES-GCM) and legacy V1 (XOR) formats.
 */
export async function decryptToonContent(
  encryptedContent: string,
  password: string
): Promise<string> {
  if (!isEncrypted(encryptedContent)) {
    return encryptedContent;
  }

  const trimmed = encryptedContent.trim();
  const isV2 = trimmed.startsWith("# ENCRYPTED_TOON_V2");

  // Extract the payload (skip header lines)
  const lines = encryptedContent.split("\n");
  // V2 has 2 header lines + 1 blank line; V1 has 3 header lines + 1 blank line
  const payloadStartIndex = isV2 ? 3 : 4;
  const payload = lines.slice(payloadStartIndex).join("\n").trim();

  try {
    if (isV2) {
      return await aesGcmDecrypt(payload, password);
    }
    // Legacy V1 XOR decryption
    return decryptFromBase64Legacy(payload, password);
  } catch {
    throw new Error("Failed to decrypt. Please check your password.");
  }
}
