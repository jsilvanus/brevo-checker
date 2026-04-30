import fs from 'fs/promises'
import dotenv from 'dotenv'
import { getByPath, findNumeric, computeShouldAlert, chooseMetric, readLastAlert, writeLastAlert } from './lib.js'

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

/* readLastAlert / writeLastAlert moved to src/lib.js */

import dotenv from 'dotenv'
import runCheck from './checker.js'

dotenv.config()

const opts = {
  brevoApiKey: process.env.BREVO_API_KEY,
  alertEmail: process.env.ALERT_EMAIL,
  fromEmail: process.env.FROM_EMAIL || 'brevo-checker@example.com',
  thresholdPercent: process.env.ALERT_THRESHOLD_PERCENT ? Number(process.env.ALERT_THRESHOLD_PERCENT) : null,
  thresholdRemaining: process.env.ALERT_THRESHOLD_REMAINING ? Number(process.env.ALERT_THRESHOLD_REMAINING) : null,
  metricJsonPath: process.env.METRIC_JSON_PATH || '',
  cooldownHours: process.env.ALERT_COOLDOWN_HOURS ? Number(process.env.ALERT_COOLDOWN_HOURS) : 24,
  localMetricFile: process.env.LOCAL_METRIC_FILE || '',
  lastAlertFile: process.env.LAST_ALERT_FILE || '.brevo-checker-last-alert.json'
}

(async function main() {
  try {
    const res = await runCheck(opts)
    if (res.status === 'ok') process.exit(0)
    if (res.status === 'suppressed') process.exit(0)
    if (res.status === 'alert') process.exit(0)
    process.exit(2)
  } catch (err) {
    console.error('Error:', err.message || err)
    process.exit(2)
  }
})()
    const chosen = chooseMetric(account, METRIC_JSON_PATH)
