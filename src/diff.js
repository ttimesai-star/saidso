// Word-level diff for "Check a quote": LCS over word tokens, with common prefix/suffix trimmed first.
import { normalize } from './receipt.js';

export const MAX_WORDS = 2500;

export function tokenize(text) {
  const t = normalize(text);
  return t ? t.split(/\s+/) : [];
}

/**
 * @returns {{ops: {type:'same'|'del'|'add', text:string}[] | null, exact: boolean, tooLong: boolean}}
 * `del` = word in the sealed answer that is missing from the quote; `add` = word only in the quote.
 */
export function wordDiff(sealed, quote) {
  const a = tokenize(sealed);
  const b = tokenize(quote);
  const exact = a.length === b.length && a.every((w, i) => w === b[i]);
  if (exact) return { ops: a.map((text) => ({ type: 'same', text })), exact: true, tooLong: false };

  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const A = a.slice(pre, a.length - suf);
  const B = b.slice(pre, b.length - suf);
  if (A.length > MAX_WORDS || B.length > MAX_WORDS) return { ops: null, exact: false, tooLong: true };

  // LCS table, (A.length+1) x (B.length+1), filled from the end.
  const w = B.length + 1;
  const L = new Uint16Array((A.length + 1) * w);
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      L[i * w + j] = A[i] === B[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
    }
  }
  const mid = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { mid.push({ type: 'same', text: A[i] }); i++; j++; }
    else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) { mid.push({ type: 'del', text: A[i++] }); }
    else { mid.push({ type: 'add', text: B[j++] }); }
  }
  while (i < A.length) mid.push({ type: 'del', text: A[i++] });
  while (j < B.length) mid.push({ type: 'add', text: B[j++] });

  const ops = [
    ...a.slice(0, pre).map((text) => ({ type: 'same', text })),
    ...mid,
    ...a.slice(a.length - suf).map((text) => ({ type: 'same', text })),
  ];
  return { ops, exact: false, tooLong: false };
}

/** Words that differ; a replaced word counts once (max of removed/added in each changed run). */
export function changedCount(ops) {
  let n = 0;
  let del = 0;
  let add = 0;
  for (const op of [...ops, { type: 'same' }]) {
    if (op.type === 'del') del++;
    else if (op.type === 'add') add++;
    else { n += Math.max(del, add); del = 0; add = 0; }
  }
  return n;
}
