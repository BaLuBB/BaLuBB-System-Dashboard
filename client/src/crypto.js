// Passwort-Verschlüsselung für den statischen Snapshot (PBKDF2 + AES-256-GCM, WebCrypto).
// Läuft identisch im Browser und in Node, damit der Workflow verschlüsselt und die Seite entschlüsselt.
const enc = new TextEncoder();
const dec = new TextDecoder();
export const ITERATIONS = 600_000;

const toB64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(obj, password, iterations = ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { v: 1, iter: iterations, salt: toB64(salt), iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

/** Wirft bei falschem Passwort oder manipuliertem Inhalt. */
export async function decryptJson(payload, password) {
  const key = await deriveKey(password, fromB64(payload.salt), payload.iter);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(payload.iv) }, key, fromB64(payload.ct));
  return JSON.parse(dec.decode(plain));
}
