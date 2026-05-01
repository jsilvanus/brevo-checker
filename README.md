# brevo-checker
A small utility that checks Brevo account send/credit metrics and exposes computed values so downstream workflow steps can decide how to notify recipients.

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

A scheduled workflow exists at `.github/workflows/check-brevo-quota.yml`. This repository's action is a decision engine only — it computes usage and threshold state and exposes outputs for downstream steps to send notifications.

Recommended secrets:
- `BREVO_NOTIFY_API_KEY` — your Brevo API key (used by checkers or notifier)
- `BREVO_SENDER_EMAIL` and `BREVO_SENDER_NAME` — used by notifier actions (kept out of this repo)

Development
-----------

- Unit tests use Node's built-in test runner: `npm test`.
- For local development, you can use `LOCAL_METRIC_FILE` to avoid hitting the Brevo API.

GitHub Action usage
--------------------

This repository provides a light-weight JavaScript action that computes metrics and decides the threshold level. It intentionally does not send notifications — use the action outputs in downstream steps or a separate notifier repository (for example, `jsilvanus/brevo-notifier`).

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

Example workflow using the action (local checkout):

```yaml
- name: Check Brevo quota
	id: check
	uses: ./
	with:
		brevo_api_key: ${{ secrets.BREVO_NOTIFY_API_KEY }}
		warning_percent: 70
		critical_percent: 85
		emergency_percent: 95
		state_file: .github/brevo-alert-state.json

# downstream: conditional notifier using outputs
- name: Notify via Brevo notifier
	if: ${{ steps.check.outputs.thresholdTriggered != 'ok' && steps.check.outputs.stateChanged == 'true' }}
	uses: jsilvanus/brevo-notifier@v1
	with:
		threshold: ${{ steps.check.outputs.thresholdTriggered }}
		usagePercent: ${{ steps.check.outputs.usagePercent }}
		remainingEmails: ${{ steps.check.outputs.remainingEmails }}
		remainingSMS: ${{ steps.check.outputs.remainingSMS }}
	env:
		BREVO_API_KEY: ${{ secrets.BREVO_API_KEY }}
		BREVO_SENDER_EMAIL: ${{ secrets.BREVO_SENDER_EMAIL }}
		BREVO_SENDER_NAME: ${{ secrets.BREVO_SENDER_NAME }}
```

Simple inline-run alternative (call a script in the repo):

```yaml
- name: Send notifications (inline script)
	if: ${{ steps.check.outputs.thresholdTriggered != 'ok' }}
	run: |
		node scripts/send-inline-notify.js \
			"$${{ steps.check.outputs.thresholdTriggered }}" \
			"$${{ steps.check.outputs.usagePercent }}" \
			"$${{ steps.check.outputs.remainingEmails }}" \
			"$${{ steps.check.outputs.remainingSMS }}"
	env:
		BREVO_API_KEY: ${{ secrets.BREVO_API_KEY }}
		BREVO_SENDER_EMAIL: ${{ secrets.BREVO_SENDER_EMAIL }}
		BREVO_SENDER_NAME: ${{ secrets.BREVO_SENDER_NAME }}
```

Build and publish
-----------------

The action is bundled into `dist/` with `@vercel/ncc`. Rebuild after changes to `src/action.js`:

```bash
npm ci
npm run build
``` 

Then commit `dist/` to the repo before publishing a release.

