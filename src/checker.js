import fs from 'fs/promises'
import { getByPath, findNumeric, readLastAlert, writeLastAlert } from './lib.js'

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
  let foundMatch = false
  for (const o of objs) {
    for (const [k, v] of Object.entries(o)) {
      if (nameRx.test(k) && v && typeof v === 'object') {
        let remaining = undefined
        let limit = undefined
        for (const [kk, vv] of Object.entries(v)) {
          if (isNumber(vv) && /remaining|left|available|balance/i.test(kk)) remaining = vv
          if (isNumber(vv) && /limit|total|max|quota|credits/i.test(kk)) limit = vv
        }
        if ((remaining == null || limit == null)) {
          const deeper = collectObjects(v)
          for (const d of deeper) {
            for (const [kk, vv] of Object.entries(d)) {
              if (isNumber(vv) && /remaining|left|available|balance/i.test(kk) && remaining == null) remaining = vv
              if (isNumber(vv) && /limit|total|max|quota|credits/i.test(kk) && limit == null) limit = vv
            }
          }
        }
        if (remaining != null || limit != null) return { remaining: remaining ?? null, limit: limit ?? null }
      }
    }
  }
  // If we found an object whose key matched the channel but could not extract stats,
  // return nulls rather than falling back to unrelated numbers.
  if (foundMatch) return { remaining: null, limit: null }

  // For email only: as a fallback, try to find any object that contains numeric remaining/limit.
  if (channel.toLowerCase() === 'email') {
    for (const o of objs) {
      let rem = null, lim = null
      for (const [k, v] of Object.entries(o)) {
        if (isNumber(v) && /remaining|left|available|balance/i.test(k)) rem = v
        if (isNumber(v) && /limit|total|max|quota|credits/i.test(k)) lim = v
      }
      if (rem != null || lim != null) return { remaining: rem ?? null, limit: lim ?? null }
    }
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

  const emailStats = findChannelStats(account, 'email')
  const smsStats = findChannelStats(account, 'sms')

  let usagePercent = null
  let remainingEmails = emailStats.remaining
  let remainingSMS = smsStats.remaining
  if (isNumber(emailStats.limit) && isNumber(emailStats.remaining)) {
    const used = emailStats.limit - emailStats.remaining
    usagePercent = (used / emailStats.limit) * 100
  } else if (isNumber(smsStats.limit) && isNumber(smsStats.remaining)) {
    const used = smsStats.limit - smsStats.remaining
    usagePercent = (used / smsStats.limit) * 100
  } else if (metricJsonPath) {
    let v = undefined
    try { v = getByPath(account, metricJsonPath) } catch { v = undefined }
    if (isNumber(v)) usagePercent = v
  }

  usagePercent = usagePercent == null ? 0 : clampPercent(usagePercent)

  const warn = clampPercent(warningPercent)
  const crit = clampPercent(criticalPercent)
  const emerg = clampPercent(emergencyPercent)

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
