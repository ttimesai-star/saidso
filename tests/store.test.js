import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listReceipts, addReceipt, removeReceipt, memoryStorage, LIST_CAP } from '../src/store.js';

test('newest first, de-duplicated, removable, capped', () => {
  const s = memoryStorage();
  addReceipt(s, { number: 'A', receipt: {} });
  addReceipt(s, { number: 'B', receipt: {} });
  addReceipt(s, { number: 'A', receipt: {} });
  assert.deepEqual(listReceipts(s).map((e) => e.number), ['A', 'B']);
  removeReceipt(s, 'A');
  assert.deepEqual(listReceipts(s).map((e) => e.number), ['B']);
  for (let i = 0; i < LIST_CAP + 10; i++) addReceipt(s, { number: 'n' + i, receipt: {} });
  assert.equal(listReceipts(s).length, LIST_CAP);
});

test('no storage or damaged storage is handled', () => {
  assert.deepEqual(listReceipts(null), []);
  assert.equal(addReceipt(null, { number: 'x' }), false);
  const s = memoryStorage();
  s.setItem('saidso.receipts.v1', '{oops');
  assert.deepEqual(listReceipts(s), []);
});
