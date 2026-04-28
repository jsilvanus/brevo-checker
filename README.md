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

