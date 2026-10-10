---
doc: scope
status: approved
---

# SaidSo

Tamper-evident receipts for AI answers: seal what the AI said, check it later.

## The Unique Kernel
An AI answer becomes a **receipt** — question, answer and model sealed with a hash and a digital signature — and anyone holding the receipt can check, with no account and no server, whether the text they are being shown is still exactly what was sealed, and see word by word what changed if it is not.

## Who It's For
Mira, a freelance consultant who pastes ChatGPT/Claude answers into client reports. When a client later says "the AI never told you that" or a colleague quotes the answer with a few words changed, she has only screenshots, which are trivial to edit. Today she keeps screenshots or copies text into a doc.

## The Core Loop
1. She asks an AI something in whatever chatbot she uses.
2. She pastes the question and the answer into SaidSo, names the model, and presses **Seal**.
3. She gets a receipt card and a verify link, and drops the link into her report.
4. Later anyone opens the link: green **UNCHANGED** stamp — or red **TAMPERED** with the broken field named. They can also paste the version they were shown and see exactly which words differ.

She comes back every time an AI answer feeds a decision she might have to defend.

## Inspiration & Identity
A paper till receipt: monospace type, dashed separators, torn edges, a rubber stamp for the verdict. Calm, factual, honest — every receipt carries a plain "what this proves / what it does not prove" note.

## Why This Matters to the Learner
AI answers increasingly drive real decisions, and nobody can show later what the AI actually said. The owner wants a small, honest tool for that — and wants to practise keeping a coding agent inside an approved plan.

## What "Working" Looks Like
In a browser: paste a question and answer, press Seal, get a receipt card with a short receipt number, hashes and a signature, and a verify link. Open the link in a fresh tab: UNCHANGED. Change one word of the answer inside the link or the file: TAMPERED — "answer changed after sealing". Paste a quote with two words changed into "Check a quote": the changed words are highlighted.
The "oh, that's cool" beat: one edited word turns the green stamp red and the diff shows exactly that word.

## The POC Boundary
- Seal: question, answer, model, optional note -> signed receipt (SHA-256 + Ed25519, device key in the browser).
- Receipt card, verify link (receipt packed into the URL fragment, never sent to a server), JSON download.
- Verify page: signature + per-field check, stamp, signer fingerprint, "check a quote" word diff.
- "My receipts" list stored in this browser.
- Static site, no backend, no accounts.

## Later
- Ask the model from inside SaidSo (bring-your-own key) so the receipt also records "captured directly from the API".
- Public timestamp (OpenTimestamps) so the issue time is provable, not just claimed.
- QR code on the printed receipt.
- Browser extension "Seal this answer" button inside chat apps.

## Explicitly Cut
- Accounts and a server-side registry — would turn a POC into a hosted service and add privacy obligations.
- Proving the AI really produced the text — impossible without the provider signing its output; we state this limit on every receipt instead of pretending.
- Key backup/rotation — the device key lives in this browser; losing it only means new receipts get a new fingerprint.
