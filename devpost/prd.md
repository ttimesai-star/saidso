---
doc: prd
status: approved
---

# SaidSo — Product Requirements

A browser app for people who reuse AI answers in their work (Mira, `scope.md > Who It's For`) to seal an answer into a verifiable receipt and to check any receipt or quote later.

## The Core Journey
1. Mira opens SaidSo. The **Seal** screen shows four fields: Question, Answer, Model, Note (optional) and a short line on what a receipt is.
2. She pastes the question and the AI's answer, types the model name, and presses **Seal receipt**.
3. The first time, SaidSo creates a signing key for this browser and says so in one line.
4. A receipt card appears: receipt number, issue time, model, question, answer, the two SHA-256 fingerprints, the signer fingerprint and the seal. Actions: **Copy verify link**, **Download .json**, **Print**.
5. The receipt is added to **My receipts** in this browser.
6. Later a reader opens the verify link. The **Verify** screen loads the receipt from the link and shows a stamp: **UNCHANGED** (green) or **TAMPERED** (red) with the reason.
7. On the same screen the reader pastes the text they were shown in "Check a quote" and sees matching words plain, removed words struck through, added words highlighted, and a one-line verdict ("exact match" / "N words differ").
Success = the reader knows, without trusting Mira or any server, whether the text matches what was sealed. (`scope.md > What "Working" Looks Like`)

## Screens and Layout
Single page, three tabs in a top bar: **Seal**, **Verify**, **My receipts**. Opening a verify link jumps straight to Verify. Footer: "What a receipt proves / does not prove" (always reachable).

## Look and Feel
Till-receipt card on a quiet warm-grey page: monospace for the receipt (system `ui-monospace`), a clean sans for the UI, dashed rules, zig-zag top/bottom edge, stamp verdict rotated a few degrees. Colours: ink near-black, paper off-white, green `#1f7a4d` for UNCHANGED, red `#b3261e` for TAMPERED. Light and dark mode. Copy is short and factual; no hype. (`scope.md > Inspiration & Identity`)

## Features and Behavior

### Sealing
- Question and Answer required; Model required (free text); Note optional (max 200 chars).
- Text is normalised before hashing (Unicode NFC, line endings to `\n`, outer whitespace trimmed) so copy-paste between systems does not break a valid receipt; the receipt stores the normalised text.
- The seal is a digital signature over the receipt's fields and the hashes; the receipt number is the first 8 characters of the seal fingerprint, grouped `XXXX-XXXX`.
- Acceptance: [ ] sealing the same text twice gives two receipts with different times and numbers, both verify; [ ] empty required field shows an inline message, nothing sealed.

### Verify
- Inputs: verify link (auto), pasted receipt JSON, or dropped `.json` file.
- Checks in order: format/version -> question hash -> answer hash -> signature. Verdicts:
  - UNCHANGED — all checks pass.
  - TAMPERED — names what broke: "question changed after sealing", "answer changed after sealing", "model, time or note changed after sealing" (signature fails while hashes match) or "seal does not match".
  - CAN'T READ — the link/file is not a SaidSo receipt or is damaged.
- Shows signer fingerprint; if it equals this browser's key: "Signed by this browser".
- Acceptance: [ ] a fresh receipt verifies UNCHANGED; [ ] one changed word in the answer gives TAMPERED "answer changed after sealing"; [ ] a changed model gives TAMPERED "model, time or note changed"; [ ] garbage gives CAN'T READ.

### Check a quote
- Paste any text; compared word by word with the sealed answer (after the same normalisation). Shows a diff and a count of differing words.
- Acceptance: [ ] identical text -> "exact match"; [ ] two substituted words -> both highlighted, count 2.

### My receipts
- List of receipts sealed in this browser, newest first: number, time, model, first line of the question. Click opens it on Verify. "Remove" per row (local only).

## States and Boundaries
- **First use** — no key yet; created on the first seal.
- **Empty My receipts** — "Receipts you seal appear here. They stay in this browser."
- **Persistence** — key and receipt list in this browser's localStorage only; clearing site data loses them; links and downloaded files still verify anywhere.
- **Privacy** — the receipt travels inside the URL fragment (`#…`), which browsers do not send to servers; nothing is uploaded.
- **Long answers** — links over ~30 000 characters: warn and suggest the .json file.

## Product Decisions
- Paste-in instead of calling a model — works with any chatbot and needs no API key.
- Honest limits shown on every receipt — integrity, not authorship, is what we can prove.
- Static site — anyone can verify without trusting a server.

## What We're Building
Seal, Verify (stamp + reason + signer), Check a quote (word diff), My receipts, verify link, JSON download, print style, proves/doesn't-prove note.

## Deferred From the POC
Ask-the-model capture, public timestamps, QR codes, key backup/import, extension.

## Possible Later Enhancements
Team key directory so readers can see "signed by Mira" instead of a fingerprint; batch sealing of a whole chat export.

## Non-Goals
- Proving that an AI produced the text (needs provider-signed output).
- Storing receipts on a server or syncing between devices.
- Detecting AI-written text.

## Open Questions
None blocking.
