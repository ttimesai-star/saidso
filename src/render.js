// DOM builders. Everything user-supplied goes in as text nodes, never as HTML.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.setAttribute('style', v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Decorative barcode derived from the seal: same receipt, same bars. */
function barsFor(raw) {
  const hex = String(raw || '').replace(/[^0-9A-Fa-f]/g, ''); // only hex ever reaches the style attribute
  if (!hex) return 'none';
  const stops = [];
  let x = 0;
  const total = hex.length * 3;
  for (const ch of hex) {
    const v = parseInt(ch, 16);
    const bar = 1 + (v & 3);
    const gap = 1 + (v >> 2);
    const a = (x / total) * 100;
    const b = ((x + bar) / total) * 100;
    stops.push(`#1b1a17 ${a.toFixed(2)}% ${b.toFixed(2)}%`, `transparent ${b.toFixed(2)}% ${(((x + bar + gap) / total) * 100).toFixed(2)}%`);
    x += bar + gap;
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/**
 * @param {object} r receipt
 * @param {{number:string, signerFingerprint:string, sealHex:string, mine:boolean}} info
 */
export function receiptCard(r, info) {
  const card = h('article', { class: 'receipt', 'aria-label': `Receipt ${info.number}` },
    h('div', { class: 'r-head' },
      h('div', { class: 'r-title' }, 'SAIDSO'),
      h('div', { class: 'r-sub' }, 'RECEIPT FOR AN AI ANSWER'),
    ),
    h('hr'),
    h('div', { class: 'kv' }, h('span', {}, 'ISSUED'), h('span', {}, formatTime(r.issued_at))),
    h('div', { class: 'kv' }, h('span', {}, 'UTC'), h('span', {}, r.issued_at)),
    h('div', { class: 'kv' }, h('span', {}, 'MODEL'), h('span', {}, r.model)),
    r.note ? h('div', { class: 'kv' }, h('span', {}, 'NOTE'), h('span', {}, r.note)) : null,
    h('hr'),
    h('div', { class: 'lbl' }, 'QUESTION'),
    h('div', { class: 'txt short' }, r.question),
    h('div', { class: 'lbl' }, 'ANSWER'),
    h('div', { class: 'txt' }, r.answer),
    h('hr'),
    h('div', { class: 'lbl' }, 'QUESTION SHA-256'),
    h('div', { class: 'hash' }, r.question_sha256),
    h('div', { class: 'lbl' }, 'ANSWER SHA-256'),
    h('div', { class: 'hash' }, r.answer_sha256),
    h('div', { class: 'lbl' }, 'SIGNER'),
    h('div', { class: 'hash' }, info.signerFingerprint + (info.mine ? '  (this browser)' : '')),
    h('div', { class: 'lbl' }, 'SEAL (ED25519)'),
    h('div', { class: 'hash' }, r.seal),
    h('hr'),
    h('div', { class: 'lbl', style: 'text-align:center' }, 'RECEIPT NO.'),
    h('div', { class: 'num' }, info.number),
    h('div', { class: 'barcode', style: `--bars:${barsFor(info.sealHex || info.number.replace('-', ''))}`, 'aria-hidden': 'true' }),
    h('div', { class: 'r-foot' }, 'Any edit breaks this seal. Check at SaidSo.'),
  );
  return card;
}

const STAMP = {
  unchanged: { cls: 'ok', text: 'UNCHANGED' },
  tampered: { cls: 'bad', text: 'TAMPERED' },
  unreadable: { cls: 'unk', text: "CAN'T READ" },
};

export function stamp(status) {
  const s = STAMP[status];
  return h('div', { class: `stamp ${s.cls}`, role: 'img', 'aria-label': `Verdict: ${s.text}` }, s.text);
}

export function reasonsBox(v, mine) {
  if (v.status === 'unchanged') {
    return h('div', { class: 'reasons ok' },
      h('strong', {}, 'Unchanged since it was sealed.'),
      h('div', {}, 'Question, answer, model, time and note match the seal.'),
      h('div', { class: 'who' }, `Signer ${v.signerFingerprint}${mine ? ' — this browser' : ''}`),
    );
  }
  if (v.status === 'tampered') {
    return h('div', { class: 'reasons bad' },
      h('strong', {}, 'This receipt was changed after sealing.'),
      h('ul', {}, v.reasons.map((x) => h('li', {}, x[0].toUpperCase() + x.slice(1) + '.'))),
      h('div', { class: 'who' }, `Signer ${v.signerFingerprint}${mine ? ' — this browser' : ''}`),
    );
  }
  return h('div', { class: 'reasons bad' },
    h('strong', {}, "This isn't a readable SaidSo receipt."),
    h('div', {}, `${v.reasons[0]}. If it came as a link, the chat app may have cut it — ask for the .json file.`),
  );
}

export function diffView(d, count) {
  if (d.tooLong) {
    return h('div', { class: 'diff-verdict bad' }, 'Too long to compare word by word — and not an exact match.');
  }
  if (d.exact) {
    return h('div', {},
      h('div', { class: 'diff-verdict ok' }, 'Exact match with the sealed answer.'),
    );
  }
  const body = h('div', { class: 'diff' });
  d.ops.forEach((op, i) => {
    if (i) body.append(' ');
    body.append(op.type === 'same' ? document.createTextNode(op.text) : h(op.type === 'del' ? 'del' : 'ins', {}, op.text));
  });
  return h('div', {},
    h('div', { class: 'diff-verdict bad' }, `${count} word${count === 1 ? '' : 's'} differ from the sealed answer.`),
    body,
    h('div', { class: 'legend' }, 'Struck through: in the sealed answer, missing from the quote. Highlighted: in the quote, not in the sealed answer.'),
  );
}
