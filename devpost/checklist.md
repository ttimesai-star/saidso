---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. You can seal an answer and see its receipt**
  Becomes usable: Paste question, answer, model -> press Seal -> a receipt card with number, hashes, signer fingerprint and seal; JSON download.
  Why now: This is the kernel and touches every risky piece (normalisation, SHA-256, Ed25519 in the browser) on day one.
  PRD ref: `prd.md > The Core Journey` (steps 1-4), `prd.md > Sealing`
  Spec ref: `spec.md > receipt.js`, `spec.md > keys.js`, `spec.md > Data Model`, `spec.md > File Structure`
  Build: Scaffold index.html, styles.css, scripts/serve.mjs, package.json; implement receipt.js (normalize, sha256Hex, canonicalMessage, seal, receiptNumber, fingerprint), keys.js, render.js receiptCard, Seal tab in app.js.
  Verify (mechanical): `npm test` passes seal tests (deterministic hashes for known input, signature verifies with Web Crypto, receipt number format); serve and seal one receipt in a headless browser, card renders.
  Learner check: Open http://localhost:5173, seal any Q&A, look at the receipt.
  Commit: `Seal an AI answer into a signed receipt`

- [x] **2. Anyone can open a verify link and get a verdict**
  Becomes usable: Copy verify link -> open in a new tab -> UNCHANGED stamp; edited receipt -> TAMPERED with the reason; garbage -> CAN'T READ. Paste or drop JSON works too.
  Why now: Verification is the other half of the kernel; the per-field reasons are what make it more than a checksum.
  PRD ref: `prd.md > Verify`, `prd.md > The Core Journey` (step 6)
  Spec ref: `spec.md > receipt.js`, `spec.md > link.js`
  Build: verify() with ordered checks and reasons; link.js encode/decode; Verify tab with link auto-load, paste/drop input, stamp, signer line.
  Verify (mechanical): tests for unchanged / answer changed / question changed / metadata changed / bad seal / unreadable / link round-trip; headless browser opens a generated link and finds the UNCHANGED stamp.
  Learner check: Seal, copy link, open it in a private window; then change one word inside the downloaded JSON and paste it.
  Commit: `Verify receipts from links or files with named reasons`

- [x] **3. You can check a quote word by word**
  Becomes usable: On Verify, paste the text you were shown and see the differing words highlighted with a count.
  Why now: The "oh, that's cool" beat of the demo; depends on slice 2's loaded receipt.
  PRD ref: `prd.md > Check a quote`
  Spec ref: `spec.md > diff.js`
  Build: diff.js tokenize/wordDiff/changedCount; diff view in render.js; wire in app.js.
  Verify (mechanical): diff tests (identical, substitution of two words, insertion, deletion, cap); headless browser shows count 2 for a two-word change.
  Learner check: Paste the sealed answer with two words changed.
  Commit: `Check a quote against the sealed answer`

- [x] **4. Receipts are kept, printable and honest about their limits**
  Becomes usable: My receipts list (open/remove), Print shows just the card, proves/doesn't-prove panel, dark mode, error banners; published on GitHub Pages.
  Why now: Rounds the product into a complete experience once the kernel works.
  PRD ref: `prd.md > My receipts`, `prd.md > States and Boundaries`, `prd.md > Look and Feel`
  Spec ref: `spec.md > store.js`, `spec.md > Look and Feel`, `spec.md > Important Failure Modes`
  Build: store.js + list UI; print CSS; footer panel; feature detection banners; README; Pages.
  Verify (mechanical): store tests; headless run of the full journey; deployed URL returns 200 and seals/verifies.
  Learner check: Seal two receipts, reload, see both in My receipts, print one.
  Commit: `Keep receipts, print view and limits panel`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 2
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning wrap-up done and `devpost/app-map.html` generated

## Revisions
- 2026-10-10: slices 1-4 were implemented in one working session and verified together: `npm test` (22 tests) plus a headless-browser run of the whole core journey (seal -> open link -> UNCHANGED -> edit one word in the JSON -> TAMPERED "answer changed after sealing" -> restore -> UNCHANGED; quote with two changed words -> "2 words differ"; garbage -> CAN'T READ; My receipts lists the receipt; dark mode and 390px mobile screenshots). Committed as one build commit instead of four.
- 2026-10-10: Verify shows a pasted or opened link as pretty JSON in the input box, so a reader sees exactly what is sealed and any edit re-checks live (found while scripting the demo; not in the PRD wording, same behaviour).
- 2026-10-10: the stamp sits over the receipt header instead of the middle, so the answer text stays readable under a verdict.

