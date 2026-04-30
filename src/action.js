import fs from 'fs/promises'
import path from 'path'
import core from '@actions/core'
import runCheck from './checker.js'

async function loadConfig(workspace, configPath) {
  const full = path.join(workspace || process.cwd(), configPath)
  try {
    const raw = await fs.readFile(full, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    return {}
  }
}

async function main() {
  try {
    const configPath = core.getInput('config_path') || '.github/brevo-checker.json'
    const brevoApiKey = core.getInput('brevo_api_key') || process.env.BREVO_NOTIFY_API_KEY || core.getInput('brevo_notify_api_key')
    const alertEmail = core.getInput('alert_email') || process.env.ALERT_EMAIL
    const localMetricFile = core.getInput('local_metric_file') || ''
    const thresholdPercent = core.getInput('threshold_percent') ? Number(core.getInput('threshold_percent')) : null
    const thresholdRemaining = core.getInput('threshold_remaining') ? Number(core.getInput('threshold_remaining')) : null

    const workspace = process.env.GITHUB_WORKSPACE || process.cwd()
    const fileConfig = await loadConfig(workspace, configPath)

    const opts = {
      brevoApiKey: brevoApiKey || fileConfig.brevoApiKey || fileConfig.brevoApiKeySecretName,
      alertEmail: alertEmail || fileConfig.alertEmail || fileConfig.alert_email,
      thresholdPercent: thresholdPercent ?? fileConfig.thresholdPercent ?? fileConfig.threshold_percent,
      thresholdRemaining: thresholdRemaining ?? fileConfig.thresholdRemaining ?? fileConfig.threshold_remaining,
      metricJsonPath: core.getInput('metric_json_path') || fileConfig.metricJsonPath || fileConfig.metric_json_path || '',
      cooldownHours: Number(core.getInput('cooldown_hours') || fileConfig.cooldownHours || fileConfig.cooldown_hours || 24),
      localMetricFile: localMetricFile
    }

    if (!opts.brevoApiKey && !process.env.BREVO_NOTIFY_API_KEY) {
      core.warning('No Brevo API key provided; action will run in dry-run mode if local metric is provided.')
    }

    const res = await runCheck(opts)
    core.setOutput('status', res.status)
    core.info(`brevo-checker: status=${res.status} metric=${res.metricKey} value=${res.metricVal}`)
    if (res.status === 'alert') core.notice('Brevo quota threshold reached')
  } catch (err) {
    core.setFailed(err.message || String(err))
  }
}

main()
