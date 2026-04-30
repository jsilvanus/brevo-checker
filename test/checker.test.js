import test from 'node:test'
import assert from 'node:assert'
import fs from 'fs'
import runCheck from '../src/checker.js'

const SAMPLE = 'sample/account.json'
const STATE = '.alert-state.test.json'

test('runCheck returns expected fields and ok state', async () => {
  try { fs.unlinkSync(STATE) } catch {}
  const res = await runCheck({ localMetricFile: SAMPLE, workspace: process.cwd(), stateFile: STATE, stateKey: 't1', warningPercent: 60, criticalPercent: 80, emergencyPercent: 90 })
  assert.strictEqual(typeof res.usagePercent, 'number')
  assert.strictEqual(res.thresholdTriggered, 'ok')
  assert.strictEqual(res.previousThreshold, 'ok')
  assert.strictEqual(res.stateChanged, false)
})

test('runCheck transitions state on threshold reach', async () => {
  try { fs.unlinkSync(STATE) } catch {}
  // First run with low warning to trigger a warning
  let r = await runCheck({ localMetricFile: SAMPLE, workspace: process.cwd(), stateFile: STATE, stateKey: 't2', warningPercent: 40, criticalPercent: 80, emergencyPercent: 90 })
  assert.ok(['warning','critical','emergency','ok'].includes(r.thresholdTriggered))
  assert.strictEqual(r.previousThreshold, 'ok')
  assert.strictEqual(r.stateChanged, true)

  // Second run should not change state
  const r2 = await runCheck({ localMetricFile: SAMPLE, workspace: process.cwd(), stateFile: STATE, stateKey: 't2', warningPercent: 40, criticalPercent: 80, emergencyPercent: 90 })
  assert.strictEqual(r2.stateChanged, false)
})
