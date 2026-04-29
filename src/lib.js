import fs from 'fs/promises'

const METRIC_KEY_REGEX = /credit|remaining|limit|quota|balance|available|left/i
const TOTAL_CANDIDATES = ['limit', 'total', 'max', 'quota', 'credits']

// Shared helpers for reading/writing the last-alert JSON file
export async function readLastAlert(filePath = process.env.LAST_ALERT_FILE || '.brevo-checker-last-alert.json') {
  try {
    const data = await fs.readFile(filePath, 'utf8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

export async function writeLastAlert(obj, filePath = process.env.LAST_ALERT_FILE || '.brevo-checker-last-alert.json') {
  await fs.writeFile(filePath, JSON.stringify(obj, null, 2), 'utf8')
}

export function getByPath(obj, pathStr) {
  if (!pathStr) return undefined
  const parts = pathStr.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p]
    else return undefined
  }
  return cur
}

export function findNumeric(obj) {
  const queue = [obj]
  const seen = new Set()
  while (queue.length) {
    const cur = queue.shift()
    if (cur && typeof cur === 'object' && !seen.has(cur)) {
      seen.add(cur)
      for (const [k, v] of Object.entries(cur)) {
        if (typeof v === 'number' && METRIC_KEY_REGEX.test(k)) {
          return { value: v, key: k, parent: cur }
        }
        if (typeof v === 'object') queue.push(v)
      }
    }
  }
  return null
}

export function computeShouldAlert(metricVal, parent = {}, config = {}) {
  const { thresholdPercent = null, thresholdRemaining = null } = config
  if (thresholdRemaining != null) {
    return { shouldAlert: metricVal <= thresholdRemaining, mode: 'remaining', threshold: thresholdRemaining }
  }
  if (thresholdPercent != null) {
    let total = undefined
    if (parent && typeof parent === 'object') {
      for (const candidate of TOTAL_CANDIDATES) {
        if (Object.prototype.hasOwnProperty.call(parent, candidate) && typeof parent[candidate] === 'number') {
          total = parent[candidate]
          break
        }
      }
    }
    if (!total) return { error: 'no_total' }
    const pct = (metricVal / total) * 100
    return { shouldAlert: pct <= thresholdPercent, mode: 'percent', percent: pct, total }
  }
  return { error: 'no_threshold' }
}

export function chooseMetric(account, metricJsonPath) {
  if (metricJsonPath) {
    const v = getByPath(account, metricJsonPath)
    if (typeof v === 'number') {
      const parts = metricJsonPath.split('.')
      const parentPath = parts.slice(0, -1).join('.')
      const parent = parentPath ? getByPath(account, parentPath) : account
      return { metricVal: v, metricKey: metricJsonPath, parent }
    }
    return { error: 'metric_path_not_numeric', value: v }
  }
  const found = findNumeric(account)
  if (found) return { metricVal: found.value, metricKey: found.key, parent: found.parent }
  return { error: 'no_numeric_metric' }
}
