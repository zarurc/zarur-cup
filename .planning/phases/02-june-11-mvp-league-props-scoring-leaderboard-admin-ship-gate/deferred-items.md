# Deferred items (out-of-scope discoveries during plan execution)

## Plan 02-10 (2026-05-26)

- **ESLint @typescript-eslint/no-require-imports** in `scripts/cleanup-preview.cjs:16,17` and `scripts/seed-preview.cjs:20,21`. Pre-existing (introduced by commit 30c3259 before this plan). Files are .cjs by design (CommonJS for the Vercel/node preview lifecycle scripts) but the project ESLint config flags `require()` style imports as errors. Two options for follow-up: (a) add a `/* eslint-disable @typescript-eslint/no-require-imports */` directive at the top of each .cjs file, (b) exclude `scripts/**/*.cjs` from the ESLint flat config. Not blocking Plan 02-10 — none of the modified files are in scripts/.
