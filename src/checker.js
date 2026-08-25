import fs from 'fs/promises'
import { getByPath, readLastAlert, writeLastAlert } from './lib.js'

function isNumber(v) { return typeof v === 'number' && Number.isFinite(v) }

function collectObjects(obj) {
  const out = []
  const seen = new Set()
  const q = [obj]
  while (q.length) {
    const cur = q.shift()
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue
    seen.add(cur)
    out.push(cur)
    for (const v of Object.values(cur)) if (v && typeof v === 'object') q.push(v)
  }
  return out
}

function findChannelStats(account, channel) {
  const objs = collectObjects(account)
  const nameRx = new RegExp(channel, 'i')

  for (const o of objs) {
    for (const [k, v] of Object.entries(o)) {
      if (!nameRx.test(k) || !v || typeof v !== 'object') continue
      let remaining
      let limit
      for (const [kk, vv] of Object.entries(v)) {
        if (isNumber(vv) && /remaining|left|available/i.test(kk)) remaining = vv
        if (isNumber(vv) && /limit|total|max|quota/i.test(kk)) limit = vv
      }
      if (remaining != null || limit != null) return { remaining: remaining ?? null, limit: limit ?? null }
    }
  }

  // Current /v3/account exposes plan credits, but not a used/total pair.
  // Keep the remaining credit count for reporting, but never infer usage %.
  if (Array.isArray(account?.plan)) {
    const plan = account.plan.find(p => p?.creditsType === 'sendLimit' && (channel !== 'sms' || p.type === 'sms'))
    if (plan && isNumber(plan.credits)) return { remaining: plan.credits, limit: null }
  }

  return { remaining: null, limit: null }
}

function clampPercent(n) { return Math.max(0, Math.min(100, Number(n) || 0)) }

export async function runCheck(options = {}) {
  const {
    brevoApiKey,
    metricJsonPath = '',
    localMetricFile = '',
    workspace = process.cwd(),
    warningPercent = 70,
    criticalPercent = 85,
    emergencyPercent = 95,
    stateFile = '.alert-state.json',
    stateKey = 'default'
  } = options

  if (!brevoApiKey && !localMetricFile) throw new Error('brevoApiKey is required unless localMetricFile is provided')

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

  const emailStats = findChannelStats(account, 'email')
  const smsStats = findChannelStats(account, 'sms')
  const remainingEmails = emailStats.remaining
  const remainingSMS = smsStats.remaining

  let usagePercent = null
  if (isNumber(emailStats.limit) && isNumber(emailStats.remaining) && emailStats.limit > 0) {
    usagePercent = ((emailStats.limit - emailStats.remaining) / emailStats.limit) * 100
  } else if (isNumber(smsStats.limit) && isNumber(smsStats.remaining) && smsStats.limit > 0) {
    usagePercent = ((smsStats.limit - smsStats.remaining) / smsStats.limit) * 100
  } else if (metricJsonPath) {
    let v
    try { v = getByPath(account, metricJsonPath) } catch { v = undefined }
    if (isNumber(v)) usagePercent = v
  }

  if (!isNumber(usagePercent)) {
    throw new Error('Unable to determine Brevo usage percentage. Configure metric_json_path or provide quota data containing both remaining and limit values.')
  }

  usagePercent = clampPercent(usagePercent)
  const warn = clampPercent(warningPercent)
  const crit = clampPercent(criticalPercent)
  const emerg = clampPercent(emergencyPercent)
  if (!(warn < crit && crit < emerg)) throw new Error(`Thresholds must be strictly increasing: warning=${warn}, critical=${crit}, emergency=${emerg}`)

  let level = 'ok'
  if (usagePercent >= emerg) level = 'emergency'
  else if (usagePercent >= crit) level = 'critical'
  else if (usagePercent >= warn) level = 'warning'

  const statePath = stateFile.startsWith('/') ? stateFile : `${workspace}/${stateFile}`
  let state = {}
  try { state = await readLastAlert(statePath) } catch { state = {} }
  const prev = state[stateKey] || 'ok'
  const stateChanged = prev !== level
  if (stateChanged) {
    state[stateKey] = level
    await writeLastAlert(state, statePath)
  }

  return {
    usagePercent: Number(usagePercent.toFixed(2)),
    remainingEmails: remainingEmails == null ? null : Number(remainingEmails),
    remainingSMS: remainingSMS == null ? null : Number(remainingSMS),
    thresholdTriggered: level,
    previousThreshold: prev,
    stateChanged,
    raw: account
  }
}

export default runCheck
