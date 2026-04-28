import test from 'node:test'
import assert from 'node:assert'
import { computeShouldAlert } from '../src/lib.js'

test('threshold remaining triggers when below or equal', () => {
  let r = computeShouldAlert(50, {}, { thresholdRemaining: 50 })
  assert.strictEqual(r.shouldAlert, true)
  r = computeShouldAlert(51, {}, { thresholdRemaining: 50 })
  assert.strictEqual(r.shouldAlert, false)
})

test('percentage threshold uses parent total', () => {
  const parent = { limit: 100 }
  let r = computeShouldAlert(50, parent, { thresholdPercent: 60 })
  assert.strictEqual(r.shouldAlert, true)
  assert.ok(typeof r.percent === 'number')
  r = computeShouldAlert(50, parent, { thresholdPercent: 40 })
  assert.strictEqual(r.shouldAlert, false)
})

test('percentage threshold fails when parent has no total', () => {
  const parent = { some: 1 }
  const r = computeShouldAlert(50, parent, { thresholdPercent: 10 })
  assert.strictEqual(r.error, 'no_total')
})
