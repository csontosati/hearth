---
name: hearth-verification
description: Run Hearth's full pre-PR verification and 16-bit/architecture compliance audit. Use before opening or updating any pull request in Hearth, or when verifying sprite, CSS token, and decoupling rules from AGENTS.md.
---

# Hearth Verification & Compliance Audit

## Required Inputs & Context
- Repository root containing `package.json`, `AGENTS.md`, `src/style.css`, and `src/`.
- Node.js 22+ and installed `node_modules` (if `node_modules` is missing, stop and ask the user before running `npm install` or run `npm ci` in CI).

## Ordered Verification Steps

1. **Run unit tests and TypeScript/Vite build:**
   ```bash
   npm test
   npm run build
   ```
   - **Expected result:** All Vitest suites pass with 0 failures and `tsc && vite build` exits 0.

2. **Check for prohibited TypeScript `any` escapes (Rule 5):**
   ```bash
   rg -n ":\s*any\b|as\s+any\b" src/
   ```
   - **Expected result:** Zero matches (exit code 1).

3. **Check for direct network I/O in simulation or renderers (Rule 2):**
   ```bash
   rg -n "\bfetch\s*\(|new\s+WebSocket" src/architecture/WorldState.ts src/render/
   ```
   - **Expected result:** Zero matches (exit code 1).

4. **Check 16-bit styling compliance in `src/style.css` (Rule 4):**
   ```bash
   rg -n "backdrop-filter|filter:\s*blur|box-shadow:.*blur" src/style.css
   ```
   - **Expected result:** Zero matches (exit code 1), and `image-rendering: pixelated` is present for canvas elements.

## Stop Conditions
- Stop immediately and report **NOT DONE** if `npm test` or `npm run build` fails, or if any Rule 2, Rule 4, or Rule 5 violation is found.
- Save the exact command outputs (test counts, build output, and grep results) as evidence in the PR description or final report.
