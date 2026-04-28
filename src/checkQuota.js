import fs from 'fs/promises'
import dotenv from 'dotenv'
import { getByPath, findNumeric, computeShouldAlert, chooseMetric } from './lib.js'

dotenv.config()

const BREVO_API_KEY = process.env.BREVO_API_KEY
const ALERT_EMAIL = process.env.ALERT_EMAIL
const FROM_EMAIL = process.env.FROM_EMAIL || 'brevo-checker@example.com'
const ALERT_THRESHOLD_PERCENT = process.env.ALERT_THRESHOLD_PERCENT ? Number(process.env.ALERT_THRESHOLD_PERCENT) : null
const ALERT_THRESHOLD_REMAINING = process.env.ALERT_THRESHOLD_REMAINING ? Number(process.env.ALERT_THRESHOLD_REMAINING) : null
const METRIC_JSON_PATH = process.env.METRIC_JSON_PATH || ''
const ALERT_COOLDOWN_HOURS = process.env.ALERT_COOLDOWN_HOURS ? Number(process.env.ALERT_COOLDOWN_HOURS) : 24
const LAST_ALERT_FILE = process.env.LAST_ALERT_FILE || '.brevo-checker-last-alert.json'
const LOCAL_METRIC_FILE = process.env.LOCAL_METRIC_FILE || ''

if (!BREVO_API_KEY && !LOCAL_METRIC_FILE) {
  console.error('BREVO_API_KEY is required unless LOCAL_METRIC_FILE is set for local testing')
  process.exit(2)
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json', 'api-key': BREVO_API_KEY } })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

async function readLastAlert() {
  try {
    const data = await fs.readFile(LAST_ALERT_FILE, 'utf8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

async function writeLastAlert(obj) {
  await fs.writeFile(LAST_ALERT_FILE, JSON.stringify(obj, null, 2), 'utf8')
}

async function sendEmail(to, subject, html) {
  const payload = {
    sender: { name: 'Brevo Checker', email: FROM_EMAIL },
    to: [{ email: to }],
    subject,
    htmlContent: html
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json', 'api-key': BREVO_API_KEY },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Send email failed ${res.status}: ${t}`)
  }
  return res.json()
}

(async function main() {
  try {
    let account
    if (LOCAL_METRIC_FILE) {
      const raw = await fs.readFile(LOCAL_METRIC_FILE, 'utf8')
      account = JSON.parse(raw)
    } else {
      account = await fetchJson('https://api.brevo.com/v3/account')
    }

    const chosen = chooseMetric(account, METRIC_JSON_PATH)
    if (chosen.error) {
      console.error('Metric selection error:', chosen.error)
      if (chosen.value) console.error(JSON.stringify(chosen.value, null, 2))
      process.exit(2)
    }
    const { metricVal, metricKey, parent } = chosen
    const evalRes = computeShouldAlert(metricVal, parent, { thresholdPercent: ALERT_THRESHOLD_PERCENT, thresholdRemaining: ALERT_THRESHOLD_REMAINING })
    if (evalRes.error) {
      console.error('Threshold evaluation error:', evalRes.error)
      process.exit(2)
    }
    if (!evalRes.shouldAlert) {
      console.log('OK: metric', metricKey, metricVal, evalRes)
      process.exit(0)
    }

    const last = await readLastAlert()
    const key = ALERT_EMAIL || '_default'
    const now = Date.now()
    const prev = last[key] || 0
    const cooldownMs = ALERT_COOLDOWN_HOURS * 3600 * 1000
    if (now - prev < cooldownMs) {
      console.log('Alert suppressed due to cooldown')
      process.exit(0)
    }
    const subject = `Brevo quota alert: ${metricKey}=${metricVal}`
    const html = `<p>Brevo quota threshold reached.</p><p>${metricKey}: ${metricVal}</p><pre>${JSON.stringify(account, null, 2)}</pre>`
    if (!BREVO_API_KEY) {
      console.log('DRY-RUN: would send email to', ALERT_EMAIL)
      console.log('Subject:', subject)
    } else {
      await sendEmail(ALERT_EMAIL, subject, html)
    }
    last[key] = now
    await writeLastAlert(last)
    console.log('Alert sent')
    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message || err)
    process.exit(2)
  }
})()
