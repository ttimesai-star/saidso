import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, verifyUrl } from '../src/link.js';
import { seal, verify } from '../src/receipt.js';
import { getOrCreateKey } from '../src/keys.js';
import { memoryStorage } from '../src/store.js';

const key = await getOrCreateKey(memoryStorage());

test('link round-trip keeps the receipt valid (incl. non-ASCII)', async () => {
  const r = await seal({ question: 'Привет? 日本', answer: 'Ответ: да \u{1F44D}', model: 'm' }, key);
  const frag = await encode(r);
  assert.match(frag, /^r=[A-Za-z0-9_-]+$/);
  const url = verifyUrl('https://example.org/saidso/#old', frag);
  assert.equal(url, 'https://example.org/saidso/#' + frag);
  const back = await decode(url);
  assert.deepEqual(back, r);
  assert.equal((await verify(back)).status, 'unchanged');
});

test('decode rejects links without a receipt or with damage', async () => {
  await assert.rejects(decode('https://example.org/#x=1'), /no receipt/);
  await assert.rejects(decode('#r=@@@'));
  const frag = await encode(await seal({ question: 'q', answer: 'a', model: 'm' }, key));
  await assert.rejects(decode(frag.slice(0, frag.length - 10)));
});

test('decode refuses a compressed payload that inflates past the cap', async () => {
  const { MAX_DECODED_BYTES } = await import('../src/link.js');
  const big = new TextEncoder().encode(' '.repeat(MAX_DECODED_BYTES + 10));
  const s = new Blob([big]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(s).arrayBuffer());
  const { bytesToB64url } = await import('../src/b64.js');
  await assert.rejects(decode('#r=' + bytesToB64url(bytes)), /too large/);
});

test('base64url of impossible length is rejected cleanly', async () => {
  const { b64urlToBytes } = await import('../src/b64.js');
  assert.throws(() => b64urlToBytes('abcde'), /not base64url/);
  await assert.rejects(decode('#r=a'), /not base64url/);
});
