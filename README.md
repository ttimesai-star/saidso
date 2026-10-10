# SaidSo

**Tamper-evident receipts for AI answers.** Paste a question and the answer you got from any chatbot, press **Seal**, and get a receipt plus a verify link. Anyone who opens the link later sees a green **UNCHANGED** stamp, or a red **TAMPERED** stamp naming what was edited. Paste the version you were shown into **Check a quote** and SaidSo highlights every word that differs.

Live: https://ttimesai-star.github.io/saidso/

No account, no server, no API key. Everything runs in the browser.

## How it works

1. **Normalise.** Question, answer, model and note go through Unicode NFC normalisation, line endings become `\n`, and leading and trailing whitespace is trimmed. Copy-paste between systems then can't break a valid receipt.
2. **Fingerprint.** SHA-256 of the question and SHA-256 of the answer.
3. **Sign.** An Ed25519 key pair is created in your browser on first use (Web Crypto) and kept in localStorage. It signs `["saidso-v1", issued_at, model, note, question_sha256, answer_sha256, signer]`.
4. **Share.** The receipt is compressed (deflate-raw) and placed in the URL fragment: `…/saidso/#r=…`. Browsers never send the fragment to a server. You can also download the receipt as `.json`.
5. **Verify.** The verifier recomputes both fingerprints and checks the signature with the public key carried in the receipt. Because the text and the signature are checked separately, the verdict can say *which part* changed: the question, the answer, or the signed details (model, time, note).

Receipt format (v1):

```json
{
  "saidso": 1,
  "issued_at": "2026-10-10T09:00:00.000Z",
  "model": "Example assistant",
  "note": "",
  "question": "…",
  "answer": "…",
  "question_sha256": "64 hex",
  "answer_sha256": "64 hex",
  "signer": "base64url Ed25519 public key",
  "seal": "base64url Ed25519 signature"
}
```

## What a receipt proves, and what it does not

| Proves | Does not prove |
|---|---|
| The sealed text and details have not been edited since sealing. Even a one-character edit is detected and named. | That an AI really wrote the answer. SaidSo seals what you paste; only the AI provider could sign its own output. |
| Receipts with the same signer fingerprint came from the same browser key. | The time. It is signed, but it comes from the sealer's clock. |
| | Who the signer is. Compare the fingerprint with one the person shared with you. |

## Run locally

Requires Node.js 22+ and has no dependencies.

```bash
npm start      # http://localhost:5173
npm test       # node --test: sealing, verification, links, word diff, storage
```

Ed25519 in Web Crypto needs a current browser (Chrome/Edge 137+, Firefox 129+, Safari 17+). Older browsers show a notice.

## Project layout

```
index.html, styles.css   single page: Seal / Verify / My receipts
src/receipt.js           normalise, hash, seal, verify (pure; tested)
src/keys.js              device key pair
src/link.js              receipt <-> #r= fragment
src/diff.js              word diff for "Check a quote"
src/store.js             My receipts (localStorage)
src/render.js, app.js    DOM and wiring
tests/                   node:test suites
devpost/                 planning docs: scope.md, prd.md, spec.md, checklist.md
```

## How it was built

This project was built for Devpost's *Build With AI: Basics* hackathon. It started from an empty folder with the [Devpost Learn Skill Pack](https://github.com/challengepost/learn-ai-basics) (`npx skills add challengepost/learn-ai-basics --all -y`) and the Claude Code coding agent. The planning documents the skills produced are in [`devpost/`](devpost/): [scope](devpost/scope.md), [PRD](devpost/prd.md), [spec](devpost/spec.md), and the [build checklist](devpost/checklist.md). The project uses no third-party code or libraries.

## License

MIT, see [LICENSE](LICENSE).
