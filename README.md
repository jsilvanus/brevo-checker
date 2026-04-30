# brevo-checker
A small utility that checks Brevo account send/credit metrics and sends an alert email when a configured threshold is reached.

Usage
-----

1. Copy `.env.example` to `.env` and set `BREVO_API_KEY`, `ALERT_EMAIL`, and threshold values.

2. Run locally (dry-run using the sample JSON):

```bash
LOCAL_METRIC_FILE=sample/account.json ALERT_THRESHOLD_PERCENT=60 ALERT_EMAIL=you@example.com npm run check
```

3. To run against the real Brevo API, set `BREVO_API_KEY` and run:

```bash
npm run check
```

GitHub Actions
--------------

A scheduled workflow exists at `.github/workflows/check-brevo-quota.yml` — set `BREVO_API_KEY` and `ALERT_EMAIL` in repository secrets to enable scheduled checks.

Development
-----------

- Unit tests use Node's built-in test runner: `npm test`.
- For local development, you can use `LOCAL_METRIC_FILE` to avoid hitting the Brevo API.

GitHub Action usage
--------------------

The repository includes a JavaScript action that acts as a decision engine — it does not send notifications itself. Use the action to compute usage and threshold state, then perform notifications in downstream steps.

Inputs (examples):
- `brevo_api_key`: use repository secret `BREVO_NOTIFY_API_KEY`.
- `warning_percent`, `critical_percent`, `emergency_percent`: numeric percentages (defaults: 70,85,95).
- `state_file`: path to persist state (default: `.alert-state.json`).

Outputs:
- `usagePercent`: computed usage percent (number)
- `remainingEmails`: numeric remaining emails or empty
- `remainingSMS`: numeric remaining SMS or empty
- `thresholdTriggered`: one of `ok`, `warning`, `critical`, `emergency`
- `previousThreshold`: previous persisted level
- `stateChanged`: `true`/`false` when the persisted level changed

Example workflow using the local action (see `.github/workflows/brevo-action-example.yml`):

```yaml
uses: ./
with:
	brevo_api_key: ${{ secrets.BREVO_NOTIFY_API_KEY }}
	warning_percent: 70
	critical_percent: 85
	emergency_percent: 95
	state_file: .github/brevo-alert-state.json
``` 

Build and publish
-----------------

The action is bundled into `dist/` with `@vercel/ncc`. Rebuild after changes to `src/action.js`:

```bash
npm ci
npm run build
``` 

Then commit `dist/` to the repo before publishing a release.

