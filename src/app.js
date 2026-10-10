// Wiring: tabs, hash routing, Seal / Verify / My receipts.
import { seal, verify, SealError, fingerprint } from './receipt.js';
import { getOrCreateKey, probeEd25519 } from './keys.js';
import { encode, decode, verifyUrl, LINK_WARN_CHARS } from './link.js';
import { wordDiff, changedCount } from './diff.js';
import { listReceipts, addReceipt, removeReceipt, memoryStorage } from './store.js';
import { receiptCard, stamp, reasonsBox, diffView, h, formatTime } from './render.js';
import { b64urlToBytes, bytesToHex } from './b64.js';

const $ = (s) => document.querySelector(s);

const EXAMPLE = {
  question: 'How much notice should I give a long-term client before raising my hourly rate?',
  answer: "Give at least 30 days' written notice. Explain what is changing and when, keep the current rate for work already agreed, and offer a short call if they have questions. For clients on a fixed retainer, apply the new rate from the next renewal.",
  model: 'Example assistant',
  note: 'Client rate review',
};

function pickStorage() {
  try {
    const k = '__saidso_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return { storage: localStorage, persistent: true };
  } catch {
    return { storage: memoryStorage(), persistent: false };
  }
}
const { storage, persistent } = pickStorage();

let keyPromise = null;
let myFingerprint = null;
function key() {
  if (!keyPromise) {
    keyPromise = getOrCreateKey(storage).then(async (k) => {
      myFingerprint = await fingerprint(k.publicKeyB64);
      return k;
    });
  }
  return keyPromise;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

function banner(msg) {
  const b = $('#banner');
  b.textContent = msg;
  b.hidden = !msg;
}

async function sealHex(r) {
  try { return bytesToHex(b64urlToBytes(r.seal)).slice(0, 48); } catch { return ''; }
}

function baseUrl() {
  return location.href.split('#')[0];
}

/* ---------- tabs & routing ---------- */
function show(tab) {
  for (const v of document.querySelectorAll('.view')) v.hidden = v.dataset.view !== tab;
  for (const a of document.querySelectorAll('.tabs a')) a.setAttribute('aria-selected', String(a.dataset.tab === tab));
  if (tab === 'mine') renderMine();
}

async function route() {
  const frag = location.hash.slice(1);
  if (frag.startsWith('r=')) {
    show('verify');
    $('#verify-input').value = location.href;
    await runVerify(location.href);
    await expandLinkToJson(); // show exactly what is sealed, editable, re-checked live
    return;
  }
  show(['seal', 'verify', 'mine'].includes(frag) ? frag : 'seal');
}

/* ---------- seal ---------- */
async function onSeal(ev) {
  ev.preventDefault();
  const f = ev.target;
  const err = $('#seal-error');
  err.hidden = true;
  const btn = $('#seal-btn');
  btn.disabled = true;
  try {
    const k = await key();
    const r = await seal({
      question: f.question.value, answer: f.answer.value, model: f.model.value, note: f.note.value,
    }, k);
    const v = await verify(r);
    addReceipt(storage, { number: v.number, receipt: r });
    updateCount();
    await showSealed(r, v);
    $('#key-line').textContent = k.created
      ? `A signing key was created for this browser. Fingerprint ${myFingerprint}.`
      : `Signed with this browser's key ${myFingerprint}.`;
  } catch (e) {
    err.textContent = e instanceof SealError ? e.message + '.' : `Could not seal: ${e.message}`;
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

async function showSealed(r, v) {
  const frag = await encode(r);
  const url = verifyUrl(baseUrl(), frag);
  const out = $('#seal-result');
  out.replaceChildren(
    receiptCard(r, { number: v.number, signerFingerprint: v.signerFingerprint, sealHex: await sealHex(r), mine: v.signerFingerprint === myFingerprint }),
    h('div', { class: 'receipt-actions' },
      h('button', { class: 'primary', type: 'button', onclick: () => copy(url) }, 'Copy verify link'),
      h('button', { type: 'button', onclick: () => download(r, v.number) }, 'Download .json'),
      h('button', { type: 'button', onclick: () => { location.hash = frag; } }, 'Open verify page'),
      h('button', { type: 'button', onclick: () => window.print() }, 'Print'),
    ),
  );
  if (url.length > LINK_WARN_CHARS) {
    out.append(h('p', { class: 'fine', style: 'text-align:center' }, 'This link is very long; some chat apps cut long links. Share the .json file instead.'));
  }
  if (window.innerWidth < 900) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Verify link copied');
  } catch {
    window.prompt('Copy this verify link:', text);
  }
}

function download(r, number) {
  const blob = new Blob([JSON.stringify(r, null, 2) + '\n'], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `saidso-${number}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- verify ---------- */
let loaded = null;

async function parseInput(text) {
  const t = String(text || '').trim();
  if (!t) return { empty: true };
  if (t.startsWith('{')) {
    try { return { receipt: JSON.parse(t) }; } catch { return { error: 'the JSON is damaged' }; }
  }
  try { return { receipt: await decode(t) }; } catch { return { error: 'no receipt found in this link' }; }
}

let verifySeq = 0;
async function runVerify(text) {
  const seq = ++verifySeq;
  const p = await parseInput(text);
  if (seq !== verifySeq) return;
  const out = $('#verify-result');
  if (p.empty) {
    loaded = null;
    $('#quote-box').hidden = true;
    return;
  }
  const v = p.error ? { status: 'unreadable', reasons: [p.error] } : await verify(p.receipt);
  if (seq !== verifySeq) return;
  if (v.status === 'unreadable') {
    loaded = null;
    out.replaceChildren(h('div', { class: 'verdict' }, stamp('unreadable')), reasonsBox(v));
    $('#quote-box').hidden = true;
    return;
  }
  await key();
  if (seq !== verifySeq) return;
  const mine = v.signerFingerprint === myFingerprint;
  loaded = p.receipt;
  out.replaceChildren(
    h('div', { class: 'verdict' },
      stamp(v.status),
      receiptCard(p.receipt, { number: v.number, signerFingerprint: v.signerFingerprint, sealHex: await sealHex(p.receipt), mine }),
    ),
    reasonsBox(v, mine),
  );
  $('#quote-box').hidden = false;
  runQuote();
}

function runQuote() {
  const q = $('#quote-input').value;
  const out = $('#quote-result');
  if (!loaded || !q.trim()) { out.replaceChildren(); return; }
  const d = wordDiff(loaded.answer, q);
  out.replaceChildren(diffView(d, d.ops ? changedCount(d.ops) : 0));
}

/** When a link is pasted, show the receipt as editable JSON so edits re-check live. */
async function expandLinkToJson() {
  const ta = $('#verify-input');
  const t = ta.value.trim();
  if (!t || t.startsWith('{')) return;
  try {
    const r = await decode(t);
    ta.value = JSON.stringify(r, null, 2);
  } catch { /* leave as is; runVerify reports it */ }
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------- my receipts ---------- */
function updateCount() {
  const n = listReceipts(storage).length;
  $('#mine-count').textContent = n ? `(${n})` : '';
}

function renderMine() {
  const list = $('#mine-list');
  const items = listReceipts(storage);
  if (!items.length) {
    list.replaceChildren(h('li', { class: 'empty' }, 'Receipts you seal appear here. They stay in this browser.'));
    return;
  }
  list.replaceChildren(...items.map((e) => h('li', {},
    h('span', { class: 'n' }, e.number),
    h('span', { class: 'q' }, (e.receipt.question || '').split('\n')[0]),
    h('span', { class: 'meta' }, `${formatTime(e.receipt.issued_at)} · ${e.receipt.model}`),
    h('span', { class: 'btns' },
      h('button', { type: 'button', onclick: async () => { location.hash = await encode(e.receipt); } }, 'Open'),
      h('button', { type: 'button', onclick: () => { removeReceipt(storage, e.number); updateCount(); renderMine(); } }, 'Remove'),
    ),
  )));
}

/* ---------- start ---------- */
async function start() {
  $('#seal-form').addEventListener('submit', onSeal);
  $('#example-btn').addEventListener('click', () => {
    const f = $('#seal-form');
    for (const [k, v] of Object.entries(EXAMPLE)) f[k].value = v;
  });
  const live = debounce(() => runVerify($('#verify-input').value), 250);
  $('#verify-input').addEventListener('input', live);
  $('#verify-input').addEventListener('paste', () => setTimeout(async () => { await expandLinkToJson(); live(); }, 0));
  $('#verify-btn').addEventListener('click', async () => { await expandLinkToJson(); runVerify($('#verify-input').value); });
  $('#verify-file').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    $('#verify-input').value = await file.text();
    runVerify($('#verify-input').value);
  });
  const vi = $('#verify-input');
  vi.addEventListener('dragover', (ev) => ev.preventDefault());
  vi.addEventListener('drop', async (ev) => {
    const file = ev.dataTransfer.files[0];
    if (!file) return;
    ev.preventDefault();
    vi.value = await file.text();
    runVerify(vi.value);
  });
  $('#quote-input').addEventListener('input', debounce(runQuote, 150));
  window.addEventListener('hashchange', route);

  if (!(await probeEd25519())) {
    banner("This browser can't create or check Ed25519 signatures. Use a current Chrome, Edge, Firefox or Safari.");
    $('#seal-btn').disabled = true;
  } else if (!persistent) {
    banner("This browser blocks local storage: sealing works, but the key and My receipts last only until you close the tab.");
  }
  updateCount();
  await route();
}

start();
