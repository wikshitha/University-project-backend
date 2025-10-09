// frontend/utils/cryptoUtils.js

// --- Generate AES-GCM key for vault ---
export async function generateVaultKey() {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    return key;
  }
  
  // --- Export AES key as base64 string ---
  export async function exportVaultKey(key) {
    const raw = await crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
  }
  
  // --- Import AES key from base64 string ---
  export async function importVaultKey(base64) {
    const raw = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["encrypt", "decrypt"]);
  }
  
  // --- Encrypt file with AES-GCM vault key ---
  export async function encryptFile(file, vaultKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // random IV
    const fileBuffer = await file.arrayBuffer();
  
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      vaultKey,
      fileBuffer
    );
  
    return {
      ciphertext: new Uint8Array(encrypted),
      iv: Array.from(iv),
    };
  }
  
  // --- Decrypt file with AES-GCM vault key ---
  export async function decryptFile(encryptedData, vaultKey) {
    const { ciphertext, iv } = encryptedData;
  
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      vaultKey,
      new Uint8Array(ciphertext)
    );
  
    return new Blob([decrypted]);
  }
  
  // --- Encrypt vault key for a user (using RSA public key) ---
  export async function encryptVaultKeyForUser(vaultKey, userPublicKeyPem) {
    // Convert PEM to CryptoKey
    const binaryDer = str2ab(userPublicKeyPem
      .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, ""));
    
    const publicKey = await crypto.subtle.importKey(
      "spki",
      binaryDer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );
  
    const rawVaultKey = await crypto.subtle.exportKey("raw", vaultKey);
  
    const encryptedKey = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      rawVaultKey
    );
  
    return btoa(String.fromCharCode(...new Uint8Array(encryptedKey)));
  }
  
  // --- Helper: Convert Base64 PEM to ArrayBuffer ---
  function str2ab(base64Str) {
    const binary = atob(base64Str);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  
  // Convert a base64 string to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
}

// Import participant’s public key (JWK)
export async function importPublicKey(jwk) {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

// Encrypt the vault key with a participant’s public key
export async function encryptVaultKeyForParticipant(vaultKey, participantPublicKeyJWK) {
  const publicKey = await importPublicKey(participantPublicKeyJWK);
  const encryptedKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    vaultKey
  );
  return window.btoa(String.fromCharCode(...new Uint8Array(encryptedKey)));
}
