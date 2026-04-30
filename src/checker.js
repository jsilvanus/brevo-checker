import fs from 'fs/promises'
import { getByPath, findNumeric, computeShouldAlert, chooseMetric, readLastAlert, writeLastAlert } from './lib.js'

export async function runCheck(options = {}) {
  const {
    brevoApiKey,
    alertEmail,
    fromEmail = 'brevo-checker@example.com',
    thresholdPercent = null,
    thresholdRemaining = null,
    metricJsonPath = '',
    localMetricFile = '',
    cooldownHours = 24,
    lastAlertFile = '.brevo-checker-last-alert.json'
  } = options

  if (!brevoApiKey && !localMetricFile) {
    throw new Error('brevoApiKey is required unless localMetricFile is provided')
  }

  let account
  if (localMetricFile) {
    const raw = await fs.readFile(localMetricFile, 'utf8')
    account = JSON.parse(raw)
  } else {
    const res = await fetch('https://api.brevo.com/v3/account', { headers: { accept: 'application/json', 'api-key': brevoApiKey } })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Failed to fetch account: ${res.status} ${t}`)
    }
    account = await res.json()
  }

  const chosen = chooseMetric(account, metricJsonPath)
  if (chosen.error) throw new Error(`Metric selection error: ${chosen.error}`)
  const { metricVal, metricKey, parent } = chosen

  const evalRes = computeShouldAlert(metricVal, parent, { thresholdPercent, thresholdRemaining })
  if (evalRes.error) throw new Error(`Threshold evaluation error: ${evalRes.error}`)
  if (!evalRes.shouldAlert) return { status: 'ok', metricKey, metricVal, evalRes }

  const last = await readLastAlert(lastAlertFile)
  const key = alertEmail || '_default'
  const now = Date.now()
  const prev = last[key] || 0
  const cooldownMs = cooldownHours * 3600 * 1000
  if (now - prev < cooldownMs) return { status: 'suppressed', metricKey, metricVal }

  // send email if API key provided
  if (!brevoApiKey) {
    // dry-run
    return { status: 'alert', dryRun: true, metricKey, metricVal }
  }

  const payload = {
    sender: { name: 'Brevo Checker', email: fromEmail },
    to: [{ email: alertEmail }],
    subject: `Brevo quota alert: ${metricKey}=${metricVal}`,
    htmlContent: `<p>Brevo quota threshold reached.</p><p>${metricKey}: ${metricVal}</p><pre>${JSON.stringify(account)}</pre>`
  }

  const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json', 'api-key': brevoApiKey },
    body: JSON.stringify(payload)
  })
  if (!sendRes.ok) {
    const t = await sendRes.text()
    throw new Error(`Send email failed ${sendRes.status}: ${t}`)
  }

  last[key] = now
  await writeLastAlert(last, lastAlertFile)
  return { status: 'alert', metricKey, metricVal }
}

export default runCheck
