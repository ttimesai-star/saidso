import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, sha256Hex, seal, verify, receiptNumber, fingerprint, SealError } from '../src/receipt.js';
import { getOrCreateKey } from '../src/keys.js';
import { memoryStorage } from '../src/store.js';

const input = { question: 'Is 7 prime?', answer: 'Yes. 7 has no divisors other than 1 and 7.', model: 'Test model' };
const key = await getOrCreateKey(memoryStorage());
const fixedTime = new Date('2026-10-10T09:00:00.000Z');

test('normalize: NFC, CRLF, trim', () => {
  assert.equal(normalize('  é\r\nb\r '), 'é\nb');
  assert.equal(normalize(null), '');
});

test('sha256Hex matches a known vector', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('seal produces a receipt that verifies UNCHANGED', async () => {
  const r = await seal(input, key, fixedTime);
  assert.equal(r.saidso, 1);
  assert.equal(r.issued_at, '2026-10-10T09:00:00.000Z');
  assert.equal(r.answer_sha256, await sha256Hex(input.answer));
  const v = await verify(r);
  assert.equal(v.status, 'unchanged');
  assert.deepEqual(v.reasons, []);
  assert.match(v.number, /^[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.match(v.signerFingerprint, /^([0-9A-F]{4}-){3}[0-9A-F]{4}$/);
});

test('copy-paste line endings do not break a receipt', async () => {
  const r = await seal({ ...input, answer: 'line one\r\nline two  ' }, key);
  assert.equal(r.answer, 'line one\nline two');
  assert.equal((await verify(r)).status, 'unchanged');
});

test('one changed word in the answer -> TAMPERED, answer named', async () => {
  const r = await seal(input, key);
  const v = await verify({ ...r, answer: r.answer.replace('no', 'many') });
  assert.equal(v.status, 'tampered');
  assert.deepEqual(v.reasons, ['answer changed after sealing']);
});

test('changed question -> TAMPERED, question named', async () => {
  const r = await seal(input, key);
  const v = await verify({ ...r, question: 'Is 9 prime?' });
  assert.deepEqual(v.reasons, ['question changed after sealing']);
});

test('changed model, time or note -> TAMPERED via the seal', async () => {
  const r = await seal(input, key);
  for (const patch of [{ model: 'Other' }, { issued_at: '2020-01-01T00:00:00.000Z' }, { note: 'x' }]) {
    const v = await verify({ ...r, ...patch });
    assert.equal(v.status, 'tampered', JSON.stringify(patch));
    assert.match(v.reasons[0], /signed details changed/);
  }
});

test('text edited AND fingerprint recomputed -> still TAMPERED', async () => {
  const r = await seal(input, key);
  const answer = 'No.';
  const v = await verify({ ...r, answer, answer_sha256: await sha256Hex(answer) });
  assert.equal(v.status, 'tampered');
});

test('re-signed by another key -> valid, but a different signer fingerprint', async () => {
  const other = await getOrCreateKey(memoryStorage());
  const r1 = await seal(input, key);
  const r2 = await seal(input, other);
  assert.notEqual((await verify(r1)).signerFingerprint, (await verify(r2)).signerFingerprint);
});

test('garbage -> UNREADABLE', async () => {
  for (const g of [null, 42, [], {}, { saidso: 2 }]) {
    assert.equal((await verify(g)).status, 'unreadable');
  }
  const r = await seal(input, key);
  assert.equal((await verify({ ...r, seal: 'abc' })).status, 'unreadable');
  assert.equal((await verify({ ...r, answer_sha256: 'zz' })).status, 'unreadable');
});

test('required fields and note length', async () => {
  await assert.rejects(seal({ question: ' ', answer: 'a', model: 'm' }, key), SealError);
  await assert.rejects(seal({ ...input, model: '' }, key), /model/);
  await assert.rejects(seal({ ...input, note: 'x'.repeat(201) }, key), /Note/);
});

test('same text sealed twice -> different numbers, both valid', async () => {
  const a = await seal(input, key, new Date('2026-10-10T09:00:00Z'));
  const b = await seal(input, key, new Date('2026-10-10T09:00:01Z'));
  assert.notEqual(await receiptNumber(a), await receiptNumber(b));
  assert.equal((await verify(b)).status, 'unchanged');
});

test('key persists in storage', async () => {
  const s = memoryStorage();
  const k1 = await getOrCreateKey(s);
  const k2 = await getOrCreateKey(s);
  assert.equal(k1.created, true);
  assert.equal(k2.created, false);
  assert.equal(k1.publicKeyB64, k2.publicKeyB64);
  assert.equal(await fingerprint(k1.publicKeyB64), await fingerprint(k2.publicKeyB64));
});

test('control characters are stripped before hashing', async () => {
  const r = await seal({ ...input, model: 'Mo\u0000del\u0007', note: 'a\u001bb' }, key);
  assert.equal(r.model, 'Model');
  assert.equal(r.note, 'ab');
  assert.equal((await verify(r)).status, 'unchanged');
});

test('text edited and fingerprint recomputed -> both reasons', async () => {
  const r = await seal(input, key);
  const answer = 'No.';
  const v = await verify({ ...r, answer, answer_sha256: await sha256Hex(answer), question: 'x' });
  assert.equal(v.reasons[0], 'question changed after sealing');
  assert.match(v.reasons[1], /seal does not match/);
});

test('signer replaced with a different valid-length key -> TAMPERED, not a crash', async () => {
  const r = await seal(input, key);
  const other = await getOrCreateKey(memoryStorage());
  const v = await verify({ ...r, signer: other.publicKeyB64 });
  assert.equal(v.status, 'tampered');
});
