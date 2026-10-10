// Receipt <-> URL fragment. The fragment (#r=...) is never sent to a server.
import { bytesToB64url, b64urlToBytes } from './b64.js';

export const LINK_WARN_CHARS = 30000;
const PREFIX = 'r=';

async function pipe(bytes, stream) {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export async function encode(receipt) {
  const json = new TextEncoder().encode(JSON.stringify(receipt));
  return PREFIX + bytesToB64url(await pipe(json, new CompressionStream('deflate-raw')));
}

/** Accepts "#r=...", "r=..." or a full URL. Throws on anything else. */
export async function decode(input) {
  let s = String(input || '').trim();
  const hash = s.indexOf('#');
  if (hash >= 0) s = s.slice(hash + 1);
  if (!s.startsWith(PREFIX)) throw new Error('no receipt in this link');
  const bytes = await pipe(b64urlToBytes(s.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export function verifyUrl(base, fragment) {
  return `${base.split('#')[0]}#${fragment}`;
}
