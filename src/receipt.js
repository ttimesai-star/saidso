// Core of SaidSo: normalise text, fingerprint it, seal it, check it.
// Pure functions over Web Crypto, so the same code runs in the browser and in `node --test`.
import { bytesToB64url, b64urlToBytes, bytesToHex } from './b64.js';

export const VERSION = 1;
const DOMAIN = 'saidso-v1';
const NOTE_MAX = 200;
const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

/** Unicode NFC, line endings to \n, outer whitespace trimmed. */
export function normalize(text) {
  return String(text ?? '').normalize('NFC').replace(/\r\n?/g, '\n').trim();
}

export async function sha256Hex(text) {
  return bytesToHex(await subtle().digest('SHA-256', enc.encode(text)));
}

/** The exact bytes that get signed. An array keeps field order fixed. */
export function canonicalMessage(r) {
  return enc.encode(JSON.stringify([
    DOMAIN, r.issued_at, r.model, r.note, r.question_sha256, r.answer_sha256, r.signer,
  ]));
}

export class SealError extends Error {}

/**
 * Seal a question/answer pair.
 * @param {{question:string, answer:string, model:string, note?:string}} input
 * @param {{privateKey:CryptoKey, publicKeyB64:string}} key
 * @param {Date} [now]
 */
export async function seal(input, key, now = new Date()) {
  const question = normalize(input.question);
  const answer = normalize(input.answer);
  const model = normalize(input.model);
  const note = normalize(input.note);
  const missing = [];
  if (!question) missing.push('question');
  if (!answer) missing.push('answer');
  if (!model) missing.push('model');
  if (missing.length) throw new SealError(`Required: ${missing.join(', ')}`);
  if (note.length > NOTE_MAX) throw new SealError(`Note is longer than ${NOTE_MAX} characters`);

  const r = {
    saidso: VERSION,
    issued_at: now.toISOString(),
    model,
    note,
    question,
    answer,
    question_sha256: await sha256Hex(question),
    answer_sha256: await sha256Hex(answer),
    signer: key.publicKeyB64,
    seal: '',
  };
  const sig = await subtle().sign({ name: 'Ed25519' }, key.privateKey, canonicalMessage(r));
  r.seal = bytesToB64url(sig);
  return r;
}

function group(hex, size) {
  return hex.toUpperCase().match(new RegExp(`.{1,${size}}`, 'g')).join('-');
}

/** Short human number: first 8 hex of SHA-256(seal), e.g. 3F9A-0C12. */
export async function receiptNumber(r) {
  const h = bytesToHex(await subtle().digest('SHA-256', b64urlToBytes(r.seal)));
  return group(h.slice(0, 8), 4);
}

/** Signer fingerprint: first 16 hex of SHA-256(public key), groups of 4. */
export async function fingerprint(publicKeyB64) {
  const h = bytesToHex(await subtle().digest('SHA-256', b64urlToBytes(publicKeyB64)));
  return group(h.slice(0, 16), 4);
}

const STRING_FIELDS = ['issued_at', 'model', 'note', 'question', 'answer',
  'question_sha256', 'answer_sha256', 'signer', 'seal'];

/** Shape check only. Returns an error message or null. */
export function shapeError(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 'not a receipt';
  if (r.saidso !== VERSION) return 'not a SaidSo v1 receipt';
  for (const f of STRING_FIELDS) {
    if (typeof r[f] !== 'string') return `missing field "${f}"`;
  }
  if (!/^[0-9a-f]{64}$/.test(r.question_sha256) || !/^[0-9a-f]{64}$/.test(r.answer_sha256)) {
    return 'damaged fingerprints';
  }
  if (Number.isNaN(Date.parse(r.issued_at))) return 'damaged time';
  try {
    if (b64urlToBytes(r.signer).length !== 32) return 'damaged signer key';
    if (b64urlToBytes(r.seal).length !== 64) return 'damaged seal';
  } catch {
    return 'damaged signer key or seal';
  }
  return null;
}

/**
 * Check a receipt. Order: shape -> question hash -> answer hash -> signature.
 * @returns {Promise<{status:'unchanged'|'tampered'|'unreadable', reasons:string[], number?:string, signerFingerprint?:string}>}
 */
export async function verify(r) {
  const bad = shapeError(r);
  if (bad) return { status: 'unreadable', reasons: [bad] };

  const reasons = [];
  // Hash the text exactly as stored; a receipt is only valid if it already holds normalised text.
  if (await sha256Hex(r.question) !== r.question_sha256) reasons.push('question changed after sealing');
  if (await sha256Hex(r.answer) !== r.answer_sha256) reasons.push('answer changed after sealing');

  let sigOk = false;
  try {
    const pub = await subtle().importKey('raw', b64urlToBytes(r.signer), { name: 'Ed25519' }, false, ['verify']);
    sigOk = await subtle().verify({ name: 'Ed25519' }, pub, b64urlToBytes(r.seal), canonicalMessage(r));
  } catch {
    sigOk = false;
  }
  // If the text still matches its fingerprints but the seal fails, something signed was edited:
  // model, time, note, signer, the seal itself, or a fingerprint recomputed to hide a text edit.
  if (!sigOk && reasons.length === 0) reasons.push('signed details changed after sealing (model, time, note or fingerprints)');
  const status = reasons.length === 0 && sigOk ? 'unchanged' : 'tampered';
  return {
    status,
    reasons,
    number: await receiptNumber(r),
    signerFingerprint: await fingerprint(r.signer),
  };
}
