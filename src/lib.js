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
        if (typeof v === 'number' && /credit|remaining|limit|quota|balance|available|left/i.test(k)) {
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
      for (const candidate of ['limit', 'total', 'max', 'quota', 'credits']) {
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
    if (typeof v === 'number') return { metricVal: v, metricKey: metricJsonPath, parent: null }
    return { error: 'metric_path_not_numeric', value: v }
  }
  const found = findNumeric(account)
  if (found) return { metricVal: found.value, metricKey: found.key, parent: found.parent }
  return { error: 'no_numeric_metric' }
}
