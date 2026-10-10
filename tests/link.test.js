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
