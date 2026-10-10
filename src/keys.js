// Device signing key: one Ed25519 key pair per browser, kept as JWK in localStorage.
import { bytesToB64url } from './b64.js';

export const KEY_SLOT = 'saidso.key.v1';
const ALG = { name: 'Ed25519' };

export function ed25519Supported() {
  return !!(globalThis.crypto && globalThis.crypto.subtle);
}

async function fromJwk(pair) {
  const privateKey = await crypto.subtle.importKey('jwk', pair.priv, ALG, false, ['sign']);
  const publicKey = await crypto.subtle.importKey('jwk', pair.pub, ALG, true, ['verify']);
  const raw = await crypto.subtle.exportKey('raw', publicKey);
  return { privateKey, publicKey, publicKeyB64: bytesToB64url(raw) };
}

/**
 * Load this browser's key, or create one. `storage` is localStorage-like or null.
 * @returns {Promise<{privateKey:CryptoKey, publicKey:CryptoKey, publicKeyB64:string, created:boolean, persistent:boolean}>}
 */
export async function getOrCreateKey(storage) {
  if (storage) {
    try {
      const saved = storage.getItem(KEY_SLOT);
      if (saved) return { ...(await fromJwk(JSON.parse(saved))), created: false, persistent: true };
    } catch {
      // damaged slot: fall through and make a new key
    }
  }
  const kp = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  const pair = {
    priv: await crypto.subtle.exportKey('jwk', kp.privateKey),
    pub: await crypto.subtle.exportKey('jwk', kp.publicKey),
  };
  let persistent = false;
  if (storage) {
    try { storage.setItem(KEY_SLOT, JSON.stringify(pair)); persistent = true; } catch { /* blocked */ }
  }
  return { ...(await fromJwk(pair)), created: true, persistent };
}

/** Feature probe: can this browser actually make Ed25519 keys? */
export async function probeEd25519() {
  try {
    await crypto.subtle.generateKey(ALG, false, ['sign', 'verify']);
    return true;
  } catch {
    return false;
  }
}
