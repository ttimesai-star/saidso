import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordDiff, changedCount, tokenize, MAX_WORDS } from '../src/diff.js';

const sealed = 'Take 200 mg twice a day with food, for five days.';

test('identical text (whitespace-insensitive) is an exact match', () => {
  const d = wordDiff(sealed, '  ' + sealed.replace(/ /g, '\n') + ' ');
  assert.equal(d.exact, true);
  assert.equal(changedCount(d.ops), 0);
});

test('two substituted words are found and counted once each', () => {
  const d = wordDiff(sealed, 'Take 400 mg twice a day with food, for ten days.');
  assert.equal(d.exact, false);
  assert.equal(changedCount(d.ops), 2);
  assert.deepEqual(d.ops.filter((o) => o.type === 'del').map((o) => o.text), ['200', 'five']);
  assert.deepEqual(d.ops.filter((o) => o.type === 'add').map((o) => o.text), ['400', 'ten']);
});

test('insertion and deletion', () => {
  assert.equal(changedCount(wordDiff(sealed, sealed.replace('twice', 'at least twice')).ops), 2);
  assert.equal(changedCount(wordDiff(sealed, sealed.replace(' with food,', '')).ops), 2);
});

test('same+del ops rebuild the sealed words', () => {
  const d = wordDiff(sealed, 'Completely different words here');
  assert.deepEqual(d.ops.filter((o) => o.type !== 'add').map((o) => o.text), tokenize(sealed));
});

test('very long texts report tooLong instead of hanging', () => {
  const a = Array.from({ length: MAX_WORDS + 5 }, (_, i) => 'a' + i).join(' ');
  const b = Array.from({ length: MAX_WORDS + 5 }, (_, i) => 'b' + i).join(' ');
  const d = wordDiff(a, b);
  assert.equal(d.tooLong, true);
  assert.equal(d.ops, null);
});
