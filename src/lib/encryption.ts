/**
 * Encryption utilities for TOON file protection
 * Uses XOR cipher for simple, reversible encryption
 */

/**
 * XOR encrypt/decrypt text with a password
 * Since XOR is symmetric, the same function works for both encryption and decryption
 */
export function xorEncrypt(text: string, password: string): string {
    if (!password || password.length === 0) {
        throw new Error("Password cannot be empty");
    }

    let result = "";
    for (let i = 0; i < text.length; i++) {
        // XOR each character with the corresponding password character (cycling through password)
        const charCode = text.charCodeAt(i) ^ password.charCodeAt(i % password.length);
        result += String.fromCharCode(charCode);
    }
    return result;
}

/**
 * XOR decrypt is the same as encrypt for XOR cipher
 */
export const xorDecrypt = xorEncrypt;

/**
 * Convert encrypted binary data to base64 for safe text storage
 */
export function encryptToBase64(text: string, password: string): string {
    const encrypted = xorEncrypt(text, password);
    return btoa(encrypted);
}

/**
 * Decrypt from base64
 */
export function decryptFromBase64(base64Text: string, password: string): string {
    const encrypted = atob(base64Text);
    return xorDecrypt(encrypted, password);
}

/**
 * Check if a TOON file content is encrypted
 */
export function isEncrypted(content: string): boolean {
    return content.trim().startsWith("# ENCRYPTED_TOON_V1");
}

/**
 * Evaluate password strength
 */
export function getPasswordStrength(password: string): "weak" | "medium" | "strong" {
    if (!password) return "weak";

    let score = 0;

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Character variety checks
    if (/[a-z]/.test(password)) score++; // lowercase
    if (/[A-Z]/.test(password)) score++; // uppercase
    if (/[0-9]/.test(password)) score++; // numbers
    if (/[^a-zA-Z0-9]/.test(password)) score++; // special characters

    if (score <= 2) return "weak";
    if (score <= 4) return "medium";
    return "strong";
}

/**
 * Encrypt TOON file content with password
 * Adds header to identify encrypted files
 */
export function encryptToonContent(toonContent: string, password: string): string {
    const encrypted = encryptToBase64(toonContent, password);
    return `# ENCRYPTED_TOON_V1\n# This file is password-protected\n# Do not edit manually\n\n${encrypted}`;
}

/**
 * Decrypt TOON file content with password
 * Removes header and decrypts the content
 */
export function decryptToonContent(encryptedContent: string, password: string): string {
    if (!isEncrypted(encryptedContent)) {
        // Not encrypted, return as-is for backward compatibility
        return encryptedContent;
    }

    // Extract the base64 content (skip header lines)
    const lines = encryptedContent.split("\n");
    const base64Content = lines.slice(4).join("\n").trim();

    try {
        return decryptFromBase64(base64Content, password);
    } catch (error) {
        throw new Error("Failed to decrypt. Please check your password.");
    }
}
