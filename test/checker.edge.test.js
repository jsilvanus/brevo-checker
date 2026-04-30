import test from 'node:test'
import assert from 'node:assert'
import fs from 'fs'
import runCheck from '../src/checker.js'

test('missing limit yields usagePercent 0 and preserves remaining', async () => {
  const state = '.alert-state.edge1.json'
  try { fs.unlinkSync(state) } catch {}
  const res = await runCheck({ localMetricFile: 'sample/account_no_limit.json', workspace: process.cwd(), stateFile: state, stateKey: 'e1' })
  assert.strictEqual(res.remainingEmails, 25)
  assert.strictEqual(res.usagePercent, 0)
  assert.strictEqual(res.thresholdTriggered, 'ok')
})

test('multiple channel structures: email priority over sms', async () => {
  const state = '.alert-state.edge2.json'
  try { fs.unlinkSync(state) } catch {}
  const res = await runCheck({ localMetricFile: 'sample/account_multi_channel.json', workspace: process.cwd(), stateFile: state, stateKey: 'e2' })
  // email: limit 200 remaining 40 => used 160 => 80%
  assert.strictEqual(res.remainingEmails, 40)
  assert.strictEqual(res.remainingSMS, 10)
  assert.strictEqual(Math.round(res.usagePercent), 80)
  // default thresholds produce 'ok' unless set; check type
  assert.ok(['ok','warning','critical','emergency'].includes(res.thresholdTriggered))
})
