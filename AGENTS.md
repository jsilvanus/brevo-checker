AGENTS.md — Guidance for AI coding agents (brevo-checker)

Purpose
-------
This file gives focused, actionable instructions for AI coding agents working on this repository so they can be productive immediately.

Quick facts
-----------
- Language: Node.js (ESM), engines.node >=22. See package.json.
- Tests: npm test (Node's built-in test runner). See test/.
- Build (action bundle): npm run build (uses @vercel/ncc), outputs dist/index.js referenced by action.yml.

Where to make changes
---------------------
- Quota logic: edit src/checker.js and src/lib.js (business logic; add tests under test/).
- Action entrypoint: edit src/action.js; after changes run npm run build and commit dist/ (action.yml points to dist/index.js).
- CLI wrapper: src/checkQuota.js.

Action & release rules
----------------------
- Consumers expect a runnable bundle in dist/. If you change src/action.js:
  1. Run npm ci (to ensure local dev deps installed).
  2. Run npm run build.
  3. Run tests (npm test).
  4. Commit both source changes and the built dist/ before creating a release tag.
- Do NOT commit secrets. Use repository secrets for API keys (see README.md). Known secret names: BREVO_NOTIFY_API_KEY and BREVO_API_KEY.

Notifier separation
-------------------
Notification/delivery logic is intentionally split into a separate repository (brevo-notifier). Do not add delivery (sending emails/SMS) into this repo — keep this repo a decision engine only.

Editing PR and commit guidance
-----------------------------
- Keep commits small and focused. Example commit messages:
  - feat(check): extract runCheck decision engine
  - fix(action): handle missing parent totals
  - docs(agent): update AGENTS.md
- When changing thresholds or default behavior, add or update unit tests in test/ verifying state transitions and idempotency.

Common tasks for agents
-----------------------
- Run tests locally: npm ci && npm test
- Rebuild action bundle: npm run build (requires @vercel/ncc in devDependencies)
- Dry-run decision engine: node -e "(async()=>{ const run = (await import('./src/checker.js')).default; console.log(await run({ localMetricFile:'sample/account.json' })); })()"

Where to look for context
-------------------------
- Project README: README.md
- Action metadata: action.yml
- Tests: test/
- Sample data: sample/

If you are unsure
---------------
- Ask a human for desired notification policy before adding senders/notifications here — delivery belongs to brevo-notifier.
- Verify changes with the smoke CI workflow: .github/workflows/smoke-action.yml.

Next customization suggestions
---------------------------
1. Add a .github/copilot-instructions.md linking to this file and stating the repository's scope (check-only).
2. Add a short AGENTS/tests.md describing how to run and extend tests for runCheck state transitions.
