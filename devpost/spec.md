---
doc: spec
status: approved
---

# SaidSo — Technical Spec

## How This Works, In Plain Language
SaidSo is one web page with no server behind it.
- A **hash** (SHA-256) is a 64-character fingerprint of a text: change one letter and the fingerprint is completely different.
- A **digital signature** (Ed25519) is made with a private key that never leaves the browser; anyone with the matching public key can check it, and it breaks if anything signed is changed.
- Sealing = fingerprint the question and the answer, then sign the fingerprints together with model, time and note. The receipt is all of that in one small JSON object.
- Verifying = recompute the fingerprints from the text inside the receipt and check the signature with the public key that the receipt carries.
- The verify link carries the whole receipt, compressed, after the `#` of the URL. Browsers never send that part to a server, so the page can read it while nothing is uploaded.
Why this shape: no backend means nothing to host, nothing to trust and nothing to leak — the right size for a proof of concept.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
1. Seal form -> `app.js` reads fields -> `receipt.js normalize()`.
2. `keys.js getOrCreateKey()` loads the Ed25519 key pair from localStorage or creates it (first use).
3. `receipt.js seal()` -> SHA-256 of question and answer -> signs the canonical message -> returns the receipt object.
4. `app.js` renders the card (`render.js receiptCard()`), `store.js addReceipt()` saves it, `link.js encode()` builds `#r=…`.
5. Reader opens the link -> `link.js decode()` -> `receipt.js verify()` -> verdict object -> `render.js stamp()`.
6. Check a quote -> `diff.js wordDiff(sealedAnswer, pasted)` -> `render.js diffView()`.

## Stack
- Plain HTML, CSS and JavaScript ES modules, no framework and no build step — the app is small, and it can be served by GitHub Pages as-is.
- Web Crypto API (`crypto.subtle`): SHA-256 digest and Ed25519 sign/verify — https://developer.mozilla.org/docs/Web/API/SubtleCrypto. Ed25519 in browsers: Chrome 137+, Firefox 129+, Safari 17+. Checked early: Node 24 supports it (used by the tests).
- `CompressionStream`/`DecompressionStream` (`deflate-raw`) for links — https://developer.mozilla.org/docs/Web/API/CompressionStream.
- Tests: Node's built-in test runner (`node --test`), Node 22+. No npm dependencies at all.

## Where It Runs and How Someone Tries It
- Browser app. Local: `node scripts/serve.mjs` then open http://localhost:5173.
- Tests: `npm test` (runs `node --test`).
- Deployment (optional, chosen): GitHub Pages from the `main` branch root -> https://ttimesai-star.github.io/saidso/.
- Demo video: screen recording of the core journey on the deployed page, captions only, no voice.

## Look and Feel
From `prd.md > Look and Feel`: CSS variables for paper/ink/green/red; receipt card max-width 420px, `ui-monospace` 14px, dashed `border-top` separators, zig-zag edges via CSS `mask`/`linear-gradient`; stamp is a bordered uppercase label rotated -6deg with a short scale-in animation; `prefers-color-scheme: dark` inverts page but keeps the receipt paper-coloured. Print stylesheet prints only the receipt card.

## Components

### receipt.js
`normalize(text)`, `sha256Hex(text)`, `canonicalMessage(fields)`, `seal({question, answer, model, note}, keyPair, now)`, `verify(receipt)` -> `{status: 'unchanged'|'tampered'|'unreadable', reasons: [...], number, signerFingerprint}`, `receiptNumber(receipt)`, `fingerprint(publicKeyB64)`.
PRD ref: `prd.md > Sealing`, `prd.md > Verify`.

### keys.js
`getOrCreateKey(storage)` — Ed25519 key pair as JWK in localStorage key `saidso.key.v1`; returns CryptoKeys + public key base64url.
PRD ref: `prd.md > States and Boundaries`.

### link.js
`encode(receipt)` -> base64url(deflate-raw(JSON)); `decode(fragment)` -> receipt or throws. Max link length warning at 30 000 chars.
PRD ref: `prd.md > Verify`.

### diff.js
`tokenize(text)`, `wordDiff(a, b)` -> list of `{type: 'same'|'del'|'add', text}` via LCS on word tokens; `changedCount(ops)` counts differing words (a substitution counts once).
PRD ref: `prd.md > Check a quote`.

### store.js
`listReceipts()`, `addReceipt(r)`, `removeReceipt(number)` — localStorage `saidso.receipts.v1`, newest first, cap 200.
PRD ref: `prd.md > My receipts`.

### render.js + app.js + index.html + styles.css
Tabs, forms, receipt card, stamp, diff view, list, toasts; `app.js` wires events and hash routing (`#r=` opens Verify).
PRD ref: `prd.md > Screens and Layout`.

## Data Model
Receipt (JSON, version 1):
```json
{
  "saidso": 1,
  "issued_at": "2026-10-10T09:00:00.000Z",
  "model": "Example assistant",
  "note": "",
  "question": "…normalised…",
  "answer": "…normalised…",
  "question_sha256": "64 hex",
  "answer_sha256": "64 hex",
  "signer": "base64url raw Ed25519 public key (32 bytes)",
  "seal": "base64url Ed25519 signature (64 bytes)"
}
```
Signed message = UTF-8 of `JSON.stringify(["saidso-v1", issued_at, model, note, question_sha256, answer_sha256, signer])` — an array, so field order is fixed.
Receipt number = first 8 hex of SHA-256(seal bytes), upper case, `XXXX-XXXX`. Signer fingerprint = first 16 hex of SHA-256(public key), groups of 4.
localStorage: `saidso.key.v1` (JWK pair), `saidso.receipts.v1` (array of receipts). Leaving and coming back keeps both; links/files are self-contained.

## File Structure
```
saidso/
├── index.html          # single page: tabs Seal / Verify / My receipts
├── styles.css          # receipt look, stamp, light/dark, print
├── src/
│   ├── receipt.js      # normalise, hash, seal, verify (pure, tested)
│   ├── keys.js         # device key pair in localStorage
│   ├── link.js         # receipt <-> #r= fragment
│   ├── diff.js         # word diff for "Check a quote"
│   ├── store.js        # My receipts list
│   ├── render.js       # DOM builders
│   └── app.js          # wiring and routing
├── tests/              # node --test
├── scripts/serve.mjs   # tiny static server for local runs
├── devpost/            # Devpost Learn planning docs
├── LICENSE             # MIT
└── README.md
```

## External Services and Dependencies
None at runtime. GitHub Pages hosts static files (free). No API keys.

## Important Failure Modes
- **Browser without Ed25519 in Web Crypto** -> banner "This browser can't create or check signatures; use a current Chrome, Firefox or Safari"; hashes still shown.
- **Link damaged or truncated (chat apps cut long URLs)** -> CAN'T READ with "ask for the .json file".
- **localStorage blocked** -> sealing still works with a temporary key; banner says receipts won't be listed.

## What Was Simplified and Why
- **Self-held device key** instead of a key directory or provider signature — integrity proven, identity shown as a fingerprint. The fuller version needs a published key registry.
- **Claimed issue time** instead of a public timestamp — the time is signed but self-reported. Fuller: OpenTimestamps.
- **LCS word diff** instead of a diff library — answers are short; O(n·m) is fine up to a few thousand words (capped at 4000 words per side).

## Decisions and Open Issues
- Hash and signature split per field so the verdict can name *what* changed (answer vs question vs metadata) — chosen over one signature over everything, which can only say "something changed".
- Normalisation before hashing — avoids false TAMPERED from copy-paste line endings; tradeoff: whitespace-only edits at the ends are not detected.
- Uncertainty discussed: whether Ed25519 works in all target browsers — resolved by feature detection and the banner above.
- Open: none.
